import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { brl } from "@/lib/format";
import { Plus, Trash2, ExternalLink, Ban, RotateCcw, Pencil, Check, X, FlaskConical } from "lucide-react";

/** O Postgres recusa apagar algo que ainda está preso a um pedido. A mensagem
 *  dele é técnica demais para quem organiza o evento. */
function traduzErro(error: { message: string; code?: string }): string {
  const fk = error.code === "23503" || /foreign key|violates/i.test(error.message);
  if (fk) {
    return "Não dá para apagar: existe pedido ligado a este item. " +
      "Encerre o lote para parar a venda — assim o histórico de quem já comprou continua valendo.";
  }
  return error.message;
}

/** Dois lotes podem se chamar "1º lote" no mesmo evento. Sem o preço junto,
 *  não dá para saber de qual a mensagem está falando. */
const rotulo = (b: { name: string; price_cents: number }) =>
  `"${b.name} — ${brl(b.price_cents)}"`;

/** Lote com data de encerramento já passada. */
const encerrado = (b: { ends_at?: string | null }) =>
  !!b.ends_at && new Date(b.ends_at) <= new Date();

export const Route = createFileRoute("/_authenticated/organizador/eventos/$id/editar")({
  component: EditEvent,
});

function EditEvent() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const eventQ = useQuery({
    queryKey: ["org-event", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });
  const typesQ = useQuery({
    queryKey: ["org-types", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_types")
        .select("*, ticket_batches(*)")
        .eq("event_id", id)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });
  const couponsQ = useQuery({
    queryKey: ["org-coupons", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("coupons").select("*").eq("event_id", id);
      if (error) throw error;
      return data;
    },
  });

  if (eventQ.isLoading || !eventQ.data) return <div>Carregando...</div>;
  const ev = eventQ.data;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild size="sm" variant="outline"><Link to="/organizador">← Voltar</Link></Button>
        {ev.status === "published" && (
          <Button asChild size="sm" variant="outline">
            <Link to="/eventos/$slug" params={{ slug: ev.slug }} target="_blank"><ExternalLink className="mr-1 h-4 w-4" />Ver página pública</Link>
          </Button>
        )}
      </div>

      <EventDetailsForm ev={ev} onSaved={() => qc.invalidateQueries({ queryKey: ["org-event", id] })} />

      <TicketTypesPanel eventId={id} modoTeste={!!ev.modo_teste} types={typesQ.data ?? []} onChange={() => typesQ.refetch()} />

      <CouponsPanel eventId={id} coupons={couponsQ.data ?? []} onChange={() => couponsQ.refetch()} />
    </div>
  );
}

function EventDetailsForm({ ev, onSaved }: { ev: any; onSaved: () => void }) {
  const [form, setForm] = useState(() => ({
    name: ev.name,
    description: ev.description ?? "",
    venue: ev.venue ?? "",
    address: ev.address ?? "",
    cover_url: ev.cover_url ?? "",
    starts_at: ev.starts_at?.slice(0, 16) ?? "",
    status: ev.status,
    modo_teste: !!ev.modo_teste,
  }));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("events")
      .update({
        name: form.name,
        description: form.description || null,
        venue: form.venue || null,
        address: form.address || null,
        cover_url: form.cover_url || null,
        starts_at: new Date(form.starts_at).toISOString(),
        status: form.status,
        modo_teste: form.modo_teste,
      })
      .eq("id", ev.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Evento atualizado");
    onSaved();
  };

  return (
    <Card className="p-6">
      <h2 className="font-display text-xl font-semibold">Detalhes do evento</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2 space-y-2">
          <Label>Nome</Label>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="md:col-span-2 space-y-2">
          <Label>Descrição</Label>
          <Textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="space-y-2"><Label>Local</Label><Input value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} /></div>
        <div className="space-y-2"><Label>Endereço</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        <div className="space-y-2"><Label>Data e hora</Label><Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></div>
        <div className="space-y-2"><Label>URL da capa</Label><Input value={form.cover_url} onChange={(e) => setForm({ ...form, cover_url: e.target.value })} /></div>
        <div className="space-y-2">
          <Label>Status</Label>
          <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="draft">Rascunho</option>
            <option value="published">Publicado</option>
          </select>
        </div>
      </div>
      <div className={`mt-6 rounded-xl border p-4 ${form.modo_teste ? "border-accent/50 bg-accent/10" : "border-border/60"}`}>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-1"
            checked={form.modo_teste}
            onChange={(e) => setForm({ ...form, modo_teste: e.target.checked })}
          />
          <span className="text-sm">
            <span className="flex items-center gap-2 font-medium text-foreground">
              <FlaskConical className="h-4 w-4" />Evento em modo de teste
            </span>
            <span className="mt-1 block text-muted-foreground">
              Enquanto isto estiver ligado, você pode apagar lotes e tipos de ingresso mesmo que
              tenham vendas, e os pedidos e ingressos correspondentes vão junto. É o que se quer
              enquanto o evento está sendo montado com dados fictícios.
              <strong className="block text-foreground">
                Desligue antes de começar a vender de verdade: com isso desligado, um lote vendido
                só pode ser encerrado, nunca apagado.
              </strong>
            </span>
          </span>
        </label>
      </div>

      <Button className="mt-6" onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar alterações"}</Button>
    </Card>
  );
}

