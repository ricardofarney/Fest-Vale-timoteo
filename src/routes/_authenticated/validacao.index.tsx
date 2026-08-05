import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScanLine, Calendar } from "lucide-react";
import { fmtDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/validacao/")({
  head: () => ({ meta: [{ title: "Validação — Fest Vale Timóteo" }] }),
  component: ValidationHome,
});

function ValidationHome() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["validation-events", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // Eventos próprios (organizador) + eventos em que a pessoa é da portaria
      const [proprios, equipe] = await Promise.all([
        supabase
          .from("events")
          .select("id, name, slug, starts_at, venue, status")
          .eq("organizer_id", user!.id),
        supabase
          .from("event_staff")
          .select("events(id, name, slug, starts_at, venue, status)")
          .eq("user_id", user!.id),
      ]);
      if (proprios.error) throw proprios.error;

      type Ev = { id: string; name: string; slug: string; starts_at: string; venue: string | null; status: string };
      const porId = new Map<string, Ev>();
      for (const ev of (proprios.data ?? []) as Ev[]) porId.set(ev.id, ev);
      for (const linha of equipe.data ?? []) {
        const ev = (linha as { events: Ev | null }).events;
        if (ev) porId.set(ev.id, ev);
      }
      return [...porId.values()].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    },
  });

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">Validação na entrada</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Escolha um evento para abrir o leitor de QR pela câmera do celular. Funciona mesmo offline: as validações
        são sincronizadas automaticamente quando a conexão volta.
      </p>

      <div className="mt-8 space-y-3">
        {isLoading && <p className="text-muted-foreground">Carregando...</p>}
        {data?.length === 0 && (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">Nenhum evento disponível para validar.</p>
          </Card>
        )}
        {data?.map((ev) => (
          <Card key={ev.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <h3 className="truncate font-display text-lg font-semibold">{ev.name}</h3>
              <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />{fmtDateTime(ev.starts_at)}
                {ev.venue && <span>• {ev.venue}</span>}
              </div>
            </div>
            <Button asChild>
              <Link to="/validacao/$eventId/scanner" params={{ eventId: ev.id }}>
                <ScanLine className="mr-1 h-4 w-4" />Abrir scanner
              </Link>
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
