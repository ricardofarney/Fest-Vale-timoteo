// Cria um acesso de portaria para um evento.
// Só o organizador do evento pode chamar. A senha é gerada aqui e devolvida
// uma única vez, para o organizador entregar ao membro da equipe.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

/** Senha curta, fácil de ditar e de digitar no celular, sem caracteres ambíguos. */
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

    if (!event_id || !nome || !email) return json({ error: "Informe evento, nome e e-mail." }, 400);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "E-mail inválido." }, 400);

    const { data: ev } = await admin.from("events").select("id, name, organizer_id").eq("id", event_id).single();
    if (!ev) return json({ error: "Evento não encontrado" }, 404);
    if (ev.organizer_id !== u.user.id) return json({ error: "Só o organizador do evento pode criar acessos." }, 403);

    // Já existe alguém com esse e-mail? Reaproveita a conta em vez de duplicar.
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
      // Conta existente: mantém a senha atual da pessoa
      const { data: lista } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      userId = lista?.users.find((x) => (x.email ?? "").toLowerCase() === email)?.id ?? null;
      senha = null;
      contaNova = false;
      if (!userId) return json({ error: "E-mail já cadastrado, mas não localizei a conta." }, 409);
    } else {
      userId = criado.user!.id;
    }

    // Papel de portaria (a conta nasce como 'attendee' pelo gatilho do banco)
    const { data: papel } = await admin
      .from("user_roles").select("id").eq("user_id", userId).eq("role", "staff").maybeSingle();
    if (!papel) await admin.from("user_roles").insert({ user_id: userId, role: "staff" });

    const { error: erroVinculo } = await admin
      .from("event_staff")
      .upsert({ event_id, user_id: userId, name: nome, email, created_by: u.user.id },
              { onConflict: "event_id,user_id" });
    if (erroVinculo) {
      console.error("equipe-criar vinculo:", erroVinculo);
      return json({ error: "Acesso criado, mas não consegui vincular ao evento." }, 500);
    }

    return json({ status: "ok", email, senha, conta_nova: contaNova, evento: ev.name });
  } catch (e) {
    console.error("equipe-criar:", e);
    return json({ error: "Erro inesperado ao criar o acesso." }, 500);
  }
});
