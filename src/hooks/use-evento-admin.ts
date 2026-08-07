import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { FEST } from "@/lib/fest";

/**
 * Descobre qual evento o painel administrativo deve mostrar.
 * Procura o evento oficial do Fest Vale pelo slug; se não achar, pega o
 * primeiro que a pessoa gerencia (próprio ou com cargo de organizador).
 */
export function useEventoAdmin() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["evento-admin", user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const campos = "id, name, slug, status, starts_at";

      const oficial = await supabase.from("events").select(campos).eq("slug", FEST.slug).maybeSingle();
      if (oficial.data) return oficial.data;

      const [proprios, equipe] = await Promise.all([
        supabase.from("events").select(campos).eq("organizer_id", user!.id).limit(1),
        supabase
          .from("event_staff")
          .select(`events(${campos})`)
          .eq("user_id", user!.id)
          .eq("cargo", "organizador")
          .limit(1),
      ]);

      if (proprios.data?.length) return proprios.data[0];
      const viaEquipe = (equipe.data?.[0] as unknown as { events: typeof oficial.data } | undefined)?.events;
      return viaEquipe ?? null;
    },
  });

  return { evento: data ?? null, loading: isLoading };
}
