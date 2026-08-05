import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fmtDateTime } from "@/lib/format";
import { ShoppingCart, Boxes, ScanLine, BarChart3, Calendar, FlaskConical } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pdv/")({
  head: () => ({ meta: [{ title: "PDV — Fest Vale Timóteo" }] }),
  component: PdvHome,
});

function PdvHome() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["pdv-eventos", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [proprios, equipe] = await Promise.all([
        supabase.from("events").select("id, name, starts_at, venue").eq("organizer_id", user!.id),
        supabase.from("event_staff").select("events(id, name, starts_at, venue)").eq("user_id", user!.id),
      ]);
      type Ev = { id: string; name: string; starts_at: string; venue: string | null };
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
      <h1 className="font-display text-3xl font-bold">Ponto de venda</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Venda de bebida e comida no dia do evento, com controle de estoque, cortesia e relatório ao vivo.
      </p>

      <div className="mt-6 flex items-start gap-3 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3">
        <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-sm">
          <span className="font-semibold">Modo demonstração.</span> A maquininha ainda não está conectada:
          cartão e Pix registram a venda sem cobrar de verdade. Todo o resto — estoque, cortesia,
          ticket e relatório — já funciona de verdade.
        </p>
      </div>

      <div className="mt-8 space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}

        {data?.length === 0 && (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">Nenhum evento disponível.</p>
          </Card>
        )}

        {data?.map((ev) => (
          <Card key={ev.id} className="p-5">
            <h2 className="font-display text-xl font-semibold">{ev.name}</h2>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              {fmtDateTime(ev.starts_at)}
              {ev.venue && <span>• {ev.venue}</span>}
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <Button asChild size="lg" className="justify-start">
                <Link to="/pdv/$eventId/caixa" params={{ eventId: ev.id }}>
                  <ShoppingCart className="mr-2 h-5 w-5" />Abrir caixa
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="justify-start">
                <Link to="/pdv/$eventId/retirada" params={{ eventId: ev.id }}>
                  <ScanLine className="mr-2 h-5 w-5" />Balcão de retirada
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="justify-start">
                <Link to="/pdv/$eventId/estoque" params={{ eventId: ev.id }}>
                  <Boxes className="mr-2 h-5 w-5" />Estoque
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="justify-start">
                <Link to="/pdv/$eventId/relatorio" params={{ eventId: ev.id }}>
                  <BarChart3 className="mr-2 h-5 w-5" />Relatório ao vivo
                </Link>
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
