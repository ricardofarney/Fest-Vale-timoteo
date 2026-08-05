// Cria a preferência de pagamento do Mercado Pago (Checkout Pro) para um pedido.
// O comprador é levado para o ambiente do Mercado Pago e volta para o site:
// nenhum dado de cartão, Pix ou documento passa por aqui.
//
// Segredos usados (painel do Supabase > Edge Functions > Secrets):
//   MP_ACCESS_TOKEN  — Access Token de produção da conta do Mercado Pago
//   SITE_URL         — endereço do site, ex.: https://www.festvaletimoteo.com.br
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN");
    if (!MP_ACCESS_TOKEN) {
      return json({ error: "MP_ACCESS_TOKEN não configurado no Supabase." }, 503);
    }
    const SITE_URL = (Deno.env.get("SITE_URL") ?? "https://www.festvaletimoteo.com.br").replace(/\/$/, "");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

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
      .select("id, buyer_id, event_id, total_cents, status, buyer_name, buyer_email, expires_at, mp_preference_id")
      .eq("id", order_id)
      .single();
    if (orderErr || !order) return json({ error: "Pedido não encontrado" }, 404);
    if (order.buyer_id !== user.id) return json({ error: "Pedido de outro usuário" }, 403);
    if (order.status === "paid") return json({ error: "Pedido já pago", already_paid: true }, 409);
    if (order.status !== "pending") return json({ error: "Pedido não está mais disponível" }, 409);
    if (!order.total_cents || order.total_cents <= 0) return json({ error: "Pedido sem valor" }, 400);

    const { data: ev } = await admin
      .from("events")
      .select("name, starts_at, venue")
      .eq("id", order.event_id)
      .single();

    const { data: items } = await admin
      .from("order_items")
      .select("qty, unit_price_cents, ticket_batches(name, ticket_types(name))")
      .eq("order_id", order.id);

    const mpItems = (items ?? []).map((it: Record<string, unknown>) => {
      const batch = it.ticket_batches as { name?: string; ticket_types?: { name?: string } } | null;
      const tipo = batch?.ticket_types?.name ?? "Ingresso";
      const lote = batch?.name ?? "";
      return {
        id: String(order.id),
        title: `${ev?.name ?? "Ingresso"} — ${tipo}${lote ? ` (${lote})` : ""}`,
        quantity: Number(it.qty),
        unit_price: Number(it.unit_price_cents) / 100,
        currency_id: "BRL",
        category_id: "tickets",
      };
    });

    // Quando há desconto de cupom o total fica abaixo da soma dos itens.
    // O Checkout Pro não aceita divergência, então nesse caso mandamos uma linha só.
    const somaItens = mpItems.reduce((s, i) => s + i.quantity * i.unit_price, 0);
    const totalReais = order.total_cents / 100;
    const itemsFinal =
      Math.abs(somaItens - totalReais) < 0.005
        ? mpItems
        : [{
            id: String(order.id),
            title: `${ev?.name ?? "Ingresso"} — ${mpItems.reduce((s, i) => s + i.quantity, 0)} ingresso(s)`,
            quantity: 1,
            unit_price: totalReais,
            currency_id: "BRL",
            category_id: "tickets",
          }];

    const preference = {
      items: itemsFinal,
      external_reference: String(order.id),
      statement_descriptor: "FESTVALE",
      payer: {
        name: order.buyer_name ?? undefined,
        email: order.buyer_email ?? user.email ?? undefined,
      },
      back_urls: {
        success: `${SITE_URL}/checkout/${order.id}?retorno=sucesso`,
        pending: `${SITE_URL}/checkout/${order.id}?retorno=pendente`,
        failure: `${SITE_URL}/checkout/${order.id}?retorno=falha`,
      },
      auto_return: "approved",
      notification_url: `${SUPABASE_URL}/functions/v1/mp-webhook`,
      expires: true,
      expiration_date_to: order.expires_at,
      metadata: { order_id: order.id, event_id: order.event_id },
    };

    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        // Evita criar duas preferências se o comprador clicar duas vezes
        "X-Idempotency-Key": `pref-${order.id}`,
      },
      body: JSON.stringify(preference),
    });

    const mp = await mpRes.json();
    if (!mpRes.ok) {
      console.error("mercadopago:", mpRes.status, mp);
      return json({ error: "Mercado Pago recusou a criação do pagamento", detalhe: mp?.message ?? null }, 502);
    }

    await admin.from("orders").update({ mp_preference_id: mp.id }).eq("id", order.id);

    return json({
      preference_id: mp.id,
      init_point: mp.init_point,
      sandbox_init_point: mp.sandbox_init_point ?? null,
    });
  } catch (e) {
    console.error("mp-criar-preferencia:", e);
    return json({ error: "Erro inesperado ao iniciar o pagamento" }, 500);
  }
});
