import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

/**
 * Descobre o que a pessoa logada pode fazer.
 * - organizador: tem pelo menos um evento próprio
 * - portaria: foi vinculada por um organizador para validar QR em algum evento
 */
export function usePapeis() {
  const { user, loading: carregandoAuth } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["papeis", user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [eventos, equipe] = await Promise.all([
        supabase.from("events").select("id").eq("organizer_id", user!.id).limit(1),
        supabase.from("event_staff").select("event_id").eq("user_id", user!.id).limit(1),
      ]);
      return {
        organizador: (eventos.data?.length ?? 0) > 0,
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
