// Gera uma nova senha para um membro da equipe de portaria.
// Útil no dia do evento, quando alguém esquece a senha.
// Só o organizador do evento pode chamar.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

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
    const staff_id = String(body.staff_id ?? "");
    if (!staff_id) return json({ error: "staff_id é obrigatório" }, 400);

    const { data: vinculo } = await admin
      .from("event_staff")
      .select("id, user_id, email, event_id, events(organizer_id)")
      .eq("id", staff_id)
      .single();
    if (!vinculo) return json({ error: "Acesso não encontrado" }, 404);

    const organizerId = (vinculo.events as { organizer_id?: string } | null)?.organizer_id;
    if (organizerId !== u.user.id) return json({ error: "Só o organizador do evento pode fazer isso." }, 403);

    const senha = gerarSenha();
    const { error } = await admin.auth.admin.updateUserById(vinculo.user_id, { password: senha });
    if (error) {
      console.error("equipe-senha:", error);
      return json({ error: "Não consegui trocar a senha." }, 500);
    }

    return json({ status: "ok", email: vinculo.email, senha });
  } catch (e) {
    console.error("equipe-senha:", e);
    return json({ error: "Erro inesperado." }, 500);
  }
});
