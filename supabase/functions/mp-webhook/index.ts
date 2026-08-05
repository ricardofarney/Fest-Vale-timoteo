// Webhook do Mercado Pago: recebe a notificação de pagamento, confere na API
// do MP se ele realmente foi aprovado e libera os ingressos do pedido.
//
// Chamado pelo Mercado Pago, não pelo site: por isso roda sem JWT.
// A autenticidade vem da assinatura x-signature (segredo MP_WEBHOOK_SECRET)
// somada à reconsulta do pagamento na API oficial.
//
// Segredos: MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET, INTERNAL_KEY
import { createClient } from "jsr:@supabase/supabase-js@2";

const ok = () => new Response(JSON.stringify({ received: true }), {
  status: 200,
  headers: { "Content-Type": "application/json" },
});

/** Confere a assinatura HMAC que o Mercado Pago envia no cabeçalho x-signature. */
async function assinaturaValida(req: Request, dataId: string, secret: string): Promise<boolean> {
  const sig = req.headers.get("x-signature") ?? "";
  const requestId = req.headers.get("x-request-id") ?? "";
  const partes = Object.fromEntries(
    sig.split(",").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    }),
  ) as Record<string, string>;

  const ts = partes["ts"];
  const v1 = partes["v1"];
  if (!ts || !v1) return false;

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest));
  const hex = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");

  // Comparação de tempo constante
  if (hex.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ v1.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  // O Mercado Pago reenvia a notificação se não receber 200 rapidamente.
  // Por isso todo caminho de erro previsível também responde 200.
  try {
    const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN");
    if (!MP_ACCESS_TOKEN) {
      console.error("webhook: MP_ACCESS_TOKEN ausente");
      return ok();
    }
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const url = new URL(req.url);
    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* notificação antiga vem só na query */ }

    const tipo = (body.type ?? body.topic ?? url.searchParams.get("type") ?? url.searchParams.get("topic")) as string;
    const dataId = String(
      (body.data as { id?: string } | undefined)?.id ??
        body["data.id"] ??
        url.searchParams.get("data.id") ??
        url.searchParams.get("id") ??
        "",
    );

    if (tipo !== "payment" || !dataId) return ok();

    const secret = Deno.env.get("MP_WEBHOOK_SECRET");
    if (secret) {
      if (!(await assinaturaValida(req, dataId, secret))) {
        console.error("webhook: assinatura inválida", dataId);
        return new Response(JSON.stringify({ error: "assinatura inválida" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
    } else {
      console.warn("webhook: MP_WEBHOOK_SECRET não configurado — assinatura não verificada");
    }

    // Fonte da verdade: a própria API do Mercado Pago, nunca o corpo da notificação
    const pagRes = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    });
    if (!pagRes.ok) {
      console.error("webhook: falha ao consultar pagamento", dataId, pagRes.status);
      return ok();
    }
    const pag = await pagRes.json();

    const orderId = pag.external_reference as string | null;
    if (!orderId) return ok();

    if (pag.status !== "approved") {
      console.log(`webhook: pagamento ${dataId} do pedido ${orderId} está ${pag.status}`);
      if (pag.status === "cancelled" || pag.status === "rejected") {
        await admin.from("orders").update({ mp_payment_id: String(dataId) }).eq("id", orderId).eq("status", "pending");
      }
      return ok();
    }

    // confirm_order_paid_admin é idempotente: o MP repete a mesma notificação
    const { data: resultado, error } = await admin.rpc("confirm_order_paid_admin", {
      _order_id: orderId,
      _payment_method: String(pag.payment_type_id ?? pag.payment_method_id ?? "mercadopago"),
      _payment_id: String(dataId),
    });
    if (error) {
      console.error("webhook: confirm_order_paid_admin", error);
      return ok();
    }
    console.log("webhook: pedido confirmado", orderId, resultado);

    // Dispara o e-mail do ingresso sem segurar a resposta ao Mercado Pago
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
    console.error("mp-webhook:", e);
    return ok();
  }
});
