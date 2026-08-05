import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { QrCanvas } from "@/components/qr-canvas";
import { brl } from "@/lib/format";
import {
  MEIOS, esgotado, estoqueCritico, lerCaixaSalvo, salvarCaixa, totalCarrinho, totalUnidades,
  type ItemCarrinho, type MeioPagamento, type Produto, type VendaRegistrada,
} from "@/lib/pdv";
import { toast } from "sonner";
import {
  ArrowLeft, Minus, Plus, Trash2, Loader2, CheckCircle2, Gift, FlaskConical, Printer, ChevronDown,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/pdv/$eventId/caixa")({
  head: () => ({ meta: [{ title: "Caixa — Fest Vale Timóteo" }] }),
  component: Caixa,
});

function Caixa() {
  const { eventId } = Route.useParams();
  const qc = useQueryClient();

  const [caixa, setCaixa] = useState(lerCaixaSalvo());
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [cobrando, setCobrando] = useState(false);
  const [venda, setVenda] = useState<VendaRegistrada | null>(null);
  const [cortesiaAberta, setCortesiaAberta] = useState(false);
  const [motivoCortesia, setMotivoCortesia] = useState("");
  const [gavetaAberta, setGavetaAberta] = useState(false);

  const { data: produtos, isLoading } = useQuery({
    queryKey: ["pdv-produtos", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, category, price_cents, stock_qty, stock_alert, controla_estoque, active, sort_order")
        .eq("event_id", eventId)
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return data as Produto[];
    },
    refetchInterval: 30_000,
  });

  const { data: podeCortesia } = useQuery({
    queryKey: ["pdv-pode-cortesia", eventId],
    queryFn: async () => {
      const { data } = await supabase.rpc("pode_autorizar_cortesia", { _event_id: eventId });
      return data === true;
    },
  });

  const categorias = useMemo(() => {
    const set = new Set<string>();
    for (const p of produtos ?? []) set.add(p.category ?? "Outros");
    return [...set];
  }, [produtos]);

  const total = totalCarrinho(carrinho);
  const unidades = totalUnidades(carrinho);

  const adicionar = (p: Produto) => {
    if (esgotado(p)) return toast.error(`${p.name} está esgotado`);
    setCarrinho((c) => {
      const i = c.findIndex((x) => x.produto.id === p.id);
      if (i === -1) return [...c, { produto: p, qtd: 1 }];
      const novaQtd = c[i].qtd + 1;
      if (p.controla_estoque && novaQtd > p.stock_qty) {
        toast.error(`Só restam ${p.stock_qty} de ${p.name}`);
        return c;
      }
      const copia = [...c];
      copia[i] = { ...copia[i], qtd: novaQtd };
      return copia;
    });
  };

  const mudarQtd = (id: string, delta: number) => {
    setCarrinho((c) =>
      c.flatMap((x) => {
        if (x.produto.id !== id) return [x];
        const q = x.qtd + delta;
        if (q <= 0) return [];
        if (x.produto.controla_estoque && q > x.produto.stock_qty) {
          toast.error(`Só restam ${x.produto.stock_qty}`);
          return [x];
        }
        return [{ ...x, qtd: q }];
      }),
    );
  };

  const limpar = () => {
    setCarrinho([]);
    setCortesiaAberta(false);
    setMotivoCortesia("");
    setGavetaAberta(false);
  };

  const cobrar = async (meio: MeioPagamento) => {
    if (!carrinho.length) return toast.error("Nenhum item no carrinho");
    if (!caixa.trim()) return toast.error("Informe qual caixa é este");
    if (meio === "cortesia" && motivoCortesia.trim().length < 3) {
      return toast.error("Escreva o motivo da cortesia");
    }

    setCobrando(true);
    try {
      // ── MODO DEMONSTRAÇÃO ──────────────────────────────────────────────
      // Quando a maquininha entrar, é aqui que a cobrança será disparada e
      // esperada antes de registrar a venda. Hoje registramos direto.
      const { data, error } = await supabase.rpc("pos_registrar_venda", {
        _event_id: eventId,
        _itens: carrinho.map((i) => ({ product_id: i.produto.id, qty: i.qtd })),
        _payment_method: meio,
        _station: caixa.trim(),
        _courtesy_reason: meio === "cortesia" ? motivoCortesia.trim() : undefined,
      });
      if (error) throw new Error(error.message);

      salvarCaixa(caixa.trim());
      setVenda(data as unknown as VendaRegistrada);
      limpar();
      qc.invalidateQueries({ queryKey: ["pdv-produtos", eventId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui registrar a venda");
    } finally {
      setCobrando(false);
    }
  };

  /* ─────────────────────────────────────────────── ticket da venda feita */
  if (venda) {
    return (
      <div className="container mx-auto max-w-md px-4 py-8">
        <Card className="p-6 text-center">
          <CheckCircle2 className="mx-auto h-14 w-14 text-primary" />
          <h1 className="mt-4 font-display text-2xl font-bold">Venda registrada</h1>
          <p className="mt-1 text-3xl font-bold tabular-nums">{brl(venda.total_cents)}</p>

          <div className="mt-6 flex justify-center rounded-xl border border-border/60 bg-secondary/30 p-5">
            <QrCanvas value={venda.ticket_token} size={200} />
          </div>
          <p className="mt-3 font-mono text-sm text-muted-foreground">{venda.ticket_token}</p>

          <div className="mt-5 space-y-1 border-t border-border/60 pt-4 text-left text-sm">
            {venda.itens?.map((i, n) => (
              <div key={n} className="flex justify-between">
                <span>{i.qtd}× {i.nome}</span>
                <span className="text-muted-foreground">{brl(i.qtd * i.preco_cents)}</span>
              </div>
            ))}
          </div>

          <p className="mt-5 flex items-start gap-2 text-left text-xs text-muted-foreground">
            <Printer className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Com a maquininha conectada, este ticket sai impresso. Por enquanto, mostre a tela para o
            cliente levar ao balcão.
          </p>

          <Button className="mt-6 w-full" size="lg" onClick={() => setVenda(null)}>
            Nova venda
          </Button>
        </Card>
      </div>
    );
  }

  /* ──────────────────────────────────────────────────────── tela do caixa */
  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 pb-28 lg:pb-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link to="/pdv" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" />PDV
        </Link>
        <div className="flex items-center gap-2">
          <Label htmlFor="caixa" className="text-xs text-muted-foreground">Caixa</Label>
          <Input
            id="caixa"
            value={caixa}
            onChange={(e) => setCaixa(e.target.value)}
            placeholder="Caixa 1"
            className="h-9 w-32"
          />
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs">
        <FlaskConical className="h-3.5 w-3.5 shrink-0 text-primary" />
        Modo demonstração — cartão e Pix não cobram de verdade ainda.
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* ---------------------------------------------------- produtos */}
        <div>
          {isLoading && <p className="text-sm text-muted-foreground">Carregando cardápio...</p>}

          {produtos?.length === 0 && (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">Nenhum produto cadastrado ainda.</p>
              <Button asChild variant="outline" className="mt-4">
                <Link to="/pdv/$eventId/estoque" params={{ eventId }}>Cadastrar produtos</Link>
              </Button>
            </Card>
          )}

          {categorias.map((cat) => (
            <div key={cat} className="mb-6">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{cat}</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {produtos!
                  .filter((p) => (p.category ?? "Outros") === cat)
                  .map((p) => {
                    const fora = esgotado(p);
                    const pouco = estoqueCritico(p);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => adicionar(p)}
                        disabled={fora}
                        className={`rounded-xl border p-4 text-left transition-colors ${
                          fora
                            ? "cursor-not-allowed border-border/40 bg-muted/30 opacity-50"
                            : "border-border/70 bg-card hover:border-primary/60 hover:bg-primary/5 active:scale-[0.98]"
                        }`}
                      >
                        <div className="font-semibold leading-tight">{p.name}</div>
                        <div className="mt-2 font-display text-xl font-bold">{brl(p.price_cents)}</div>
                        {p.controla_estoque && (
                          <div className={`mt-1 text-xs ${fora ? "text-destructive" : pouco ? "text-primary" : "text-muted-foreground"}`}>
                            {fora ? "Esgotado" : `${p.stock_qty} em estoque`}
                          </div>
                        )}
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>

        {/* ---------------------------------------------------- carrinho */}
        {/* -------------------------------- carrinho: coluna no desktop */}
        <Card className="hidden h-fit p-5 lg:sticky lg:top-20 lg:block">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">
              Pedido {unidades > 0 && <span className="text-muted-foreground">({unidades})</span>}
            </h2>
            {carrinho.length > 0 && (
              <Button variant="ghost" size="sm" onClick={limpar}>
                <Trash2 className="mr-1 h-4 w-4" />Limpar
              </Button>
            )}
          </div>

          {carrinho.length === 0 ? (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Toque nos produtos para montar o pedido.
            </p>
          ) : (
            <div className="mt-4 space-y-2">
              {carrinho.map((i) => (
                <div key={i.produto.id} className="flex items-center gap-2 rounded-lg border border-border/60 p-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{i.produto.name}</div>
                    <div className="text-xs text-muted-foreground">{brl(i.qtd * i.produto.price_cents)}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => mudarQtd(i.produto.id, -1)}>
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-7 text-center font-semibold tabular-nums">{i.qtd}</span>
                    <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => mudarQtd(i.produto.id, +1)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-4">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="font-display text-3xl font-bold tabular-nums">{brl(total)}</span>
          </div>

          <div className="mt-4 space-y-2">
            {MEIOS.map((m) => (
              <Button
                key={m.id}
                size="lg"
                className="h-14 w-full justify-between text-base"
                disabled={cobrando || carrinho.length === 0}
                onClick={() => cobrar(m.id)}
              >
                <span>{m.label}</span>
                {cobrando ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="text-sm opacity-80">{m.dica}</span>}
              </Button>
            ))}

            {podeCortesia && (
              <>
                {!cortesiaAberta ? (
                  <Button
                    variant="outline"
                    size="lg"
                    className="h-12 w-full"
                    disabled={carrinho.length === 0}
                    onClick={() => setCortesiaAberta(true)}
                  >
                    <Gift className="mr-2 h-4 w-4" />Cortesia
                  </Button>
                ) : (
                  <div className="space-y-2 rounded-lg border border-primary/50 bg-primary/10 p-3">
                    <Label htmlFor="motivo" className="text-xs">
                      Motivo da cortesia — fica registrado com seu nome
                    </Label>
                    <Input
                      id="motivo"
                      value={motivoCortesia}
                      onChange={(e) => setMotivoCortesia(e.target.value)}
                      placeholder="Ex.: Policiais de serviço"
                    />
                    <div className="flex gap-2">
                      <Button
                        className="flex-1"
                        disabled={cobrando}
                        onClick={() => cobrar("cortesia")}
                      >
                        {cobrando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar cortesia"}
                      </Button>
                      <Button variant="ghost" onClick={() => setCortesiaAberta(false)}>Cancelar</Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Sai do estoque sem entrar no faturamento.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </Card>
      </div>

      {/* --------------------- no celular o pedido vira barra fixa + gaveta */}
      {carrinho.length > 0 && !gavetaAberta && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/95 p-3 backdrop-blur lg:hidden">
          <Button size="lg" className="h-14 w-full justify-between text-base" onClick={() => setGavetaAberta(true)}>
            <span>{unidades} {unidades === 1 ? "item" : "itens"}</span>
            <span className="font-display text-xl font-bold tabular-nums">{brl(total)}</span>
          </Button>
        </div>
      )}

      {gavetaAberta && (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-background lg:hidden">
          <div className="sticky top-0 flex items-center justify-between border-b border-border/60 bg-background px-4 py-3">
            <span className="font-display text-lg font-semibold">Fechar pedido</span>
            <Button variant="ghost" size="sm" onClick={() => setGavetaAberta(false)}>
              <ChevronDown className="mr-1 h-4 w-4" />Voltar ao cardápio
            </Button>
          </div>
          <div className="p-4 pb-24">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">
              Pedido {unidades > 0 && <span className="text-muted-foreground">({unidades})</span>}
            </h2>
            {carrinho.length > 0 && (
              <Button variant="ghost" size="sm" onClick={limpar}>
                <Trash2 className="mr-1 h-4 w-4" />Limpar
              </Button>
            )}
          </div>

          {carrinho.length === 0 ? (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Toque nos produtos para montar o pedido.
            </p>
          ) : (
            <div className="mt-4 space-y-2">
              {carrinho.map((i) => (
                <div key={i.produto.id} className="flex items-center gap-2 rounded-lg border border-border/60 p-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{i.produto.name}</div>
                    <div className="text-xs text-muted-foreground">{brl(i.qtd * i.produto.price_cents)}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => mudarQtd(i.produto.id, -1)}>
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-7 text-center font-semibold tabular-nums">{i.qtd}</span>
                    <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => mudarQtd(i.produto.id, +1)}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-4">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="font-display text-3xl font-bold tabular-nums">{brl(total)}</span>
          </div>

          <div className="mt-4 space-y-2">
            {MEIOS.map((m) => (
              <Button
                key={m.id}
                size="lg"
                className="h-14 w-full justify-between text-base"
                disabled={cobrando || carrinho.length === 0}
                onClick={() => cobrar(m.id)}
              >
                <span>{m.label}</span>
                {cobrando ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="text-sm opacity-80">{m.dica}</span>}
              </Button>
            ))}

            {podeCortesia && (
              <>
                {!cortesiaAberta ? (
                  <Button
                    variant="outline"
                    size="lg"
                    className="h-12 w-full"
                    disabled={carrinho.length === 0}
                    onClick={() => setCortesiaAberta(true)}
                  >
                    <Gift className="mr-2 h-4 w-4" />Cortesia
                  </Button>
                ) : (
                  <div className="space-y-2 rounded-lg border border-primary/50 bg-primary/10 p-3">
                    <Label htmlFor="motivo" className="text-xs">
                      Motivo da cortesia — fica registrado com seu nome
                    </Label>
                    <Input
                      id="motivo"
                      value={motivoCortesia}
                      onChange={(e) => setMotivoCortesia(e.target.value)}
                      placeholder="Ex.: Policiais de serviço"
                    />
                    <div className="flex gap-2">
                      <Button
                        className="flex-1"
                        disabled={cobrando}
                        onClick={() => cobrar("cortesia")}
                      >
                        {cobrando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar cortesia"}
                      </Button>
                      <Button variant="ghost" onClick={() => setCortesiaAberta(false)}>Cancelar</Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Sai do estoque sem entrar no faturamento.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
          </div>
        </div>
      )}
    </div>
  );
}