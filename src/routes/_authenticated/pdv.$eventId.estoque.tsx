import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { brl } from "@/lib/format";
import { esgotado, estoqueCritico, type Produto } from "@/lib/pdv";
import { toast } from "sonner";
import { ArrowLeft, PackagePlus, Plus, Loader2, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pdv/$eventId/estoque")({
  head: () => ({ meta: [{ title: "Estoque — Fest Vale Timóteo" }] }),
  component: Estoque,
});

function Estoque() {
  const { eventId } = Route.useParams();
  const qc = useQueryClient();

  const [remessaDe, setRemessaDe] = useState<Produto | null>(null);
  const [qtd, setQtd] = useState("");
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);

  const [novoAberto, setNovoAberto] = useState(false);
  const [novo, setNovo] = useState({ name: "", category: "Bebidas", preco: "", alerta: "" });

  const { data: produtos, isLoading } = useQuery({
    queryKey: ["pdv-produtos", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, category, price_cents, stock_qty, stock_alert, controla_estoque, active, sort_order")
        .eq("event_id", eventId)
        .order("sort_order");
      if (error) throw error;
      return data as Produto[];
    },
    refetchInterval: 20_000,
  });

  const darEntrada = async () => {
    const n = parseInt(qtd, 10);
    if (!remessaDe) return;
    if (!n || n === 0) return toast.error("Informe a quantidade");

    setSalvando(true);
    const { error } = await supabase.rpc("pos_entrada_estoque", {
      _product_id: remessaDe.id,
      _qty: n,
      _reason: motivo.trim() || undefined,
    });
    setSalvando(false);

    if (error) return toast.error(error.message);
    toast.success(`${n > 0 ? "Entrada" : "Baixa"} de ${Math.abs(n)} em ${remessaDe.name}`);
    setRemessaDe(null);
    setQtd("");
    setMotivo("");
    qc.invalidateQueries({ queryKey: ["pdv-produtos", eventId] });
  };

  const criarProduto = async () => {
    if (!novo.name.trim()) return toast.error("Informe o nome do produto");
    const preco = Math.round(parseFloat(novo.preco.replace(",", ".")) * 100);
    if (isNaN(preco) || preco < 0) return toast.error("Preço inválido");

    setSalvando(true);
    const { error } = await supabase.from("products").insert({
      event_id: eventId,
      name: novo.name.trim(),
      category: novo.category.trim() || null,
      price_cents: preco,
      stock_alert: parseInt(novo.alerta, 10) || 0,
      sort_order: (produtos?.length ?? 0) + 1,
    });
    setSalvando(false);

    if (error) return toast.error(error.message);
    toast.success("Produto cadastrado");
    setNovo({ name: "", category: "Bebidas", preco: "", alerta: "" });
    setNovoAberto(false);
    qc.invalidateQueries({ queryKey: ["pdv-produtos", eventId] });
  };

  const criticos = (produtos ?? []).filter((p) => estoqueCritico(p) || esgotado(p));

  return (
    <div className="container mx-auto max-w-3xl px-4 py-6">
      <Link to="/pdv" className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" />PDV
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Estoque</h1>
        <Button size="sm" variant="outline" onClick={() => setNovoAberto((v) => !v)}>
          <Plus className="mr-1 h-4 w-4" />Novo produto
        </Button>
      </div>

      {criticos.length > 0 && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <span>
            <span className="font-semibold">{criticos.length}</span>{" "}
            {criticos.length === 1 ? "item precisa" : "itens precisam"} de reposição:{" "}
            {criticos.map((p) => p.name).join(", ")}
          </span>
        </div>
      )}

      {novoAberto && (
        <Card className="mt-4 p-5">
          <h2 className="font-display text-lg font-semibold">Novo produto</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="np-nome">Nome</Label>
              <Input id="np-nome" value={novo.name} onChange={(e) => setNovo({ ...novo, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np-cat">Categoria</Label>
              <Input id="np-cat" value={novo.category} onChange={(e) => setNovo({ ...novo, category: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np-preco">Preço (R$)</Label>
              <Input id="np-preco" inputMode="decimal" placeholder="15,00" value={novo.preco}
                     onChange={(e) => setNovo({ ...novo, preco: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np-alerta">Avisar quando restar</Label>
              <Input id="np-alerta" inputMode="numeric" placeholder="50" value={novo.alerta}
                     onChange={(e) => setNovo({ ...novo, alerta: e.target.value })} />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={criarProduto} disabled={salvando}>
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cadastrar"}
            </Button>
            <Button variant="ghost" onClick={() => setNovoAberto(false)}>Cancelar</Button>
          </div>
        </Card>
      )}

      <div className="mt-6 space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}

        {produtos?.map((p) => {
          const fora = esgotado(p);
          const pouco = estoqueCritico(p);
          return (
            <Card key={p.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{p.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {p.category} · {brl(p.price_cents)}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className={`font-display text-2xl font-bold tabular-nums ${fora ? "text-destructive" : pouco ? "text-primary" : ""}`}>
                      {p.stock_qty}
                    </div>
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">em estoque</div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => { setRemessaDe(p); setQtd(""); setMotivo(""); }}>
                    <PackagePlus className="mr-1 h-4 w-4" />Repor
                  </Button>
                </div>
              </div>

              {remessaDe?.id === p.id && (
                <div className="mt-4 space-y-3 rounded-lg border border-primary/50 bg-primary/10 p-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor={`q-${p.id}`}>Quantidade</Label>
                      <Input id={`q-${p.id}`} inputMode="numeric" placeholder="300" value={qtd}
                             onChange={(e) => setQtd(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`m-${p.id}`}>Motivo</Label>
                      <Input id={`m-${p.id}`} placeholder="Segunda remessa" value={motivo}
                             onChange={(e) => setMotivo(e.target.value)} />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Número negativo dá baixa — use para perda ou acerto de contagem.
                  </p>
                  <div className="flex gap-2">
                    <Button onClick={darEntrada} disabled={salvando}>
                      {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
                    </Button>
                    <Button variant="ghost" onClick={() => setRemessaDe(null)}>Cancelar</Button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
