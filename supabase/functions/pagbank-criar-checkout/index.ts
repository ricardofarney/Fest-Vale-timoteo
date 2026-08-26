// Cria a cobrança do pedido no PagBank (API de Checkout e Link de Pagamento).
//
// O comprador é levado para a página do PagBank e volta para o site.
// NENHUM dado do comprador é enviado daqui: o objeto "customer" é omitido e
// "customer_modifiable" fica no padrão (true), então nome, e-mail, CPF e cartão
// são digitados dentro do ambiente do PagBank. Nada disso passa pelo Supabase.
//
// Segredos (painel do Supabase > Edge Functions > Secrets):
//   PAGBANK_TOKEN     — token Bearer da conta (sandbox ou produção)
//   PAGBANK_AMBIENTE  — "sandbox" ou "producao" (padrão: sandbox)
//   SITE_URL          — endereço do site, ex.: https://www.festvaletimoteo.com.br
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

/** Endereço da API conforme o ambiente configurado. */
function baseApi(): string {
  const amb = (Deno.env.get("PAGBANK_AMBIENTE") ?? "sandbox").trim().toLowerCase();
  return amb === "producao" || amb === "produção" || amb === "production"
    ? "https://api.pagseguro.com"
    : "https://sandbox.api.pagseguro.com";
}

/** Extrai da resposta o endereço para onde o comprador deve ser levado. */
function linkDePagamento(checkout: Record<string, unknown>): string | null {
  const links = (checkout.links ?? []) as Array<{ rel?: string; href?: string }>;
  const pay = links.find((l) => (l.rel ?? "").toUpperCase() === "PAY");
  return pay?.href ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const TOKEN = Deno.env.get("PAGBANK_TOKEN");
    if (!TOKEN) {
      return json({ error: "PAGBANK_TOKEN não configurado no Supabase." }, 503);
    }
    const SITE_URL = (Deno.env.get("SITE_URL") ?? "https://www.festvaletimoteo.com.br").replace(/\/$/, "");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const API = baseApi();

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);

    // Cliente com o token do usuário, só para descobrir quem é
    const asUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await asUser.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "Sessão inválida" }, 401);

    const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { order_id } = await req.json().catch(() => ({}));
    if (!order_id) return json({ error: "order_id é obrigatório" }, 400);

    const { data: order, error: orderErr } = await admin
      .from("orders")
      .select("id, buyer_id, event_id, total_cents, status, expires_at, payment_ref_id")
      .eq("id", order_id)
      .single();
    if (orderErr || !order) return json({ error: "Pedido não encontrado" }, 404);
    if (order.buyer_id !== user.id) return json({ error: "Pedido de outro usuário" }, 403);
    if (order.status === "paid") return json({ error: "Pedido já pago", already_paid: true }, 409);
    if (order.status !== "pending") return json({ error: "Pedido não está mais disponível" }, 409);
    if (!order.total_cents || order.total_cents <= 0) return json({ error: "Pedido sem valor" }, 400);

    // Se o comprador já tinha começado o pagamento, reaproveita a mesma cobrança
    // em vez de criar outra. Evita duplicata quando ele clica duas vezes ou volta.
    if (order.payment_ref_id) {
      const r = await fetch(`${API}/checkouts/${order.payment_ref_id}`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      if (r.ok) {
        const existente = await r.json();
        const status = String(existente?.status ?? "").toUpperCase();
        const href = linkDePagamento(existente);
        if (href && status !== "INACTIVE" && status !== "EXPIRED" && status !== "PAID") {
          return json({ checkout_id: existente.id, pay_url: href, reaproveitado: true });
        }
      }
    }

    const { data: ev } = await admin
      .from("events")
      .select("name")
      .eq("id", order.event_id)
      .single();

    const { data: items } = await admin
      .from("order_items")
      .select("qty, unit_price_cents, ticket_batches(name, ticket_types(name))")
      .eq("order_id", order.id);

    const linhas = (items ?? []).map((it: Record<string, unknown>) => {
      const batch = it.ticket_batches as { name?: string; ticket_types?: { name?: string } } | null;
      const tipo = batch?.ticket_types?.name ?? "Ingresso";
      const lote = batch?.name ?? "";
      return {
        reference_id: String(order.id),
        // O PagBank limita o nome do item; mantemos curto e legível na fatura
        name: `${ev?.name ?? "Ingresso"} — ${tipo}${lote ? ` (${lote})` : ""}`.slice(0, 100),
        quantity: Number(it.qty),
        unit_amount: Number(it.unit_price_cents), // em centavos
      };
    });

    // Com cupom, o total fica abaixo da soma dos itens. Para não haver divergência
    // entre itens e valor cobrado, nesse caso mandamos uma linha só com o total.
    const somaItens = linhas.reduce((s, i) => s + i.quantity * i.unit_amount, 0);
    const itensFinal =
      somaItens === order.total_cents
        ? linhas
        : [{
            reference_id: String(order.id),
            name: `${ev?.name ?? "Ingresso"} — ${linhas.reduce((s, i) => s + i.quantity, 0)} ingresso(s)`.slice(0, 100),
            quantity: 1,
            unit_amount: order.total_cents,
          }];

    const webhook = `${SUPABASE_URL}/functions/v1/pagbank-webhook`;

    const corpo: Record<string, unknown> = {
      reference_id: String(order.id),
      // Sem "customer" e com customer_modifiable no padrão: quem preenche os
      // dados é o comprador, dentro da página do PagBank.
      items: itensFinal,
      // Débito exige aprovação interna prévia do PagBank — fica de fora por ora.
      payment_methods: [
        { type: "CREDIT_CARD" },
        { type: "PIX" },
        { type: "BOLETO" },
      ],
      // Sem INTEREST_FREE_INSTALLMENTS: por padrão do PagBank, os juros do
      // parcelamento são pagos pelo comprador — que é a regra do Fest Vale.
      payment_methods_configs: [
        { type: "CREDIT_CARD", config_options: [{ option: "INSTALLMENTS_LIMIT", value: "12" }] },
      ],
      soft_descriptor: "FESTVALE".slice(0, 17),
      redirect_url: `${SITE_URL}/checkout/${order.id}?retorno=sucesso`,
      return_url: `${SITE_URL}/checkout/${order.id}?retorno=voltou`,
      payment_notification_urls: [webhook],
      notification_urls: [webhook],
    };
    if (order.expires_at) corpo.expiration_date = order.expires_at;

    const res = await fetch(`${API}/checkouts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify(corpo),
    });

    const dados = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("pagbank /checkouts:", res.status, JSON.stringify(dados));
      const primeiro = (dados?.error_messages ?? [])[0];
      return json(
        {
          error: "O PagBank recusou a criação do pagamento",
          detalhe: primeiro?.description ?? primeiro?.error ?? null,
        },
        502,
      );
    }

    const href = linkDePagamento(dados);
    if (!href) {
      console.error("pagbank: resposta sem link PAY:", JSON.stringify(dados));
      return json({ error: "O PagBank não retornou o endereço de pagamento." }, 502);
    }

    await admin.from("orders").update({ payment_ref_id: dados.id }).eq("id", order.id);

    return json({ checkout_id: dados.id, pay_url: href });
  } catch (e) {
    console.error("pagbank-criar-checkout:", e);
    return json({ error: "Erro inesperado ao iniciar o pagamento" }, 500);
  }
});
