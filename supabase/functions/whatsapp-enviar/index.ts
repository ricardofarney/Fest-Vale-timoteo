// Envia uma mensagem de WhatsApp escrita por alguém da organização, pelo painel.
//
// Três coisas acontecem junto com o envio:
//   1. A mensagem sai com o nome de quem escreveu na frente — com vários
//      voluntários no mesmo número, quem lê precisa saber com quem fala.
//   2. A IA para de responder aquela conversa por 12 horas, para não falar
//      por cima da pessoa.
//   3. Fica registrado como enviada por gente, não pela IA.
//
// A Meta só aceita mensagem livre dentro de 24 horas desde a última mensagem
// da pessoa. Fora disso ela recusa, e devolvemos o motivo em português.
import { createClient } from "jsr:@supabase/supabase-js@2";

const GRAPH = "https://graph.facebook.com/v21.0";
const HORAS_SILENCIO = 12;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

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

    const { contato_id, texto } = await req.json().catch(() => ({}));
    if (!contato_id || !String(texto ?? "").trim()) {
      return json({ error: "Informe a conversa e o texto." }, 400);
    }
    const corpo = String(texto).trim().slice(0, 3500);

    const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: contato } = await admin
      .from("wa_contatos")
      .select("id, event_id, wa_id, bloqueado")
      .eq("id", contato_id)
      .single();
    if (!contato) return json({ error: "Conversa não encontrada" }, 404);

    const { data: pode } = await admin.rpc("pode_gerenciar_evento", {
      _event_id: contato.event_id,
      _user_id: u.user.id,
    });
    if (pode !== true) return json({ error: "Sem permissão para responder neste evento." }, 403);
    if (contato.bloqueado) return json({ error: "Este contato está bloqueado." }, 409);

    // Nome de quem está respondendo, para assinar a mensagem
    const { data: perfil } = await admin
      .from("profiles").select("name").eq("id", u.user.id).maybeSingle();
    const nome = (perfil?.name ?? u.user.email ?? "").split(" ")[0].trim();
    const assinado = nome ? `*${nome}:*\n${corpo}` : corpo;

    const token = Deno.env.get("WHATSAPP_TOKEN");
    const phoneId = Deno.env.get("WHATSAPP_PHONE_ID");
    if (!token || !phoneId) {
      return json({ error: "O WhatsApp ainda não está conectado. Configure as chaves em Integrações." }, 503);
    }

    const r = await fetch(`${GRAPH}/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: contato.wa_id,
        type: "text",
        text: { preview_url: true, body: assinado },
      }),
    });
    const resposta = await r.json().catch(() => ({}));

    if (!r.ok) {
      const codigo = resposta?.error?.code;
      // 131047 = fora da janela de 24 horas
      const amigavel = codigo === 131047
        ? "Passaram mais de 24 horas desde a última mensagem dessa pessoa. " +
          "Pelas regras da Meta, só dá para responder se ela escrever de novo."
        : resposta?.error?.message ?? "A Meta recusou o envio.";

      await admin.from("wa_mensagens").insert({
        contato_id: contato.id, direcao: "enviada", texto: corpo, por_ia: false, erro: amigavel,
      });
      return json({ error: amigavel }, 502);
    }

    // Registra e tira a IA da conversa
    await admin.from("wa_mensagens").insert({
      contato_id: contato.id,
      direcao: "enviada",
      texto: assinado,
      por_ia: false,
      meta_msg_id: resposta?.messages?.[0]?.id ?? null,
    });

    await admin.from("wa_contatos").update({
      humano_assumiu: true,
      humano_ate: new Date(Date.now() + HORAS_SILENCIO * 3600_000).toISOString(),
    }).eq("id", contato.id);

    return json({ status: "ok", texto: assinado });
  } catch (e) {
    console.error("whatsapp-enviar:", e);
    return json({ error: "Erro inesperado ao enviar." }, 500);
  }
});
