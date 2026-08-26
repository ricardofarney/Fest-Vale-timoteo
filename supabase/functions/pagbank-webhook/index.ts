// Webhook do PagBank: recebe a notificação de pagamento e libera os ingressos.
//
// Chamado pelo PagBank, não pelo site: roda sem JWT.
// A autenticidade vem do cabeçalho x-authenticity-token, que é o SHA-256 de
// "{token}-{payload}" — conforme a documentação de "Confirmar autenticidade da
// notificação". Só o PagBank consegue produzir esse valor, porque só ele e nós
// conhecemos o token da conta.
//
// IMPORTANTE: o corpo precisa ser lido CRU, como texto, antes de qualquer
// JSON.parse. Reserializar o JSON muda os espaços e quebra a conferência.
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

const ehSandbox = () => {
  const amb = (Deno.env.get("PAGBANK_AMBIENTE") ?? "sandbox").trim().toLowerCase();
  return !(amb === "producao" || amb === "produção" || amb === "production");
};

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

/** Procura o id do nosso pedido em qualquer nível conhecido do payload. */
function acharReferencia(p: Record<string, unknown>): string | null {
  const direto = p.reference_id ?? (p.order as Record<string, unknown> | undefined)?.reference_id;
  if (typeof direto === "string" && direto) return direto;
  const charges = (p.charges ?? []) as Array<Record<string, unknown>>;
  for (const c of charges) {
    if (typeof c.reference_id === "string" && c.reference_id) return c.reference_id;
  }
  return null;
}

/** Procura o status do pagamento e o id da transação. */
function acharPagamento(p: Record<string, unknown>): { status: string; txId: string | null; meio: string } {
  const charges = (p.charges ?? []) as Array<Record<string, unknown>>;
  const c = charges[0];
  if (c) {
    const pm = (c.payment_method ?? {}) as Record<string, unknown>;
    return {
      status: String(c.status ?? "").toUpperCase(),
      txId: typeof c.id === "string" ? c.id : null,
      meio: String(pm.type ?? "pagbank").toLowerCase(),
    };
  }
  return {
    status: String(p.status ?? "").toUpperCase(),
    txId: typeof p.id === "string" ? p.id : null,
    meio: "pagbank",
  };
}

Deno.serve(async (req) => {
  // O PagBank reenvia a notificação se não receber 200 rapidamente.
  // Por isso todo caminho de erro previsível também responde 200.
  try {
    const TOKEN = Deno.env.get("PAGBANK_TOKEN");
    if (!TOKEN) {
      console.error("webhook: PAGBANK_TOKEN ausente");
      return ok();
    }
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const cru = await req.text();
    const enviado = (req.headers.get("x-authenticity-token") ?? "").trim().toLowerCase();

    if (enviado) {
      const esperado = await sha256Hex(`${TOKEN}-${cru}`);
      if (!igual(esperado, enviado)) {
        console.error("webhook: assinatura não confere");
        return negado();
      }
    } else if (ehSandbox()) {
      // Há relato oficial de o cabeçalho não ser enviado em sandbox.
      // Aceitamos sem assinatura SOMENTE em sandbox, e deixamos registrado.
      console.warn("webhook: sem x-authenticity-token — aceito por estar em sandbox");
    } else {
      console.error("webhook: notificação de produção sem x-authenticity-token — recusada");
      return negado();
    }

    // Enquanto a integração está sendo validada, registrar o corpo ajuda a
    // ajustar a leitura ao formato real que o PagBank envia.
    console.log("webhook pagbank:", cru.slice(0, 2000));

    let payload: Record<string, unknown> = {};
    try { payload = JSON.parse(cru); } catch { return ok(); }

    const orderId = acharReferencia(payload);
    if (!orderId) {
      console.warn("webhook: notificação sem reference_id");
      return ok();
    }

    const { status, txId, meio } = acharPagamento(payload);

    if (status !== "PAID") {
      console.log(`webhook: pedido ${orderId} está ${status || "sem status"}`);
      if ((status === "CANCELED" || status === "DECLINED") && txId) {
        await admin.from("orders").update({ payment_tx_id: txId })
          .eq("id", orderId).eq("status", "pending");
      }
      return ok();
    }

    // confirm_order_paid_admin é idempotente: o PagBank repete a notificação
    const { data: resultado, error } = await admin.rpc("confirm_order_paid_admin", {
      _order_id: orderId,
      _payment_method: meio,
      _payment_id: txId ?? orderId,
    });
    if (error) {
      console.error("webhook: confirm_order_paid_admin", error);
      return ok();
    }
    console.log("webhook: pedido confirmado", orderId, resultado);

    // Dispara o e-mail do ingresso sem segurar a resposta ao PagBank
    const internalKey = Deno.env.get("INTERNAL_KEY");
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