function TicketTypesPanel({ eventId, modoTeste, types, onChange }: { eventId: string; modoTeste: boolean; types: any[]; onChange: () => void }) {
  const [name, setName] = useState("");
  const [isHalf, setIsHalf] = useState(false);

  const addType = async () => {
    if (!name) return;
    const { error } = await supabase.from("ticket_types").insert({ event_id: eventId, name, is_half_price: isHalf, sort_order: types.length });
    if (error) return toast.error(error.message);
    setName(""); setIsHalf(false);
    onChange();
  };

  const removeType = async (t: any) => {
    const vendidos = (t.ticket_batches ?? [])
      .reduce((soma: number, b: any) => soma + (b.quantity_sold ?? 0), 0);

    if (vendidos > 0 && !modoTeste) {
      return toast.error(
        `"${t.name}" já tem ${vendidos} ingresso(s) vendido(s) e não pode ser apagado — ` +
        `os pedidos de quem comprou ficariam sem referência. Encerre os lotes para parar a venda.`,
        { duration: 9000 },
      );
    }

    if (vendidos > 0) {
      const ok = confirm(
        `MODO DE TESTE\n\nApagar "${t.name}" vai apagar também os ${vendidos} ingresso(s) ` +
        `vendido(s) nos lotes dele e os pedidos correspondentes.\n\nIsto não tem volta. Continuar?`,
      );
      if (!ok) return;
      const { data, error } = await supabase.rpc("excluir_tipo_em_teste", { _type_id: t.id });
      if (error) return toast.error(traduzErro(error));
      toast.success(`"${t.name}" apagado com ${(data as any)?.lotes ?? 0} lote(s).`);
      return onChange();
    }

    if (!confirm(`Remover o tipo "${t.name}" e os lotes dele? Não há nenhuma venda.`)) return;
    const { error } = await supabase.from("ticket_types").delete().eq("id", t.id);
    if (error) return toast.error(traduzErro(error));
    toast.success("Tipo removido");
    onChange();
  };

  return (
    <Card className="p-6">
      <h2 className="font-display text-xl font-semibold">Tipos de ingresso e lotes</h2>
      <p className="mt-1 text-sm text-muted-foreground">Crie tipos (Pista, VIP, Meia...) e defina lotes com data e quantidade. A virada é automática.</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Input className="max-w-xs" placeholder="Nome do tipo (ex.: Pista)" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isHalf} onChange={(e) => setIsHalf(e.target.checked)} /> Meia-entrada
        </label>
        <Button onClick={addType}><Plus className="mr-1 h-4 w-4" />Adicionar tipo</Button>
      </div>

      <div className="mt-6 space-y-4">
        {types.map((t) => (
          <div key={t.id} className="rounded-lg border border-border/60 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">{t.name} {t.is_half_price && <span className="ml-2 rounded bg-accent/20 px-2 py-0.5 text-xs text-accent">meia</span>}</div>
              </div>
              <Button size="icon" variant="ghost" onClick={() => removeType(t)}><Trash2 className="h-4 w-4" /></Button>
            </div>
            <BatchesEditor typeId={t.id} modoTeste={modoTeste} batches={t.ticket_batches ?? []} onChange={onChange} />
          </div>
        ))}
      </div>
    </Card>
  );
}

