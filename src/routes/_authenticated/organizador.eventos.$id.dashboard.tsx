import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { brl, fmtDate, fmtDateTime } from "@/lib/format";
import { Download, ExternalLink, Ticket, TrendingUp, Users, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/organizador/eventos/$id/dashboard")({
  component: EventDashboard,
});

type TicketRow = {
  id: string;
  status: "valid" | "checked_in" | "cancelled";
  checked_in_at: string | null;
  attendee_name: string | null;
  attendee_doc: string | null;
  batch_id: string;
  created_at: string;
};

type OrderRow = {
  id: string;
  total_cents: number;
  paid_at: string | null;
  payment_method: string | null;
};

function EventDashboard() {
  const { id } = Route.useParams();

  const eventQ = useQuery({
    queryKey: ["dash-event", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, name, slug, status, starts_at, venue")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const ordersQ = useQuery({
    queryKey: ["dash-orders", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, total_cents, paid_at, payment_method")
        .eq("event_id", id)
        .eq("status", "paid")
        .order("paid_at");
      if (error) throw error;
      return (data ?? []) as OrderRow[];
    },
  });

  const ticketsQ = useQuery({
    queryKey: ["dash-tickets", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("id, status, checked_in_at, attendee_name, attendee_doc, batch_id, created_at, orders!inner(event_id)")
        .eq("orders.event_id", id);
      if (error) throw error;
      return (data ?? []) as unknown as TicketRow[];
    },
  });

  const typesQ = useQuery({
    queryKey: ["dash-types", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_types")
        .select("id, name, sort_order, ticket_batches(id, name, price_cents, quantity_total, quantity_sold, sort_order)")
        .eq("event_id", id)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const orders = ordersQ.data ?? [];
  const tickets = ticketsQ.data ?? [];
  const types = typesQ.data ?? [];

  const batchIndex = useMemo(() => {
    const map = new Map<string, { batch: string; type: string; price_cents: number }>();
    for (const t of types) {
      for (const b of (t.ticket_batches ?? []) as any[]) {
        map.set(b.id, { batch: b.name, type: t.name, price_cents: b.price_cents });
      }
    }
    return map;
  }, [types]);

  const revenueCents = orders.reduce((sum, o) => sum + o.total_cents, 0);
  const ticketsSold = tickets.filter((t) => t.status !== "cancelled").length;
  const checkedIn = tickets.filter((t) => t.status === "checked_in").length;
  const attendanceRate = ticketsSold ? Math.round((checkedIn / ticketsSold) * 100) : 0;
  const avgTicketCents = orders.length ? Math.round(revenueCents / orders.length) : 0;

  // Receita por dia — série única, um eixo só.
  const salesByDay = useMemo(() => {
    const buckets = new Map<string, { revenue: number; orders: number }>();
    for (const o of orders) {
      if (!o.paid_at) continue;
      const key = o.paid_at.slice(0, 10);
      const cur = buckets.get(key) ?? { revenue: 0, orders: 0 };
      cur.revenue += o.total_cents / 100;
      cur.orders += 1;
      buckets.set(key, cur);
    }
    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, v]) => ({
        day,
        label: new Date(`${day}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
        revenue: Number(v.revenue.toFixed(2)),
        orders: v.orders,
      }));
  }, [orders]);

  const exportCsv = () => {
    const head = [
      "participante",
      "documento",
      "tipo",
      "lote",
      "valor",
      "status",
      "check_in",
      "comprado_em",
    ];
    const statusLabel: Record<string, string> = {
      valid: "Válido",
      checked_in: "Utilizado",
      cancelled: "Cancelado",
    };
    const rows = tickets.map((t) => {
      const info = batchIndex.get(t.batch_id);
      return [
        t.attendee_name ?? "",
        t.attendee_doc ?? "",
        info?.type ?? "",
        info?.batch ?? "",
        ((info?.price_cents ?? 0) / 100).toFixed(2).replace(".", ","),
        statusLabel[t.status] ?? t.status,
        t.checked_in_at ? fmtDateTime(t.checked_in_at) : "",
        fmtDateTime(t.created_at),
      ];
    });
    const csv = [head, ...rows]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
      .join("\r\n");
    // BOM para o Excel abrir acentuação correta
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `participantes-${eventQ.data?.slug ?? id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (eventQ.isLoading) return <div className="text-muted-foreground">Carregando...</div>;
  if (!eventQ.data) return <div className="text-muted-foreground">Evento não encontrado.</div>;

  const ev = eventQ.data;
  const loading = ordersQ.isLoading || ticketsQ.isLoading || typesQ.isLoading;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild size="sm" variant="outline" className="mb-3">
            <Link to="/organizador">← Voltar</Link>
          </Button>
          <h2 className="font-display text-2xl font-semibold">{ev.name}</h2>
          <p className="text-sm text-muted-foreground">
            {fmtDate(ev.starts_at)}
            {ev.venue ? ` • ${ev.venue}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={!tickets.length}>
            <Download className="mr-1 h-4 w-4" />
            Exportar participantes
          </Button>
          {ev.status === "published" && (
            <Button asChild size="sm" variant="outline">
              <Link to="/eventos/$slug" params={{ slug: ev.slug }} target="_blank">
                <ExternalLink className="mr-1 h-4 w-4" />
                Página pública
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={<TrendingUp className="h-4 w-4" />}
          label="Faturamento confirmado"
          value={brl(revenueCents)}
          hint={`${orders.length} pedido${orders.length === 1 ? "" : "s"} pago${orders.length === 1 ? "" : "s"}`}
          loading={loading}
        />
        <StatTile
          icon={<Ticket className="h-4 w-4" />}
          label="Ingressos vendidos"
          value={String(ticketsSold)}
          hint={`Ticket médio ${brl(avgTicketCents)}`}
          loading={loading}
        />
        <StatTile
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Check-ins realizados"
          value={String(checkedIn)}
          hint={`${attendanceRate}% dos ingressos`}
          loading={loading}
        />
        <StatTile
          icon={<Users className="h-4 w-4" />}
          label="Público esperado"
          value={String(ticketsSold - checkedIn)}
          hint="Ingressos ainda não utilizados"
          loading={loading}
        />
      </div>

      <Card className="p-6">
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <h3 className="font-display text-lg font-semibold">Faturamento por dia</h3>
          <span className="text-sm text-muted-foreground">em reais</span>
        </div>
        <p className="mb-6 text-sm text-muted-foreground">
          Somente pedidos com pagamento confirmado.
        </p>
        {salesByDay.length === 0 ? (
          <EmptyPlot message="Nenhuma venda confirmada ainda." />
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesByDay} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" strokeOpacity={0.5} vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  dy={8}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={64}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  tickFormatter={(v: number) =>
                    v >= 1000 ? `${(v / 1000).toLocaleString("pt-BR")}k` : String(v)
                  }
                />
                <Tooltip
                  cursor={{ stroke: "var(--muted-foreground)", strokeOpacity: 0.4 }}
                  content={<RevenueTooltip />}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  fill="url(#revFill)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h3 className="font-display text-lg font-semibold">Velocidade de venda por lote</h3>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">
          Quanto de cada lote já saiu. Lotes esgotados viram automaticamente para o próximo.
        </p>
        {types.length === 0 ? (
          <EmptyPlot message="Nenhum tipo de ingresso cadastrado." />
        ) : (
          <div className="space-y-6">
            {types.map((t: any) => (
              <div key={t.id}>
                <div className="mb-2 text-sm font-medium">{t.name}</div>
                <div className="space-y-2">
                  {[...(t.ticket_batches ?? [])]
                    .sort((a: any, b: any) => a.sort_order - b.sort_order)
                    .map((b: any) => {
                      const pct = b.quantity_total ? Math.round((b.quantity_sold / b.quantity_total) * 100) : 0;
                      const soldOut = b.quantity_total > 0 && b.quantity_sold >= b.quantity_total;
                      return (
                        <div key={b.id} className="rounded-lg bg-secondary/40 px-3 py-2.5">
                          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                            <span className="font-medium">{b.name}</span>
                            <span className="text-muted-foreground">{brl(b.price_cents)}</span>
                            <span className="ml-auto tabular-nums text-muted-foreground">
                              {b.quantity_sold}/{b.quantity_total}
                            </span>
                            <span
                              className={`w-12 text-right tabular-nums font-medium ${soldOut ? "text-success" : ""}`}
                            >
                              {pct}%
                            </span>
                          </div>
                          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-background">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(pct, 100)}%`,
                                backgroundColor: soldOut ? "var(--success)" : "var(--chart-1)",
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  {!(t.ticket_batches ?? []).length && (
                    <p className="text-sm text-muted-foreground">Sem lotes cadastrados.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  hint,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  loading: boolean;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <div className="mt-3 font-display text-3xl font-bold tabular-nums">
        {loading ? <span className="text-muted-foreground">—</span> : value}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </Card>
  );
}

function RevenueTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload as { label: string; revenue: number; orders: number };
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-sm shadow-lg">
      <div className="font-medium">{p.label}</div>
      <div className="mt-1 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "var(--chart-1)" }} />
        <span className="tabular-nums">{brl(Math.round(p.revenue * 100))}</span>
      </div>
      <div className="text-xs text-muted-foreground">
        {p.orders} pedido{p.orders === 1 ? "" : "s"}
      </div>
    </div>
  );
}

function EmptyPlot({ message }: { message: string }) {
  return (
    <div className="grid h-40 place-items-center rounded-lg border border-dashed border-border/60 text-sm text-muted-foreground">
      {message}
    </div>
  );
}
