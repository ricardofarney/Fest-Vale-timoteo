import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { brl, fmtDateTime } from "@/lib/format";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Clock, ArrowLeft, ShieldCheck, Loader2, CheckCircle2, AlertTriangle, Mail } from "lucide-react";

export const Route = createFileRoute("/checkout/$orderId")({
  head: () => ({ meta: [{ title: "Finalizar compra — Fest Vale Timóteo" }] }),
  validateSearch: (search: Record<string, unknown>): { retorno?: string } => {
    const r = search.retorno;
    return typeof r === "string" ? { retorno: r } : {};
  },
  component: CheckoutPage,
});

async function fetchOrder(orderId: string) {
  const { data: order, error } = await supabase
    .from("orders")
    .select("*, events(name, slug, starts_at, venue, cover_url)")
    .eq("id", orderId)
    .single();
  if (error) throw error;
  const { data: items } = await supabase
    .from("order_items")
    .select("*, ticket_batches(name, price_cents, ticket_types(name))")
    .eq("order_id", orderId);
  return { order, items: items ?? [] };
}

function CheckoutPage() {
  const { orderId } = Route.useParams();
  const { retorno } = Route.useSearch();
  const { user } = useAuth();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => fetchOrder(orderId),
    // Depois de voltar do Mercado Pago o pedido leva alguns segundos para virar "pago":
    // quem confirma é o webhook, não o navegador.
    refetchInterval: (q) => {
      const status = (q.state.data as { order?: { status?: string } } | undefined)?.order?.status;
      return retorno && status !== "paid" ? 3000 : false;
    },
  });

  const [coupon, setCoupon] = useState("");
  const [nomes, setNomes] = useState<string[]>([]);
  const [compradorNome, setCompradorNome] = useState("");
  const [compradorEmail, setCompradorEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [remaining, setRemaining] = useState<number>(0);
  const preencheu = useRef(false);

  const totalQty = useMemo(
    () => (data?.items ?? []).reduce((acc, it) => acc + it.qty, 0),
    [data],
  );

  useEffect(() => {
    if (totalQty && nomes.length !== totalQty) {
      setNomes(Array.from({ length: totalQty }, (_, i) => nomes[i] ?? ""));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalQty]);

  // Preenche uma vez com o que já se sabe do comprador
  useEffect(() => {
    if (preencheu.current || !data?.order) return;
    const o = data.order as { buyer_name?: string | null; buyer_email?: string | null };
    const nomeConta = (user?.user_metadata as { name?: string } | undefined)?.name ?? "";
    setCompradorNome(o.buyer_name || nomeConta || "");
    setCompradorEmail(o.buyer_email || user?.email || "");
    preencheu.current = true;
  }, [data?.order, user]);

  useEffect(() => {
    if (!data?.order?.expires_at) return;
    const tick = () => {
      const ms = new Date(data.order.expires_at).getTime() - Date.now();
      setRemaining(Math.max(0, Math.floor(ms / 1000)));
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [data?.order?.expires_at]);

  if (isLoading || !data) return <div className="container mx-auto px-4 py-16">Carregando...</div>;

  const { order, items } = data;

  /* ------------------------------------------------ Pedido já confirmado */
  if (order.status === "paid") {
    return (
      <div className="container mx-auto max-w-md px-4 py-16 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-primary" />
        <h1 className="mt-5 font-display text-2xl font-bold">Pagamento confirmado</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {order.buyer_email
            ? <>Enviamos {items.length > 1 ? "os ingressos" : "o ingresso"} para <span className="text-foreground">{order.buyer_email}</span>. Se não aparecer em alguns minutos, confira a caixa de spam.</>
            : "Seus ingressos já estão disponíveis."}
        </p>
        <Button asChild className="mt-6" size="lg"><Link to="/meus-ingressos">Ver meus ingressos</Link></Button>
      </div>
    );
  }

  /* ------------------------- Voltou do Mercado Pago, aguardando o webhook */
  if (retorno === "sucesso" || retorno === "pendente") {
    return (
      <div className="container mx-auto max-w-md px-4 py-16 text-center">
        <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
        <h1 className="mt-5 font-display text-2xl font-bold">
          {retorno === "pendente" ? "Pagamento em análise" : "Confirmando seu pagamento"}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {retorno === "pendente"
            ? "Boleto e alguns cartões levam mais tempo para compensar. Assim que o Mercado Pago confirmar, seu ingresso chega por e-mail automaticamente."
            : "Isso costuma levar poucos segundos. Pode deixar esta página aberta — ela se atualiza sozinha."}
        </p>
        <p className="mt-6 text-xs text-muted-foreground">
          Você pode fechar sem problema: o ingresso vai para o seu e-mail de qualquer forma.
        </p>
        <Button asChild variant="outline" className="mt-6"><Link to="/meus-ingressos">Ir para meus ingressos</Link></Button>
      </div>
    );
  }

  const expired = remaining === 0;
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  const irParaPagamento = async () => {
    if (expired) return toast.error("Pedido expirado. Volte ao evento e faça um novo.");
    if (!compradorNome.trim()) return toast.error("Informe o nome do comprador.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(compradorEmail.trim())) {
      return toast.error("Informe um e-mail válido — é para lá que o ingresso vai.");
    }
    if (nomes.some((n) => !n.trim())) {
      return toast.error("Preencha o nome de cada participante.");
    }

    setEnviando(true);
    try {
      // 1. Reserva o estoque, aplica o cupom e grava os nomes
      const { error: erroReserva } = await supabase.rpc("reserve_order_stock", {
        _order_id: orderId,
        _attendees: nomes.map((n) => ({ name: n.trim() })),
        _coupon_code: coupon || undefined,
        _buyer_name: compradorNome.trim(),
        _buyer_email: compradorEmail.trim().toLowerCase(),
        _hold_minutes: 30,
      });
      if (erroReserva) throw new Error(erroReserva.message);

      // 2. Cria a cobrança no PagBank e segue para o ambiente deles
      const { data: cobranca, error: erroFn } = await supabase.functions.invoke("pagbank-criar-checkout", {
        body: { order_id: orderId },
      });
      if (erroFn) {
        const detalhe = (cobranca as { error?: string } | null)?.error;
        throw new Error(detalhe || "Não consegui abrir o pagamento. Tente de novo em instantes.");
      }
      const destino = (cobranca as { pay_url?: string })?.pay_url;
      if (!destino) throw new Error("O PagBank não retornou o endereço de pagamento.");

      window.location.href = destino;
    } catch (e) {
      setEnviando(false);
      const msg = e instanceof Error ? e.message : "Não consegui iniciar o pagamento.";
      toast.error(msg);
      refetch();
    }
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <Link
        to="/eventos/$slug"
        params={{ slug: order.events.slug }}
        className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />Voltar ao evento
      </Link>

      {retorno === "falha" && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-destructive/60 bg-destructive/10 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="text-sm">
            O pagamento não foi concluído. Nada foi cobrado — os ingressos continuam reservados até o fim do prazo abaixo.
          </p>
        </div>
      )}

      <div className={`mb-6 flex items-center justify-between rounded-xl border px-4 py-3 ${expired ? "border-destructive/60 bg-destructive/10" : "border-primary/40 bg-primary/10"}`}>
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4" />
          {expired ? "Pedido expirado" : "Tempo restante para concluir"}
        </div>
        <div className="font-display text-xl font-bold tabular-nums">{mm}:{ss}</div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="font-display text-xl font-semibold">Para onde enviamos o ingresso</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              O ingresso digital chega neste e-mail assim que o pagamento for aprovado.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="comprador-nome">Seu nome</Label>
                <Input
                  id="comprador-nome"
                  value={compradorNome}
                  onChange={(e) => setCompradorNome(e.target.value)}
                  autoComplete="name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="comprador-email">Seu e-mail</Label>
                <Input
                  id="comprador-email"
                  type="email"
                  inputMode="email"
                  value={compradorEmail}
                  onChange={(e) => setCompradorEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="font-display text-xl font-semibold">
              {totalQty > 1 ? "Quem vai usar cada ingresso" : "Quem vai usar o ingresso"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              O nome fica impresso no ingresso e é conferido na entrada. Não pedimos documento.
            </p>
            <div className="mt-4 space-y-3">
              {nomes.map((n, i) => (
                <div key={i} className="space-y-2">
                  <Label htmlFor={`participante-${i}`}>Nome completo {totalQty > 1 ? i + 1 : ""}</Label>
                  <Input
                    id={`participante-${i}`}
                    value={n}
                    onChange={(e) => {
                      const c = [...nomes];
                      c[i] = e.target.value;
                      setNomes(c);
                    }}
                    placeholder="Como está no documento"
                  />
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="font-display text-xl font-semibold">Cupom de desconto</h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Input
                className="max-w-xs uppercase"
                placeholder="CÓDIGO"
                value={coupon}
                onChange={(e) => setCoupon(e.target.value.toUpperCase())}
              />
              <span className="text-xs text-muted-foreground">Aplicado ao seguir para o pagamento</span>
            </div>
          </Card>
        </div>

        <Card className="h-fit p-6 lg:sticky lg:top-20">
          <h2 className="font-display text-lg font-semibold">{order.events.name}</h2>
          <p className="text-xs text-muted-foreground">{fmtDateTime(order.events.starts_at)}</p>

          <div className="mt-4 space-y-2 border-t border-border/60 pt-4 text-sm">
            {items.map((it: Record<string, unknown>) => {
              const b = it.ticket_batches as { name?: string; ticket_types?: { name?: string } } | null;
              return (
                <div key={String(it.id)} className="flex justify-between gap-3">
                  <span>
                    {String(it.qty)}× {b?.ticket_types?.name}{" "}
                    <span className="text-muted-foreground">({b?.name})</span>
                  </span>
                  <span className="whitespace-nowrap">{brl(Number(it.qty) * Number(it.unit_price_cents))}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-4">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="font-display text-xl font-bold">{brl(order.total_cents)}</span>
          </div>

          <Button className="mt-4 w-full" size="lg" onClick={irParaPagamento} disabled={enviando || expired}>
            {enviando ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Abrindo o Mercado Pago...</> : "Pagar com Mercado Pago"}
          </Button>

          <div className="mt-4 space-y-2 text-xs text-muted-foreground">
            <p className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Pix, cartão e boleto são processados dentro do Mercado Pago. Nenhum dado de pagamento passa por este site.
            </p>
            <p className="flex items-start gap-2">
              <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              O ingresso com QR Code chega por e-mail e também fica em "Meus ingressos".
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