function BatchesEditor({ typeId, modoTeste, batches, onChange }: { typeId: string; modoTeste: boolean; batches: any[]; onChange: () => void }) {
  const [form, setForm] = useState({ name: "1º lote", price: "", qty: "", ends_at: "" });
  const [editando, setEditando] = useState<string | null>(null);
  const [edicao, setEdicao] = useState({ name: "", price: "", qty: "", ends_at: "" });

  const addBatch = async () => {
    if (!form.name || !form.price || !form.qty) return toast.error("Preencha nome, preço e quantidade");
    const { error } = await supabase.from("ticket_batches").insert({
      ticket_type_id: typeId,
      name: form.name,
      price_cents: Math.round(parseFloat(form.price) * 100),
      quantity_total: parseInt(form.qty),
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      sort_order: batches.length,
    });
    if (error) return toast.error(error.message);
    setForm({ name: `${batches.length + 2}º lote`, price: "", qty: "", ends_at: "" });
    onChange();
  };

  /** Abre a linha para edição, já preenchida com o que está valendo. */
  const abrirEdicao = (b: any) => {
    setEditando(b.id);
    setEdicao({
      name: b.name,
      price: (b.price_cents / 100).toFixed(2),
      qty: String(b.quantity_total),
      // datetime-local não aceita fuso; corta para o formato que ele espera
      ends_at: b.ends_at ? new Date(b.ends_at).toISOString().slice(0, 16) : "",
    });
  };

  const salvarEdicao = async (b: any) => {
    const preco = Math.round(parseFloat(edicao.price) * 100);
    const qtd = parseInt(edicao.qty);
    if (!edicao.name.trim()) return toast.error("O lote precisa de um nome.");
    if (!Number.isFinite(preco) || preco < 0) return toast.error("Preço inválido.");
    if (!Number.isFinite(qtd)) return toast.error("Quantidade inválida.");
    // Reduzir abaixo do que já saiu deixaria o lote com estoque negativo.
    if (qtd < (b.quantity_sold ?? 0)) {
      return toast.error(
        `Este lote já vendeu ${b.quantity_sold}. A quantidade não pode ficar abaixo disso.`,
      );
    }

    const { error } = await supabase
      .from("ticket_batches")
      .update({
        name: edicao.name.trim(),
        price_cents: preco,
        quantity_total: qtd,
        ends_at: edicao.ends_at ? new Date(edicao.ends_at).toISOString() : null,
      })
      .eq("id", b.id);
    if (error) return toast.error(traduzErro(error));
    // Quem já comprou pagou o valor gravado no pedido: mexer aqui só vale daqui para a frente.
    toast.success("Lote atualizado. Quem já comprou mantém o preço que pagou.");
    setEditando(null);
    onChange();
  };

  /** Para a venda sem destruir o histórico: é o que se quer em 9 de 10 casos. */
  const encerrarBatch = async (b: any) => {
    const { error } = await supabase
      .from("ticket_batches")
      .update({ ends_at: new Date().toISOString() })
      .eq("id", b.id);
    if (error) return toast.error(traduzErro(error));
    toast.success(`${rotulo(b)} encerrado. Ele para de vender e o histórico continua.`);
    onChange();
  };

  /** Desfaz um encerramento feito por engano. */
  const reabrirBatch = async (b: any) => {
    const { error } = await supabase
      .from("ticket_batches")
      .update({ ends_at: null })
      .eq("id", b.id);
    if (error) return toast.error(traduzErro(error));
    toast.success(`${rotulo(b)} voltou a vender.`);
    onChange();
  };

  const removeBatch = async (b: any) => {
    const vendidos = b.quantity_sold ?? 0;

    if (vendidos > 0 && !modoTeste) {
      return toast.error(
        `${rotulo(b)} já vendeu ${vendidos} ingresso(s) e não pode ser apagado — ` +
        `os pedidos de quem comprou ficariam sem referência. Use "Encerrar" para parar a venda.`,
        { duration: 9000 },
      );
    }

    if (vendidos > 0) {
      // Em teste é permitido, mas o organizador precisa ver o tamanho do estrago.
      const { data: resumo } = await supabase.rpc("resumo_exclusao_lote", { _batch_id: b.id });
      const r = (resumo ?? {}) as { ingressos?: number; pedidos?: number; check_ins?: number };
      const ok = confirm(
        `MODO DE TESTE\n\nApagar ${rotulo(b)} vai apagar junto:\n` +
        `• ${r.ingressos ?? 0} ingresso(s)\n` +
        `• ${r.pedidos ?? 0} pedido(s)\n` +
        `• ${r.check_ins ?? 0} registro(s) de entrada\n\n` +
        `Isto não tem volta. Continuar?`,
      );
      if (!ok) return;
      const { error } = await supabase.rpc("excluir_lote_em_teste", { _batch_id: b.id });
      if (error) return toast.error(traduzErro(error));
      toast.success("Lote apagado com os dados de teste dele.");
      return onChange();
    }

    if (!confirm(`Apagar ${rotulo(b)}? Ele não tem nenhuma venda.`)) return;
    const { error } = await supabase.from("ticket_batches").delete().eq("id", b.id);
    if (error) return toast.error(traduzErro(error));
    toast.success("Lote apagado");
    onChange();
  };

  return (
    <div className="mt-3 space-y-2">
      {batches.sort((a, b) => a.sort_order - b.sort_order).map((b) =>
        editando === b.id ? (
          <div key={b.id} className="flex flex-wrap items-end gap-2 rounded-md border border-primary/40 bg-secondary/40 px-3 py-3">
            <div><Label className="text-xs">Lote</Label>
              <Input className="w-32" value={edicao.name} onChange={(e) => setEdicao({ ...edicao, name: e.target.value })} /></div>
            <div><Label className="text-xs">Preço (R$)</Label>
              <Input className="w-28" type="number" step="0.01" value={edicao.price} onChange={(e) => setEdicao({ ...edicao, price: e.target.value })} /></div>
            <div><Label className="text-xs">Qtd.</Label>
              <Input className="w-24" type="number" value={edicao.qty} onChange={(e) => setEdicao({ ...edicao, qty: e.target.value })} /></div>
            <div><Label className="text-xs">Encerra em</Label>
              <Input className="w-52" type="datetime-local" value={edicao.ends_at} onChange={(e) => setEdicao({ ...edicao, ends_at: e.target.value })} /></div>
            <Button size="sm" onClick={() => salvarEdicao(b)}><Check className="mr-1 h-3 w-3" />Salvar</Button>
            <Button size="sm" variant="outline" onClick={() => setEditando(null)}><X className="mr-1 h-3 w-3" />Cancelar</Button>
            {(b.quantity_sold ?? 0) > 0 && (
              <p className="w-full text-xs text-muted-foreground">
                {b.quantity_sold} já vendido(s). Mudar o preço vale só para as próximas compras, e a
                quantidade não pode ficar abaixo desse número.
              </p>
            )}
          </div>
        ) : (
          <div key={b.id} className="flex flex-wrap items-center gap-3 rounded-md bg-secondary/40 px-3 py-2 text-sm">
            <span className="font-medium">{b.name}</span>
            <span className="text-primary">{brl(b.price_cents)}</span>
            <span className="text-muted-foreground">{b.quantity_sold}/{b.quantity_total} vendidos</span>
            {b.ends_at && <span className="text-xs text-muted-foreground">até {new Date(b.ends_at).toLocaleString("pt-BR")}</span>}
            {encerrado(b) && (
              <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                encerrado — não está vendendo
              </span>
            )}
            <div className="ml-auto flex items-center gap-1">
              <Button size="icon" variant="ghost" className="h-7 w-7" title="Editar o lote"
                      onClick={() => abrirEdicao(b)}>
                <Pencil className="h-3 w-3" />
              </Button>
              {encerrado(b) ? (
                <Button size="icon" variant="ghost" className="h-7 w-7" title="Voltar a vender este lote"
                        onClick={() => reabrirBatch(b)}>
                  <RotateCcw className="h-3 w-3" />
                </Button>
              ) : (
                <Button size="icon" variant="ghost" className="h-7 w-7" title="Encerrar a venda deste lote"
                        onClick={() => encerrarBatch(b)}>
                  <Ban className="h-3 w-3" />
                </Button>
              )}
              <Button size="icon" variant="ghost" className="h-7 w-7" title="Apagar o lote"
                      onClick={() => removeBatch(b)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ),
      )}
      <div className="flex flex-wrap items-end gap-2 pt-2">
        <div><Label className="text-xs">Lote</Label><Input className="w-32" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div><Label className="text-xs">Preço (R$)</Label><Input className="w-28" type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
        <div><Label className="text-xs">Qtd.</Label><Input className="w-24" type="number" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} /></div>
        <div><Label className="text-xs">Encerra em</Label><Input className="w-52" type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} /></div>
        <Button size="sm" onClick={addBatch}><Plus className="mr-1 h-3 w-3" />Lote</Button>
      </div>
    </div>
  );
}

