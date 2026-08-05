import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

/**
 * Descobre o que a pessoa logada pode fazer.
 * - organizador: tem o papel "organizer" ou já criou algum evento
 *   (o papel precisa contar sozinho, senão quem ainda não criou o primeiro
 *   evento nunca enxerga o painel para criá-lo)
 * - portaria: foi vinculada por um organizador para validar QR em algum evento
 */
export function usePapeis() {
  const { user, loading: carregandoAuth } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["papeis", user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [papel, eventos, equipe] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user!.id).eq("role", "organizer").limit(1),
        supabase.from("events").select("id").eq("organizer_id", user!.id).limit(1),
        supabase.from("event_staff").select("event_id").eq("user_id", user!.id).limit(1),
      ]);
      return {
        organizador: (papel.data?.length ?? 0) > 0 || (eventos.data?.length ?? 0) > 0,
        portaria: (equipe.data?.length ?? 0) > 0,
      };
    },
  });

  return {
    organizador: data?.organizador ?? false,
    portaria: data?.portaria ?? false,
    podeValidar: (data?.organizador ?? false) || (data?.portaria ?? false),
    loading: carregandoAuth || isLoading,
  };
}
