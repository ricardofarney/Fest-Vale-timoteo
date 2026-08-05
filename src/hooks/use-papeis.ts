import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

/**
 * Descobre o que a pessoa logada pode fazer.
 * - master: dono do sistema, pode tudo e ninguém mexe no cadastro dele
 * - organizador: papel "organizer", dono de algum evento, ou cargo de
 *   organizador em algum evento (o papel precisa contar sozinho, senão quem
 *   ainda não criou o primeiro evento nunca enxerga o painel para criá-lo)
 * - caixa: opera o PDV — produtos e ingresso na portaria
 * - portaria: valida o QR dos ingressos na entrada
 */
export function usePapeis() {
  const { user, loading: carregandoAuth } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["papeis", user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [papeis, eventos, equipe] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user!.id),
        supabase.from("events").select("id").eq("organizer_id", user!.id).limit(1),
        supabase.from("event_staff").select("event_id, cargo").eq("user_id", user!.id),
      ]);
      const lista = (papeis.data ?? []).map((p) => p.role as string);
      const cargos = (equipe.data ?? []).map((e) => e.cargo as string);
      const master = lista.includes("master");
      return {
        master,
        organizador:
          master || lista.includes("organizer") ||
          (eventos.data?.length ?? 0) > 0 || cargos.includes("organizador"),
        // Quem valida QR na entrada
        portaria: master || cargos.includes("portaria") || cargos.includes("organizador"),
        // Quem opera o PDV
        caixa: master || cargos.includes("caixa") || cargos.includes("organizador"),
      };
    },
  });

  return {
    master: data?.master ?? false,
    organizador: data?.organizador ?? false,
    portaria: data?.portaria ?? false,
    caixa: data?.caixa ?? false,
    podeValidar: (data?.organizador ?? false) || (data?.portaria ?? false),
    // Caixa e portaria entram no PDV; a portaria só usa o balcão de retirada
    podeUsarPdv: (data?.organizador ?? false) || (data?.caixa ?? false),
    loading: carregandoAuth || isLoading,
  };
}