function CouponsPanel({ eventId, coupons, onChange }: { eventId: string; coupons: any[]; onChange: () => void }) {
  const [form, setForm] = useState({ code: "", discount_pct: "", max_uses: "" });

  const add = async () => {
    if (!form.code) return;
    const { error } = await supabase.from("coupons").insert({
      event_id: eventId,
      code: form.code.toUpperCase(),
      discount_pct: form.discount_pct ? parseInt(form.discount_pct) : null,
      max_uses: form.max_uses ? parseInt(form.max_uses) : null,
    });
    if (error) return toast.error(error.message);
    setForm({ code: "", discount_pct: "", max_uses: "" });
    onChange();
  };

  const remove = async (id: string) => {
    await supabase.from("coupons").delete().eq("id", id);
    onChange();
  };

  return (
    <Card className="p-6">
      <h2 className="font-display text-xl font-semibold">Cupons de desconto</h2>
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <div><Label className="text-xs">Código</Label><Input className="w-40" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
        <div><Label className="text-xs">Desconto (%)</Label><Input className="w-28" type="number" value={form.discount_pct} onChange={(e) => setForm({ ...form, discount_pct: e.target.value })} /></div>
        <div><Label className="text-xs">Limite de usos</Label><Input className="w-28" type="number" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} /></div>
        <Button onClick={add}><Plus className="mr-1 h-4 w-4" />Criar cupom</Button>
      </div>
      <div className="mt-4 space-y-2">
        {coupons.map((c) => (
          <div key={c.id} className="flex items-center gap-3 rounded-md bg-secondary/40 px-3 py-2 text-sm">
            <span className="font-mono font-semibold">{c.code}</span>
            <span className="text-muted-foreground">{c.discount_pct ? `${c.discount_pct}% off` : `${brl(c.discount_cents ?? 0)} off`}</span>
            <span className="text-xs text-muted-foreground">{c.used_count}/{c.max_uses ?? "∞"} usos</span>
            <Button size="icon" variant="ghost" className="ml-auto h-7 w-7" onClick={() => remove(c.id)}><Trash2 className="h-3 w-3" /></Button>
          </div>
        ))}
        {!coupons.length && <p className="text-sm text-muted-foreground">Nenhum cupom criado.</p>}
      </div>
    </Card>
  );
}
