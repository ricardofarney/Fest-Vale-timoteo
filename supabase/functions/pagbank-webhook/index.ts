// Webhook do PagBank: recebe a notificação de pagamento e libera os ingressos.
//
// Chamado pelo PagBank, não pelo site: roda sem JWT.
//
// COMO A AUTENTICIDADE É CONFERIDA, em duas camadas:
//
// 1. O cabeçalho x-authenticity-token, que é o SHA-256 de "{token}-{payload}".
//    Só o PagBank consegue produzir esse valor, porque só ele e nós conhecemos
//    o token da conta. Se vier e não bater, a notificação é recusada.
//
// 2. Se o cabeçalho NÃO vier, a notificação sozinha não vale nada — qualquer um
//    poderia forjar um "PAID". Nesse caso perguntamos ao próprio PagBank, pela
//    API autenticada, qual é o estado real daquele pedido. Só o que a API
//    responde é levado em conta.
//
//    Isto não é teoria: no primeiro pagamento de teste (30/09/2026) o sandbox
//    entregou a notificação SEM o cabeçalho. Se em produção acontecer o mesmo,
//    a camada 2 é o que evita que todo pagamento seja recusado e ninguém receba
//    o ingresso.
//
// O corpo é lido CRU, como texto, antes de qualquer JSON.parse: reserializar o
// JSON muda os espaços e quebraria a conferência da camada 1.
//
// O corpo traz nome, e-mail, CPF e telefone do comprador. Nada disso é gravado
// nem registrado em log — usamos apenas o reference_id e o status da cobrança.
//
// Segredos: PAGBANK_TOKEN, PAGBANK_AMBIENTE, INTERNAL_KEY
import { createClient } from "jsr:@supabase/supabase-js@2";

const ok = () => new Response(JSON.stringify({ received: true }), {
  status: 200,
  headers: { "Content-Type": "application/json" },
});

const negado = () => new Response(JSON.stringify({ error: "assinatura inválida" }), {
  status: 401,
  headers: { "Content-Type": "application/json" },
});

/** Lê um segredo tolerando colagem desastrada.
 *  É comum colar o NOME junto com o VALOR no painel do Supabase. Quando isso
 *  acontece o valor vira "NOME\nvalor" e vai para um cabeçalho HTTP, que não
 *  aceita quebra de linha — o erro que aparece é um TypeError obscuro.
 *  Aqui pegamos a última linha não vazia e avisamos no log. */
function segredo(nome: string): string {
  const cru = Deno.env.get(nome) ?? "";
  const linhas = cru.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);
  if (linhas.length > 1) {
    console.warn(`${nome}: o valor tem mais de uma linha — usando a última. ` +
      `Provavelmente o nome foi colado junto com o valor no painel do Supabase.`);
  }
  return linhas.length ? linhas[linhas.length - 1] : "";
}

const ehSandbox = () => {
  const amb = (segredo("PAGBANK_AMBIENTE") || "sandbox").toLowerCase();
  return !(amb === "producao" || amb === "produção" || amb === "production");
};

const baseApi = () =>
  ehSandbox() ? "https://sandbox.api.pagseguro.com" : "https://api.pagseguro.com";

