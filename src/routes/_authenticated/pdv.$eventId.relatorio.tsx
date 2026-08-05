import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brl, fmtDateTime } from "@/lib/format";
import { toast } from "sonner";
import { ArrowLeft, RefreshCw, AlertTriangle, Gift, Boxes, Banknote, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pdv/$eventId/relatorio")({
  head: () => ({ meta: [{ title: "Relatório do PDV — Fest Vale Timóteo" }] }),
  component: Relatorio,
});

type Relat = {
  total_cents: number;
  cortesias: number;
  por_meio: { meio: string; vendas: number; total_cents: number }[];
  produtos: {
    id: string; name: string; category: string | null; stock_qty: number;
    stock_alert: number; controla_estoque: boolean; vendido: number; receita_cents: number;
  }[];
  por_operador: {
    operator_id: string; nome: string; station: string | null;
    vendas: number; total_cents: number; dinheiro_cents: number | null;
  }[];
};

const ROTULO: Record<string, string> = {
  dinheiro: "Dinheiro", cartao: "Cartão", pix: "Pix", cortesia: "Cortesia",
};

function Relatorio() {
  const { eventId } = Route.useParams();
  const qc = useQueryClient();

  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState("");
  const [posto, setPosto] = useState("");
  const [registrando, setRegistrando] = useState(false);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["pdv-relatorio", eventId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pos_relatorio", { _event_id: eventId });
      if (error) throw error;
      return data as unknown as Relat;
    },
    refetchInterval: 15_000,
  });

  const { data: podeGerenciar } = useQuery({
    queryKey: ["pdv-pode-gerenciar", eventId],
    queryFn: async () => {
      const { data } = await supabase.rpc("pode_gerenciar_evento", { _event_id: eventId });
      return data === true;
    },
  });

  const { data: sangrias } = useQuery({
    queryKey: ["pdv-sangrias", eventId],
    enabled: podeGerenciar === true,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_movements")
        .select("id, amount_cents, reason, station, created_at")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const registrarSangria = async () => {
    const reais = parseFloat(valor.replace(".", "").replace(",", "."));
    if (!reais || reais <= 0) return toast.error("Informe o valor retirado");
    if (motivo.trim().length < 3) return toast.error("Informe o motivo");

    setRegistrando(true);
    const { error } = await supabase.rpc("pos_sangria", {
      _event_id: eventId,
      _amount_cents: -Math.round(reais * 100),
      _reason: motivo.trim(),
      _station: posto.trim() || undefined,
    });
    setRegistrando(false);

    if (error) return toast.error(error.message);
    toast.success(`Sangria de ${brl(Math.round(reais * 100))} registrada`);
    setValor(""); setMotivo(""); setPosto("");
    qc.invalidateQueries({ queryKey: ["pdv-sangrias", eventId] });
  };

  const totalSangrado = (sangrias ?? []).reduce((s, m) => s + Math.abs(m.amount_cents), 0);

  const criticos = (data?.produtos ?? []).filter(
    (p) => p.controla_estoque && (p.stock_qty <= 0 || (p.stock_alert > 0 && p.stock_qty <= p.stock_alert)),
  );
  const maiorVenda = Math.max(1, ...(data?.produtos ?? []).map((p) => p.vendido));

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6">
      <Link to="/pdv" className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" />PDV
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Relatório ao vivo</h1>
        <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`mr-1 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />Atualizar
        </Button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Atualiza sozinho a cada 15 segundos.</p>

      {/* ------------------------------------------------------- números */}
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Card className="p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Faturamento</div>
          <div className="mt-1 font-display text-3xl font-bold tabular-nums">
            {brl(data?.total_cents ?? 0)}
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Itens vendidos</div>
          <div className="mt-1 font-display text-3xl font-bold tabular-nums">
            {(data?.produtos ?? []).reduce((s, p) => s + p.vendido, 0)}
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
            <Gift className="h-3.5 w-3.5" />Cortesias
          </div>
          <div className="mt-1 font-display text-3xl font-bold tabular-nums">{data?.cortesias ?? 0}</div>
        </Card>
      </div>

      {criticos.length > 0 && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <span>
            <span className="font-semibold">Repor agora:</span>{" "}
            {criticos.map((p) => `${p.name} (${p.stock_qty})`).join(" · ")}
          </span>
        </div>
      )}

      {/* -------------------------------------------------- por pagamento */}
      <h2 className="mt-8 font-display text-lg font-semibold">Por forma de pagamento</h2>
      <Card className="mt-2 divide-y divide-border/60">
        {(data?.por_meio ?? []).length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">Nenhuma venda ainda.</div>
        )}
        {(data?.por_meio ?? []).map((m) => (
          <div key={m.meio} className="flex items-center justify-between gap-3 p-4">
            <div>
              <div className="font-medium">{ROTULO[m.meio] ?? m.meio}</div>
              <div className="text-xs text-muted-foreground">{m.vendas} {m.vendas === 1 ? "venda" : "vendas"}</div>
            </div>
            <div className="font-display text-xl font-bold tabular-nums">{brl(m.total_cents)}</div>
          </div>
        ))}
      </Card>

      {/* ----------------------------------------------------- produtos */}
      <h2 className="mt-8 flex items-center gap-2 font-display text-lg font-semibold">
        <Boxes className="h-4 w-4" />Produtos
      </h2>
      <Card className="mt-2 divide-y divide-border/60">
        {(data?.produtos ?? []).map((p) => {
          const fora = p.controla_estoque && p.stock_qty <= 0;
          const pouco = p.controla_estoque && p.stock_alert > 0 && p.stock_qty <= p.stock_alert;
          return (
            <div key={p.id} className="p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="font-medium">{p.name}</span>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {p.vendido} vendidos · {brl(p.receita_cents)}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-r-sm bg-primary transition-all"
                    style={{ width: `${(p.vendido / maiorVenda) * 100}%` }}
                  />
                </div>
                {p.controla_estoque && (
                  <span className={`shrink-0 text-xs tabular-nums ${fora ? "text-destructive" : pouco ? "text-primary" : "text-muted-foreground"}`}>
                    {fora ? "esgotado" : `${p.stock_qty} restam`}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </Card>

      {/* ---------------------------------------------------- operadores */}
      <h2 className="mt-8 font-display text-lg font-semibold">Por caixa</h2>
      <Card className="mt-2 divide-y divide-border/60">
        {(data?.por_operador ?? []).length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">Nenhum caixa movimentou ainda.</div>
        )}
        {(data?.por_operador ?? []).map((o, i) => (
          <div key={`${o.operator_id}-${i}`} className="flex flex-wrap items-center justify-between gap-2 p-4">
            <div className="min-w-0">
              <div className="truncate font-medium">{o.station ?? "Sem caixa"}</div>
              <div className="truncate text-xs text-muted-foreground">
                {o.nome} · {o.vendas} {o.vendas === 1 ? "venda" : "vendas"}
              </div>
            </div>
            <div className="text-right">
              <div className="font-display text-lg font-bold tabular-nums">{brl(o.total_cents)}</div>
              {!!o.dinheiro_cents && (
                <div className="text-xs text-muted-foreground">{brl(o.dinheiro_cents)} em dinheiro</div>
              )}
            </div>
          </div>
        ))}
      </Card>

      <p className="mt-6 text-xs text-muted-foreground">
        O valor em dinheiro é o que deve estar na gaveta de cada caixa no fechamento, descontadas as
        sangrias já retiradas.
      </p>

      {podeGerenciar && (
        <>
          <h2 className="mt-8 flex items-center gap-2 font-display text-lg font-semibold">
            <Banknote className="h-4 w-4" />Sangria de caixa
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Dinheiro retirado da gaveta durante o evento. Fica registrado com seu nome e sai do saldo
            esperado daquele caixa.
          </p>

          <Card className="mt-3 p-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="sg-valor">Valor retirado (R$)</Label>
                <Input id="sg-valor" inputMode="decimal" placeholder="500,00" value={valor}
                       onChange={(e) => setValor(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sg-posto">Caixa</Label>
                <Input id="sg-posto" placeholder="Caixa 1" value={posto}
                       onChange={(e) => setPosto(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sg-motivo">Motivo</Label>
                <Input id="sg-motivo" placeholder="Levado para o cofre" value={motivo}
                       onChange={(e) => setMotivo(e.target.value)} />
              </div>
            </div>
            <Button className="mt-4" onClick={registrarSangria} disabled={registrando}>
              {registrando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Registrar sangria"}
            </Button>
          </Card>

          {(sangrias?.length ?? 0) > 0 && (
            <Card className="mt-3 divide-y divide-border/60">
              <div className="flex items-center justify-between p-4">
                <span className="text-sm text-muted-foreground">Total retirado</span>
                <span className="font-display text-xl font-bold tabular-nums">{brl(totalSangrado)}</span>
              </div>
              {sangrias!.map((m) => (
                <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{m.reason}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {m.station ?? "sem caixa"} · {fmtDateTime(m.created_at)}
                    </div>
                  </div>
                  <span className="font-display text-lg font-bold tabular-nums">
                    {brl(Math.abs(m.amount_cents))}
                  </span>
                </div>
              ))}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
