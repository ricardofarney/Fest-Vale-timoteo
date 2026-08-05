// Cria um acesso da equipe para um evento, com cargo definido.
//
// Cargos:
//   organizador — tudo do evento: usuários, produtos, estoque, sangria, cortesia, relatórios
//   caixa       — vende no PDV (produtos e ingresso na portaria) e entrega no balcão
//   portaria    — lê o QR dos ingressos na entrada
//
// Quem pode chamar: master, dono do evento ou quem tem cargo de organizador nele.
// O usuário master nunca pode ser alterado por ninguém.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

const CARGOS = ["organizador", "caixa", "portaria"] as const;
type Cargo = (typeof CARGOS)[number];

/** Senha curta, fácil de ditar e digitar no celular, sem caracteres ambíguos. */
function gerarSenha(): string {
  const alfabeto = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  const s = Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join("");
  return `${s.slice(0, 5)}-${s.slice(5)}`;
}

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

    const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const body = await req.json().catch(() => ({}));
    const event_id = String(body.event_id ?? "");
    const nome = String(body.nome ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const cargo = String(body.cargo ?? "portaria") as Cargo;

    if (!event_id || !nome || !email) return json({ error: "Informe evento, nome e e-mail." }, 400);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "E-mail inválido." }, 400);
    if (!CARGOS.includes(cargo)) return json({ error: "Cargo inválido." }, 400);

    const { data: ev } = await admin.from("events").select("id, name").eq("id", event_id).single();
    if (!ev) return json({ error: "Evento não encontrado" }, 404);

    // Quem pode gerenciar este evento? A regra mora no banco, não aqui.
    const { data: podeGerenciar } = await admin.rpc("pode_gerenciar_evento", {
      _event_id: event_id,
      _user_id: u.user.id,
    });
    if (podeGerenciar !== true) {
      return json({ error: "Você não tem permissão para criar acessos neste evento." }, 403);
    }

    // Reaproveita a conta se o e-mail já existir
    let userId: string | null = null;
    let senha: string | null = gerarSenha();
    let contaNova = true;

    const { data: criado, error: erroCriar } = await admin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true,
      user_metadata: { name: nome },
    });

    if (erroCriar) {
      const jaExiste =
        erroCriar.status === 422 ||
        /already/i.test(erroCriar.message ?? "") ||
        /registered/i.test(erroCriar.message ?? "");
      if (!jaExiste) {
        console.error("equipe-criar:", erroCriar);
        return json({ error: "Não consegui criar o acesso.", detalhe: erroCriar.message }, 500);
      }
      const { data: lista } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      userId = lista?.users.find((x) => (x.email ?? "").toLowerCase() === email)?.id ?? null;
      senha = null;
      contaNova = false;
      if (!userId) return json({ error: "E-mail já cadastrado, mas não localizei a conta." }, 409);
    } else {
      userId = criado.user!.id;
    }

    // O master é intocável, mesmo para outro organizador
    const { data: alvoEhMaster } = await admin.rpc("is_master", { _user_id: userId });
    if (alvoEhMaster === true && userId !== u.user.id) {
      return json({ error: "Esse usuário é o dono do sistema e não pode ser alterado." }, 403);
    }

    // Papel global: define o que aparece no menu do site
    const papelGlobal = cargo === "organizador" ? "organizer" : cargo === "caixa" ? "caixa" : "staff";
    const { data: papel } = await admin
      .from("user_roles").select("id").eq("user_id", userId).eq("role", papelGlobal).maybeSingle();
    if (!papel) await admin.from("user_roles").insert({ user_id: userId, role: papelGlobal });

    // Vínculo com o evento — o gatilho do banco preenche as permissões pelo cargo
    const { error: erroVinculo } = await admin
      .from("event_staff")
      .upsert({ event_id, user_id: userId, name: nome, email, cargo, created_by: u.user.id },
              { onConflict: "event_id,user_id" });
    if (erroVinculo) {
      console.error("equipe-criar vinculo:", erroVinculo);
      return json({ error: "Acesso criado, mas não consegui vincular ao evento." }, 500);
    }

    return json({ status: "ok", email, senha, cargo, conta_nova: contaNova, evento: ev.name });
  } catch (e) {
    console.error("equipe-criar:", e);
    return json({ error: "Erro inesperado ao criar o acesso." }, 500);
  }
});
