import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { fmtDateTime } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { Calendar, Edit, BarChart3, Plus, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/organizador/")({
  component: MyEvents,
});

function MyEvents() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["organizer-events", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, slug, name, status, starts_at, cover_url, venue")
        .eq("organizer_id", user!.id)
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="text-muted-foreground">Carregando...</div>;

  if (!data?.length) {
    return (
      <Card className="p-12 text-center">
        <Calendar className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h2 className="font-display text-xl font-semibold">Você ainda não tem eventos</h2>
        <p className="mt-2 text-sm text-muted-foreground">Crie seu primeiro evento para começar a vender ingressos.</p>
        <Button asChild className="mt-6"><Link to="/organizador/eventos/novo"><Plus className="mr-2 h-4 w-4" />Criar evento</Link></Button>
      </Card>
    );
  }

  return (
    <div className="grid gap-3">
      {data.map((ev) => (
        <Card key={ev.id} className="flex flex-col gap-4 p-4 md:flex-row md:items-center">
          <div className="h-20 w-32 shrink-0 overflow-hidden rounded-lg bg-muted">
            {ev.cover_url ? (
              <img src={ev.cover_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center text-2xl font-bold opacity-50">{ev.name[0]}</div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`rounded px-2 py-0.5 text-xs font-medium ${ev.status === "published" ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"}`}>
                {ev.status === "published" ? "Publicado" : "Rascunho"}
              </span>
            </div>
            <h3 className="mt-1 truncate font-display text-lg font-semibold">{ev.name}</h3>
            <p className="text-sm text-muted-foreground">{fmtDateTime(ev.starts_at)}{ev.venue ? ` • ${ev.venue}` : ""}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to="/organizador/eventos/$id/dashboard" params={{ id: ev.id }}><BarChart3 className="mr-1 h-4 w-4" />Dashboard</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/organizador/eventos/$id/equipe" params={{ id: ev.id }}><Users className="mr-1 h-4 w-4" />Equipe</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/organizador/eventos/$id/editar" params={{ id: ev.id }}><Edit className="mr-1 h-4 w-4" />Editar</Link>
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
