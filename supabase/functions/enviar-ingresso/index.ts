// Envia por e-mail os ingressos de um pedido pago, com o QR Code de cada um.
//
// Chamado pelo webhook do Mercado Pago (cabeçalho x-internal-key) ou pelo
// painel do organizador para reenviar (Authorization do usuário organizador).
//
// Segredos: BREVO_API_KEY, INTERNAL_KEY, EMAIL_REMETENTE, EMAIL_REMETENTE_NOME, SITE_URL
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
    if (!BREVO_API_KEY) return json({ error: "BREVO_API_KEY não configurado no Supabase." }, 503);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SITE_URL = (Deno.env.get("SITE_URL") ?? "https://www.festvaletimoteo.com.br").replace(/\/$/, "");
    const REMETENTE = Deno.env.get("EMAIL_REMETENTE") ?? "ingresso@festvaletimoteo.com.br";
    const REMETENTE_NOME = Deno.env.get("EMAIL_REMETENTE_NOME") ?? "Fest Vale Timóteo";

    const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { order_id, reenviar } = await req.json().catch(() => ({}));
    if (!order_id) return json({ error: "order_id é obrigatório" }, 400);

    // Autorização: chave interna (webhook) ou organizador do evento
    const internalKey = Deno.env.get("INTERNAL_KEY");
    const veioDoWebhook = !!internalKey && req.headers.get("x-internal-key") === internalKey;

    const { data: order } = await admin
      .from("orders")
      .select("id, event_id, buyer_id, buyer_name, buyer_email, total_cents, status, paid_at")
      .eq("id", order_id)
      .single();
    if (!order) return json({ error: "Pedido não encontrado" }, 404);

    if (!veioDoWebhook) {
      const authHeader = req.headers.get("Authorization") ?? "";
      if (!authHeader.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);
      const asUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: u } = await asUser.auth.getUser();
      if (!u?.user) return json({ error: "Sessão inválida" }, 401);
      const { data: ev } = await admin.from("events").select("organizer_id").eq("id", order.event_id).single();
      const ehOrganizador = ev?.organizer_id === u.user.id;
      const ehComprador = order.buyer_id === u.user.id;
      if (!ehOrganizador && !ehComprador) return json({ error: "Sem permissão" }, 403);
    }

    if (order.status !== "paid") return json({ error: "Pedido ainda não está pago" }, 409);

    const destino = order.buyer_email;
    if (!destino) return json({ error: "Pedido sem e-mail de contato" }, 400);

    // Não reenviar sozinho: o webhook do MP repete a notificação
    if (!reenviar) {
      const { data: jaEnviado } = await admin
        .from("ticket_emails")
        .select("id")
        .eq("order_id", order.id)
        .eq("status", "sent")
        .maybeSingle();
      if (jaEnviado) return json({ status: "ja_enviado" });
    }

    const { data: ev } = await admin
      .from("events")
      .select("name, starts_at, venue, address")
      .eq("id", order.event_id)
      .single();

    const { data: tickets } = await admin
      .from("tickets")
      .select("id, attendee_name, qr_token, status, ticket_batches(name, ticket_types(name))")
      .eq("order_id", order.id)
      .order("created_at", { ascending: true });

    if (!tickets?.length) return json({ error: "Pedido sem ingressos gerados" }, 409);

    const blocos = tickets.map((t: Record<string, unknown>, i: number) => {
      const batch = t.ticket_batches as { name?: string; ticket_types?: { name?: string } } | null;
      const tipo = batch?.ticket_types?.name ?? "Ingresso";
      const lote = batch?.name ?? "";
      const nome = (t.attendee_name as string) || order.buyer_name || "Participante";
      const qrUrl = `${SUPABASE_URL}/functions/v1/qr?t=${t.qr_token}&s=320`;
      return `
      <tr><td style="padding:0 0 18px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="border:1px solid #e6e6e6;border-radius:14px;background:#ffffff;">
          <tr>
            <td style="padding:22px 22px 8px 22px;">
              <div style="font:600 11px/1.2 Arial,sans-serif;letter-spacing:1px;color:#c2410c;text-transform:uppercase;">
                Ingresso ${i + 1} de ${tickets.length}
              </div>
              <div style="font:700 22px/1.3 Arial,sans-serif;color:#111111;margin-top:6px;">${esc(nome)}</div>
              <div style="font:400 14px/1.5 Arial,sans-serif;color:#555555;margin-top:2px;">
                ${esc(tipo)}${lote ? ` &middot; ${esc(lote)}` : ""}
              </div>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:6px 22px 4px 22px;">
              <img src="${qrUrl}" width="220" height="220" alt="QR Code do ingresso"
                   style="display:block;border:0;width:220px;height:220px;" />
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 22px 20px 22px;">
              <div style="font:400 12px/1.5 Arial,sans-serif;color:#888888;">
                Código: ${esc(String(t.qr_token))}
              </div>
            </td>
          </tr>
        </table>
      </td></tr>`;
    }).join("");

    const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Seu ingresso — ${esc(ev?.name ?? "Fest Vale")}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;">
