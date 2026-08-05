import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar, MapPin, ArrowLeft, Minus, Plus } from "lucide-react";
import { brl, fmtDateTime } from "@/lib/format";
import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/eventos/$slug")({
  component: EventPage,
});

type Batch = {
  id: string;
  name: string;
  price_cents: number;
  quantity_total: number;
  quantity_sold: number;
  starts_at: string | null;
  ends_at: string | null;
  sort_order: number;
  ticket_type_id: string;
};
type TicketType = {
  id: string;
  name: string;
  description: string | null;
  is_half_price: boolean;
  is_solidary: boolean;
  sort_order: number;
  ticket_batches: Batch[];
};

async function fetchEventBySlug(slug: string) {
  const { data: ev, error } = await supabase
    .from("events")
    .select("id, slug, name, description, cover_url, venue, address, starts_at, ends_at, status")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!ev) return null;
  const { data: types } = await supabase
    .from("ticket_types")
    .select(
      "id, name, description, is_half_price, is_solidary, sort_order, ticket_batches(id, name, price_cents, quantity_total, quantity_sold, starts_at, ends_at, sort_order, ticket_type_id)",
    )
    .eq("event_id", ev.id)
    .order("sort_order");
  return { event: ev, types: (types ?? []) as TicketType[] };
}

function activeBatch(batches: Batch[]): Batch | null {
  const now = Date.now();
  const sorted = [...batches].sort((a, b) => a.sort_order - b.sort_order);
  for (const b of sorted) {
    const s = b.starts_at ? new Date(b.starts_at).getTime() : -Infinity;
    const e = b.ends_at ? new Date(b.ends_at).getTime() : Infinity;
    if (s <= now && now <= e && b.quantity_sold < b.quantity_total) return b;
  }
  return sorted.find((b) => b.quantity_sold < b.quantity_total) ?? null;
}

function EventPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ["event", slug], queryFn: () => fetchEventBySlug(slug) });
  const [qty, setQty] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  const batchInfo = useMemo(() => {
    const map: Record<string, { batch: Batch | null; type: TicketType }> = {};
    for (const t of data?.types ?? []) map[t.id] = { batch: activeBatch(t.ticket_batches), type: t };
    return map;
  }, [data]);

  const total = useMemo(() => {
    let sum = 0;
    for (const [typeId, q] of Object.entries(qty)) {
      const b = batchInfo[typeId]?.batch;
      if (b) sum += q * b.price_cents;
    }
    return sum;
  }, [qty, batchInfo]);

  const totalQty = Object.values(qty).reduce((a, b) => a + b, 0);

  const updateQty = (typeId: string, delta: number) => {
    setQty((p) => ({ ...p, [typeId]: Math.max(0, Math.min(10, (p[typeId] ?? 0) + delta)) }));
  };

  const handleCheckout = async () => {
    if (!user) {
      toast.info("Faça login para continuar a compra.");
      navigate({ to: "/login" });
      return;
    }
    if (totalQty === 0 || !data) return;
    setSubmitting(true);
    try {
      const { data: order, error: oErr } = await supabase
        .from("orders")
        .insert({ buyer_id: user.id, event_id: data.event.id, total_cents: total, status: "pending" })
        .select("id")
        .single();
      if (oErr) throw oErr;
      const items = Object.entries(qty)
        .filter(([, q]) => q > 0)
        .map(([typeId, q]) => ({
          order_id: order.id,
          batch_id: batchInfo[typeId].batch!.id,
          qty: q,
          unit_price_cents: batchInfo[typeId].batch!.price_cents,
        }));
      const { error: iErr } = await supabase.from("order_items").insert(items);
      if (iErr) throw iErr;
      navigate({ to: "/checkout/$orderId", params: { orderId: order.id } });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao criar pedido");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="container mx-auto px-4 py-16">Carregando...</div>;
  }
  if (!data) {
    return (
      <div className="container mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">Evento não encontrado</h1>
        <Button asChild className="mt-6" variant="outline">
          <Link to="/"><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Link>
        </Button>
      </div>
    );
  }

  const { event, types } = data;

  return (
    <div className="container mx-auto px-4 py-8">
      <Link to="/" className="mb-6 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" />Voltar
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
        <div>
          <div className="relative aspect-[21/9] overflow-hidden rounded-2xl bg-muted">
            {event.cover_url ? (
              <img src={event.cover_url} alt={event.name} className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center bg-gradient-to-br from-primary/30 to-accent/20 text-6xl font-display font-bold opacity-50">
                {event.name[0]}
              </div>
            )}
          </div>
          <h1 className="mt-6 font-display text-3xl font-bold md:text-4xl">{event.name}</h1>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" />{fmtDateTime(event.starts_at)}</div>
            {event.venue && (
              <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" />{event.venue}{event.address ? ` — ${event.address}` : ""}</div>
            )}
          </div>
          {event.description && (
            <div className="prose prose-invert mt-8 max-w-none text-foreground/90 whitespace-pre-wrap">{event.description}</div>
          )}
        </div>

        <Card className="h-fit p-6 lg:sticky lg:top-20">
          <h2 className="font-display text-xl font-semibold">Ingressos</h2>
          {types.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Nenhum ingresso disponível ainda.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {types.map((t) => {
                const b = batchInfo[t.id]?.batch;
                const remaining = b ? b.quantity_total - b.quantity_sold : 0;
                const soldOut = !b || remaining <= 0;
                const q = qty[t.id] ?? 0;
                return (
                  <div key={t.id} className="rounded-lg border border-border/60 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold">{t.name}</div>
                        {b && <div className="text-xs text-muted-foreground">{b.name}</div>}
                        {t.description && <div className="mt-1 text-xs text-muted-foreground">{t.description}</div>}
                        <div className="mt-2 font-display text-lg text-primary">{b ? brl(b.price_cents) : "—"}</div>
                      </div>
                      {soldOut ? (
                        <span className="rounded bg-muted px-2 py-1 text-xs">Esgotado</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateQty(t.id, -1)} disabled={q === 0}><Minus className="h-3 w-3" /></Button>
                          <span className="w-6 text-center text-sm font-semibold">{q}</span>
                          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateQty(t.id, 1)} disabled={q >= Math.min(10, remaining)}><Plus className="h-3 w-3" /></Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div className="border-t border-border/60 pt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-display text-xl font-bold">{brl(total)}</span>
                </div>
                <Button className="mt-3 w-full" size="lg" disabled={totalQty === 0 || submitting} onClick={handleCheckout}>
                  {submitting ? "Criando pedido..." : `Comprar ${totalQty || ""}`.trim()}
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
