import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { QrCanvas } from "@/components/qr-canvas";
import { brl } from "@/lib/format";
import { MEIOS, lerCaixaSalvo, salvarCaixa, type MeioPagamento } from "@/lib/pdv";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Minus, Plus, Ticket, CheckCircle2, Printer, FlaskConical } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pdv/$eventId/ingressos")({
  head: () => ({ meta: [{ title: "Ingressos na portaria — Fest Vale Timóteo" }] }),
  component: IngressosPortaria,
});

type Lote = {
  id: string;
  name: string;
  price_cents: number;
  quantity_total: number;
  quantity_sold: number;
  sort_order: number;
  tipo: string;
};

type VendaIngresso = {
  order_id: string;
  total_cents: number;
  tipo: string;
  lote: string;
  qtd: number;
  tokens: string[];
};

function IngressosPortaria() {
  const { eventId } = Route.useParams();

  const [caixa, setCaixa] = useState(lerCaixaSalvo());
  const [selecionado, setSelecionado] = useState<Lote | null>(null);
  const [qtd, setQtd] = useState(1);
  const [vendendo, setVendendo] = useState(false);
  const [venda, setVenda] = useState<VendaIngresso | null>(null);

  const { data: lotes, isLoading, refetch } = useQuery({
    queryKey: ["pdv-lotes", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_types")
        .select("id, name, sort_order, ticket_batches(id, name, price_cents, quantity_total, quantity_sold, sort_order)")
        .eq("event_id", eventId)
        .order("sort_order");
      if (error) throw error;

      const lista: Lote[] = [];
      for (const t of data ?? []) {
        const tipo = t as unknown as { name: string; ticket_batches: Omit<Lote, "tipo">[] };
        for (const b of tipo.ticket_batches ?? []) lista.push({ ...b, tipo: tipo.name });
      }
      return lista.sort((a, b) =>
        a.tipo.localeCompare(b.tipo) || a.sort_order - b.sort_order);
    },
    refetchInterval: 30_000,
  });

  const restam = (l: Lote) => (l.quantity_total > 0 ? l.quantity_total - l.quantity_sold : Infinity);
  const esgotado = (l: Lote) => restam(l) <= 0;

  const vender = async (meio: MeioPagamento) => {
    if (!selecionado) return toast.error("Escolha o lote");
    if (!caixa.trim()) return toast.error("Informe qual posto é este");

    setVendendo(true);
    try {
      // ── MODO DEMONSTRAÇÃO ──────────────────────────────────────────────
      // Com a maquininha conectada, a cobrança é disparada aqui antes de
      // registrar a venda e imprimir. Hoje registramos direto.
      const { data, error } = await supabase.rpc("vender_ingresso_portaria", {
        _event_id: eventId,
        _batch_id: selecionado.id,
        _qty: qtd,
        _payment_method: meio,
        _station: caixa.trim(),
      });
      if (error) throw new Error(error.message);

      salvarCaixa(caixa.trim());
      setVenda(data as unknown as VendaIngresso);
      setSelecionado(null);
      setQtd(1);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui registrar a venda");
    } finally {
      setVendendo(false);
    }
  };

  /* ──────────────────────────────────────────── ingressos recém-vendidos */
  if (venda) {
    return (
      <div className="container mx-auto max-w-md px-4 py-8">
        <Card className="p-6 text-center">
          <CheckCircle2 className="mx-auto h-14 w-14 text-primary" />
          <h1 className="mt-4 font-display text-2xl font-bold">
            {venda.qtd} {venda.qtd === 1 ? "ingresso" : "ingressos"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{venda.tipo} · {venda.lote}</p>
          <p className="mt-2 text-3xl font-bold tabular-nums">{brl(venda.total_cents)}</p>

          <p className="mt-5 text-sm text-muted-foreground">
            {venda.qtd > 1
              ? "Cada QR abaixo vale uma entrada. Entregue um para cada pessoa."
              : "Este QR vale uma entrada."}
          </p>

          <div className="mt-5 space-y-4">
            {venda.tokens?.map((t, i) => (
              <div key={t} className="rounded-xl border border-border/60 bg-secondary/30 p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Ingresso {i + 1} de {venda.qtd}
                </div>
                <div className="mt-3 flex justify-center">
                  <QrCanvas value={t} size={180} />
                </div>
                <div className="mt-3 font-mono text-xs text-muted-foreground">{t}</div>
              </div>
            ))}
          </div>

          <p className="mt-5 flex items-start gap-2 text-left text-xs text-muted-foreground">
            <Printer className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Com a maquininha conectada, cada ingresso sai impresso. Por enquanto, mostre a tela para a
            pessoa entrar.
          </p>

          <Button className="mt-6 w-full" size="lg" onClick={() => setVenda(null)}>
            Nova venda
          </Button>
        </Card>
      </div>
    );
  }

  /* ───────────────────────────────────────────────────── tela de venda */
  return (
    <div className="container mx-auto max-w-2xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link to="/pdv" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" />PDV
        </Link>
        <div className="flex items-center gap-2">
          <Label htmlFor="posto" className="text-xs text-muted-foreground">Posto</Label>
          <Input id="posto" value={caixa} onChange={(e) => setCaixa(e.target.value)}
                 placeholder="Portaria 1" className="h-9 w-32" />
        </div>
      </div>

      <h1 className="font-display text-2xl font-bold">Ingresso na portaria</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Venda no local, sem cadastro. O QR sai na hora e já serve de entrada.
      </p>

      <div className="mt-4 flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs">
        <FlaskConical className="h-3.5 w-3.5 shrink-0 text-primary" />
        Modo demonstração — cartão e Pix não cobram de verdade ainda.
      </div>

      <div className="mt-6 space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando lotes...</p>}

        {lotes?.length === 0 && (
          <Card className="p-10 text-center">
            <Ticket className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">
              Nenhum lote cadastrado. A organização precisa criar os tipos de ingresso no painel.
            </p>
          </Card>
        )}

        {lotes?.map((l) => {
          const fora = esgotado(l);
          const ativo = selecionado?.id === l.id;
          return (
            <button
              key={l.id}
              type="button"
              disabled={fora}
              onClick={() => { setSelecionado(l); setQtd(1); }}
              className={`w-full rounded-xl border p-4 text-left transition-colors ${
                fora
                  ? "cursor-not-allowed border-border/40 bg-muted/30 opacity-50"
                  : ativo
                    ? "border-primary bg-primary/10"
                    : "border-border/70 bg-card hover:bg-secondary/40"
              }`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <div className="font-semibold">{l.tipo}</div>
                  <div className="text-sm text-muted-foreground">{l.name}</div>
                </div>
                <div className="text-right">
                  <div className="font-display text-xl font-bold">{brl(l.price_cents)}</div>
                  <div className="text-xs text-muted-foreground">
                    {fora ? "esgotado" : l.quantity_total > 0 ? `${restam(l)} restam` : "sem limite"}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {selecionado && (
        <Card className="mt-6 p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Quantidade</div>
              <div className="mt-1 font-semibold">{selecionado.tipo} · {selecionado.name}</div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-11 w-11"
                      onClick={() => setQtd((q) => Math.max(1, q - 1))}>
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-10 text-center font-display text-2xl font-bold tabular-nums">{qtd}</span>
              <Button variant="outline" size="icon" className="h-11 w-11"
                      onClick={() => setQtd((q) => Math.min(restam(selecionado), q + 1))}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-4">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="font-display text-3xl font-bold tabular-nums">
              {brl(qtd * selecionado.price_cents)}
            </span>
          </div>

          <div className="mt-4 space-y-2">
            {MEIOS.map((m) => (
              <Button key={m.id} size="lg" className="h-14 w-full justify-between text-base"
                      disabled={vendendo} onClick={() => vender(m.id)}>
                <span>{m.label}</span>
                {vendendo ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <span className="text-sm opacity-80">{m.dica}</span>}
              </Button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
