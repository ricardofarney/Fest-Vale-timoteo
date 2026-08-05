import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QrCanvas } from "@/components/qr-canvas";
import { fmtDateTime } from "@/lib/format";
import { Ticket, Calendar, MapPin, CheckCircle2, Ban } from "lucide-react";

export const Route = createFileRoute("/_authenticated/meus-ingressos")({
  head: () => ({ meta: [{ title: "Meus ingressos — Fest Vale Timóteo" }] }),
  component: MyTickets,
});

function MyTickets() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["my-tickets", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select(
          "id, qr_token, status, attendee_name, checked_in_at, ticket_batches(name, ticket_types(name)), orders!inner(buyer_id, events(name, venue, starts_at))",
        )
        .eq("orders.buyer_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <div className="container mx-auto px-4 py-16">Carregando...</div>;

  if (!data?.length) {
    return (
      <div className="container mx-auto max-w-xl px-4 py-16 text-center">
        <Ticket className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h1 className="font-display text-2xl font-bold">Você ainda não tem ingressos</h1>
        <p className="mt-2 text-sm text-muted-foreground">Explore os próximos eventos e garanta o seu.</p>
        <Button asChild className="mt-6"><Link to="/">Ver eventos</Link></Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold">Meus ingressos</h1>
      <p className="mt-1 text-sm text-muted-foreground">Apresente o QR Code abaixo na entrada do evento.</p>

      <div className="mt-8 space-y-6">
        {data.map((t: any) => {
          const used = t.status === "checked_in";
          const cancelled = t.status === "cancelled";
          return (
            <Card key={t.id} className={`overflow-hidden ${cancelled ? "opacity-60" : ""}`}>
              <div className="grid gap-6 p-6 sm:grid-cols-[auto_1fr]">
                <div className="grid place-items-center rounded-xl bg-background/60 p-4">
                  {cancelled ? (
                    <div className="grid h-[220px] w-[220px] place-items-center text-destructive"><Ban className="h-12 w-12" /></div>
                  ) : (
                    <QrCanvas value={t.qr_token} />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs ${used ? "bg-success/20 text-success" : cancelled ? "bg-destructive/20 text-destructive" : "bg-primary/20 text-primary"}`}>
                      {used && <CheckCircle2 className="h-3 w-3" />}
                      {used ? "Utilizado" : cancelled ? "Cancelado" : "Válido"}
                    </span>
                    <span className="rounded bg-secondary px-2 py-0.5 text-xs">{t.ticket_batches?.ticket_types?.name} — {t.ticket_batches?.name}</span>
                  </div>
                  <h2 className="mt-2 font-display text-xl font-bold">{t.orders.events.name}</h2>
                  <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2"><Calendar className="h-4 w-4" />{fmtDateTime(t.orders.events.starts_at)}</div>
                    {t.orders.events.venue && <div className="flex items-center gap-2"><MapPin className="h-4 w-4" />{t.orders.events.venue}</div>}
                  </div>
                  {t.attendee_name && (
                    <p className="mt-3 text-sm"><span className="text-muted-foreground">Em nome de </span><span className="font-medium">{t.attendee_name}</span></p>
                  )}
                  <p className="mt-4 break-all font-mono text-[10px] text-muted-foreground">#{t.qr_token}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