<tr><td align="center" style="padding:26px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

    <tr><td align="center" style="padding-bottom:20px;">
      <div style="font:700 24px/1.2 Arial,sans-serif;color:#111111;">${esc(ev?.name ?? "Fest Vale Timóteo")}</div>
      <div style="font:400 14px/1.6 Arial,sans-serif;color:#555555;margin-top:6px;">
        ${ev?.starts_at ? esc(dataHora(ev.starts_at)) : ""}${ev?.venue ? ` &middot; ${esc(ev.venue)}` : ""}
      </div>
    </td></tr>

    <tr><td style="padding:0 0 18px 0;">
      <div style="font:400 15px/1.6 Arial,sans-serif;color:#333333;">
        Olá${order.buyer_name ? `, ${esc(order.buyer_name)}` : ""}! Seu pagamento foi confirmado
        e ${tickets.length > 1 ? "seus ingressos estão" : "seu ingresso está"} logo abaixo.
        Apresente o QR Code na entrada — pode ser direto na tela do celular.
      </div>
    </td></tr>

    ${blocos}

    <tr><td align="center" style="padding:4px 0 22px 0;">
      <a href="${SITE_URL}/meus-ingressos"
         style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;
                font:600 15px/1 Arial,sans-serif;padding:14px 26px;border-radius:10px;">
        Ver meus ingressos no site
      </a>
    </td></tr>

    <tr><td style="padding:16px 4px 0 4px;border-top:1px solid #e0e0e0;">
      <div style="font:400 12px/1.7 Arial,sans-serif;color:#8a8a8a;">
        Pedido ${esc(String(order.id).slice(0, 8))} &middot; ${esc(brl(order.total_cents))} &middot; pago pelo Mercado Pago.<br>
        Cada QR Code vale uma entrada e é lido uma única vez. Guarde este e-mail.<br>
        ${ev?.address ? `${esc(ev.address)}<br>` : ""}
        Dúvidas? Responda esta mensagem.
      </div>
    </td></tr>

  </table>
</td></tr></table>
</body></html>`;

    const texto = [
      `${ev?.name ?? "Fest Vale Timóteo"} — pagamento confirmado`,
      ev?.starts_at ? dataHora(ev.starts_at) : "",
      ev?.venue ?? "",
      "",
      ...tickets.map((t: Record<string, unknown>, i: number) =>
        `Ingresso ${i + 1}: ${(t.attendee_name as string) || order.buyer_name || "Participante"} — código ${t.qr_token}`),
      "",
      `Veja os QR Codes em ${SITE_URL}/meus-ingressos`,
    ].join("\n");

    const envio = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: { email: REMETENTE, name: REMETENTE_NOME },
        replyTo: { email: REMETENTE, name: REMETENTE_NOME },
        to: [{ email: destino, name: order.buyer_name ?? undefined }],
        subject: `Seu ingresso — ${ev?.name ?? "Fest Vale Timóteo"}`,
        htmlContent: html,
        textContent: texto,
        tags: ["ingresso"],
      }),
    });

    const respBrevo = await envio.json().catch(() => ({}));

    if (!envio.ok) {
      console.error("brevo:", envio.status, respBrevo);
      await admin.from("ticket_emails").insert({
        order_id: order.id,
        to_email: destino,
        status: "error",
        error: JSON.stringify(respBrevo).slice(0, 500),
      });
      return json({ error: "Falha ao enviar o e-mail", detalhe: respBrevo?.message ?? null }, 502);
    }

    await admin.from("ticket_emails").insert({
      order_id: order.id,
      to_email: destino,
      provider_message_id: respBrevo?.messageId ?? null,
      status: "sent",
    });

    return json({ status: "enviado", ingressos: tickets.length, para: destino });
  } catch (e) {
    console.error("enviar-ingresso:", e);
    return json({ error: "Erro inesperado ao enviar o e-mail" }, 500);
  }
});