async function sha256Hex(texto: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Comparação de tempo constante, para não vazar o hash por tempo de resposta. */
function igual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

type Pagamento = { referencia: string | null; status: string; txId: string | null; meio: string };

/** Formato confirmado no primeiro pagamento real (sandbox, 30/09/2026):
 *  reference_id na raiz e a cobrança em charges[0]. */
function lerPedido(p: Record<string, unknown>): Pagamento {
  const charges = (p.charges ?? []) as Array<Record<string, unknown>>;
  const c = charges[0];
  const referencia =
    (typeof p.reference_id === "string" && p.reference_id) ||
    (c && typeof c.reference_id === "string" ? c.reference_id : null) ||
    null;

  if (c) {
    const pm = (c.payment_method ?? {}) as Record<string, unknown>;
    return {
      referencia,
      status: String(c.status ?? "").toUpperCase(),
      txId: typeof c.id === "string" ? c.id : null,
      meio: String(pm.type ?? "pagbank").toLowerCase(),
    };
  }
  return {
    referencia,
    status: String(p.status ?? "").toUpperCase(),
    txId: null,
    meio: "pagbank",
  };
}

Deno.serve(async (req) => {
  // O PagBank reenvia a notificação se não receber 200 rapidamente.
  // Por isso todo caminho de erro previsível também responde 200.
  try {
    const TOKEN = segredo("PAGBANK_TOKEN");
    if (!TOKEN) {
      console.error("webhook: PAGBANK_TOKEN ausente");
      return ok();
    }
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const cru = await req.text();
    const enviado = (req.headers.get("x-authenticity-token") ?? "").trim().toLowerCase();

    let payload: Record<string, unknown> = {};
    try { payload = JSON.parse(cru); } catch { return ok(); }

    const pedidoPagBank = typeof payload.id === "string" ? payload.id : null;
    let dados = lerPedido(payload);

    // ---------------------------------------------- camada 1: assinatura
    let assinado = false;
    if (enviado) {
      const esperado = await sha256Hex(`${TOKEN}-${cru}`);
      if (!igual(esperado, enviado)) {
        console.error("webhook: assinatura não confere — descartado");
        return negado();
      }
      assinado = true;
    }

    // ------------------------------- camada 2: perguntar ao próprio PagBank
    if (!assinado) {
      if (!pedidoPagBank) {
        console.error("webhook: sem assinatura e sem id do pedido — descartado");
        return negado();
      }
      const r = await fetch(`${baseApi()}/orders/${pedidoPagBank}`, {
        headers: { Authorization: `Bearer ${TOKEN}`, accept: "application/json" },
      });
      if (!r.ok) {
        // Não confirmamos nada com base num corpo que não foi verificado.
        console.error(`webhook: não consegui confirmar ${pedidoPagBank} na API (${r.status})`);
        return ok();
      }
      const oficial = await r.json().catch(() => ({}));
      dados = lerPedido(oficial as Record<string, unknown>);
      console.log("webhook: notificação sem assinatura — conferida na API do PagBank");
    }

    const orderId = dados.referencia;
    if (!orderId) {
      console.warn("webhook: notificação sem reference_id");
      return ok();
    }

    // Log sem dado do comprador: só o que é nosso e o estado do pagamento.
    console.log(
      `webhook: pedido ${orderId} — ${dados.status} — ${dados.meio}` +
      `${assinado ? " (assinado)" : " (verificado na API)"}`,
    );

    if (dados.status !== "PAID") {
      if ((dados.status === "CANCELED" || dados.status === "DECLINED") && dados.txId) {
        await admin.from("orders").update({ payment_tx_id: dados.txId })
          .eq("id", orderId).eq("status", "pending");
      }
      return ok();
    }

    // confirm_order_paid_admin é idempotente: o PagBank repete a notificação
    const { data: resultado, error } = await admin.rpc("confirm_order_paid_admin", {
      _order_id: orderId,
      _payment_method: dados.meio,
      _payment_id: dados.txId ?? orderId,
    });
    if (error) {
      console.error("webhook: confirm_order_paid_admin", error);
      return ok();
    }
    console.log("webhook: pedido confirmado", orderId, resultado);

    // Dispara o e-mail do ingresso sem segurar a resposta ao PagBank
    const internalKey = segredo("INTERNAL_KEY");
    if (internalKey) {
      fetch(`${SUPABASE_URL}/functions/v1/enviar-ingresso`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-internal-key": internalKey },
        body: JSON.stringify({ order_id: orderId }),
      }).catch((e) => console.error("webhook: falha ao chamar enviar-ingresso", e));
    } else {
      console.warn("webhook: INTERNAL_KEY não configurado — e-mail não enviado");
    }

    return ok();
  } catch (e) {
    console.error("pagbank-webhook:", e);
    return ok();
  }
});
