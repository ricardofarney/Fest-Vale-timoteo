// Diz ao painel o que já está ligado e o que falta configurar.
//
// Devolve APENAS "sim/não" para cada chave — nenhum valor de segredo sai daqui,
// nem em pedaço. Só quem gerencia o evento consegue chamar.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

/** Só informa se existe e não está vazio. O valor nunca é devolvido. */
const tem = (nome: string) => (Deno.env.get(nome) ?? "").trim().length > 0;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);

    const asUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u } = await asUser.auth.getUser();
    if (!u?.user) return json({ error: "Sessão inválida" }, 401);

    const { event_id } = await req.json().catch(() => ({}));
    if (!event_id) return json({ error: "event_id é obrigatório" }, 400);

    const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: pode } = await admin.rpc("pode_gerenciar_evento", {
      _event_id: event_id,
      _user_id: u.user.id,
    });
    if (pode !== true) return json({ error: "Sem permissão" }, 403);

    const grupos = [
      {
        chave: "pagamento",
        nome: "Pagamento — PagBank",
        descricao: "Sem isto, a compra de ingresso pelo site não cobra de verdade.",
        itens: [
          { nome: "PAGBANK_TOKEN", rotulo: "Token da conta", ok: tem("PAGBANK_TOKEN") },
          { nome: "PAGBANK_AMBIENTE", rotulo: "Ambiente (sandbox/producao)", ok: tem("PAGBANK_AMBIENTE") },
          { nome: "SITE_URL", rotulo: "Endereço do site", ok: tem("SITE_URL"), opcional: true },
        ],
      },
      {
        chave: "email",
        nome: "E-mail do ingresso — Brevo",
        descricao: "Sem isto, o comprador não recebe o ingresso com o QR Code.",
        itens: [
          { nome: "BREVO_API_KEY", rotulo: "Chave da Brevo", ok: tem("BREVO_API_KEY") },
          { nome: "INTERNAL_KEY", rotulo: "Chave interna", ok: tem("INTERNAL_KEY") },
          { nome: "EMAIL_REMETENTE", rotulo: "Remetente", ok: tem("EMAIL_REMETENTE"), opcional: true },
        ],
      },
      {
        chave: "whatsapp",
        nome: "Atendimento por WhatsApp",
        descricao: "Sem isto, ninguém é atendido pelo WhatsApp.",
        itens: [
          { nome: "WHATSAPP_TOKEN", rotulo: "Token da Meta", ok: tem("WHATSAPP_TOKEN") },
          { nome: "WHATSAPP_PHONE_ID", rotulo: "ID do número", ok: tem("WHATSAPP_PHONE_ID") },
          { nome: "WHATSAPP_NUMERO", rotulo: "Número", ok: tem("WHATSAPP_NUMERO") },
          { nome: "WHATSAPP_VERIFY_TOKEN", rotulo: "Token de verificação", ok: tem("WHATSAPP_VERIFY_TOKEN") },
          { nome: "WHATSAPP_APP_SECRET", rotulo: "Segredo do app", ok: tem("WHATSAPP_APP_SECRET") },
          { nome: "WHATSAPP_EVENT_ID", rotulo: "Evento atendido", ok: tem("WHATSAPP_EVENT_ID") },
        ],
      },
      {
        chave: "ia",
        nome: "Inteligência artificial",
        descricao: "Sem isto, o WhatsApp recebe mas não responde.",
        itens: [{ nome: "ANTHROPIC_API_KEY", rotulo: "Chave do modelo", ok: tem("ANTHROPIC_API_KEY") }],
      },
    ];

    // Cada grupo fica pronto quando todos os itens obrigatórios existem
    const resultado = grupos.map((g) => ({
      ...g,
      pronto: g.itens.every((i) => i.ok || (i as { opcional?: boolean }).opcional),
      faltam: g.itens.filter((i) => !i.ok && !(i as { opcional?: boolean }).opcional).length,
    }));

    return json({
      grupos: resultado,
      webhooks: {
        pagbank: `${SUPABASE_URL}/functions/v1/pagbank-webhook`,
        whatsapp: `${SUPABASE_URL}/functions/v1/whatsapp-webhook`,
      },
      verificado_em: new Date().toISOString(),
    });
  } catch (e) {
    console.error("admin-status:", e);
    return json({ error: "Erro ao verificar as integrações." }, 500);
  }
});
