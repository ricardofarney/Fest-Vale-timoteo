import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { brl, fmtDateTime } from "@/lib/format";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CreditCard, QrCode, FileText, Clock, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/checkout/$orderId")({
  head: () => ({ meta: [{ title: "Finalizar compra — Palco" }] }),
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
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ["order", orderId], queryFn: () => fetchOrder(orderId) });
  const [method, setMethod] = useState<"pix" | "card" | "boleto">("pix");
  const [coupon, setCoupon] = useState("");
  const [attendees, setAttendees] = useState<{ name: string; doc: string }[]>([]);
  const [paying, setPaying] = useState(false);
  const [remaining, setRemaining] = useState<number>(0);

  const totalQty = useMemo(
    () => (data?.items ?? []).reduce((acc, it) => acc + it.qty, 0),
    [data],
  );

  useEffect(() => {
    if (totalQty && attendees.length !== totalQty) {
      setAttendees(Array.from({ length: totalQty }, (_, i) => attendees[i] ?? { name: "", doc: "" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalQty]);

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

  if (order.status === "paid") {
    return (
      <div className="container mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold">Pedido já confirmado</h1>
        <Button asChild className="mt-6"><Link to="/meus-ingressos">Ver meus ingressos</Link></Button>
      </div>
    );
  }

  const expired = remaining === 0;
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  const handlePay = async () => {
    if (expired) return toast.error("Pedido expirado. Volte ao evento e crie um novo.");
    setPaying(true);
    const { error } = await supabase.rpc("confirm_order_payment", {
      _order_id: orderId,
      _payment_method: method,
      _attendees: attendees,
      _coupon_code: coupon || undefined,
    });
    setPaying(false);
    if (error) return toast.error(error.message);
    toast.success("Pagamento confirmado! Seus ingressos foram gerados.");
    navigate({ to: "/meus-ingressos" });
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <Link to="/eventos/$slug" params={{ slug: order.events.slug }} className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" />Voltar ao evento
      </Link>

      <div className={`mb-6 flex items-center justify-between rounded-xl border px-4 py-3 ${expired ? "border-destructive/60 bg-destructive/10" : "border-primary/40 bg-primary/10"}`}>
        <div className="flex items-center gap-2 text-sm"><Clock className="h-4 w-4" />{expired ? "Pedido expirado" : "Tempo restante para concluir"}</div>
        <div className="font-display text-xl font-bold tabular-nums">{mm}:{ss}</div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="font-display text-xl font-semibold">Participantes</h2>
            <p className="mt-1 text-sm text-muted-foreground">Os nomes ficam impressos no ingresso para validação na entrada.</p>
            <div className="mt-4 space-y-3">
              {attendees.map((a, i) => (
                <div key={i} className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2"><Label>Nome completo {i + 1}</Label><Input value={a.name} onChange={(e) => { const c = [...attendees]; c[i] = { ...c[i], name: e.target.value }; setAttendees(c); }} /></div>
                  <div className="space-y-2"><Label>Documento</Label><Input value={a.doc} onChange={(e) => { const c = [...attendees]; c[i] = { ...c[i], doc: e.target.value }; setAttendees(c); }} placeholder="CPF ou RG" /></div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="font-display text-xl font-semibold">Cupom de desconto</h2>
            <div className="mt-3 flex gap-2">
              <Input className="max-w-xs uppercase" placeholder="CÓDIGO" value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} />
              <span className="self-center text-xs text-muted-foreground">Será aplicado ao confirmar</span>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="font-display text-xl font-semibold">Forma de pagamento</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                { id: "pix", label: "Pix", icon: QrCode, hint: "Aprovação instantânea" },
                { id: "card", label: "Cartão", icon: CreditCard, hint: "Crédito ou débito" },
                { id: "boleto", label: "Boleto", icon: FileText, hint: "Até 3 dias úteis" },
              ].map((m) => {
                const Icon = m.icon;
                const active = method === m.id;
                return (
                  <button key={m.id} type="button" onClick={() => setMethod(m.id as typeof method)} className={`rounded-lg border p-4 text-left transition-colors ${active ? "border-primary bg-primary/10" : "border-border/60 hover:bg-secondary/40"}`}>
                    <Icon className={`h-5 w-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                    <div className="mt-2 font-semibold">{m.label}</div>
                    <div className="text-xs text-muted-foreground">{m.hint}</div>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Pagamento simulado — clicar em "Confirmar pagamento" aprova o pedido imediatamente.
            </p>
          </Card>
        </div>

        <Card className="h-fit p-6 lg:sticky lg:top-20">
          <h2 className="font-display text-lg font-semibold">{order.events.name}</h2>
          <p className="text-xs text-muted-foreground">{fmtDateTime(order.events.starts_at)}</p>
          <div className="mt-4 space-y-2 border-t border-border/60 pt-4 text-sm">
            {items.map((it: any) => (
              <div key={it.id} className="flex justify-between">
                <span>{it.qty}× {it.ticket_batches?.ticket_types?.name} <span className="text-muted-foreground">({it.ticket_batches?.name})</span></span>
                <span>{brl(it.qty * it.unit_price_cents)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-4">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="font-display text-xl font-bold">{brl(order.total_cents)}</span>
          </div>
          <Button className="mt-4 w-full" size="lg" onClick={handlePay} disabled={paying || expired}>
            {paying ? "Processando..." : "Confirmar pagamento"}
          </Button>
        </Card>
      </div>
    </div>
  );
}
