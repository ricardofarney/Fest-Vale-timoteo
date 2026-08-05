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
import { Plus, Trash2, ExternalLink } from "lucide-react";

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

      <TicketTypesPanel eventId={id} types={typesQ.data ?? []} onChange={() => typesQ.refetch()} />

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
      <Button className="mt-6" onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar alterações"}</Button>
    </Card>
  );
}

function TicketTypesPanel({ eventId, types, onChange }: { eventId: string; types: any[]; onChange: () => void }) {
  const [name, setName] = useState("");
  const [isHalf, setIsHalf] = useState(false);

  const addType = async () => {
    if (!name) return;
    const { error } = await supabase.from("ticket_types").insert({ event_id: eventId, name, is_half_price: isHalf, sort_order: types.length });
    if (error) return toast.error(error.message);
    setName(""); setIsHalf(false);
    onChange();
  };

  const removeType = async (id: string) => {
    if (!confirm("Remover este tipo e todos os lotes?")) return;
    const { error } = await supabase.from("ticket_types").delete().eq("id", id);
    if (error) return toast.error(error.message);
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
              <Button size="icon" variant="ghost" onClick={() => removeType(t.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
            <BatchesEditor typeId={t.id} batches={t.ticket_batches ?? []} onChange={onChange} />
          </div>
        ))}
      </div>
    </Card>
  );
}

function BatchesEditor({ typeId, batches, onChange }: { typeId: string; batches: any[]; onChange: () => void }) {
  const [form, setForm] = useState({ name: "1º lote", price: "", qty: "", ends_at: "" });

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

  const removeBatch = async (id: string) => {
    const { error } = await supabase.from("ticket_batches").delete().eq("id", id);
    if (error) return toast.error(error.message);
    onChange();
  };

  return (
    <div className="mt-3 space-y-2">
      {batches.sort((a, b) => a.sort_order - b.sort_order).map((b) => (
        <div key={b.id} className="flex flex-wrap items-center gap-3 rounded-md bg-secondary/40 px-3 py-2 text-sm">
          <span className="font-medium">{b.name}</span>
          <span className="text-primary">{brl(b.price_cents)}</span>
          <span className="text-muted-foreground">{b.quantity_sold}/{b.quantity_total} vendidos</span>
          {b.ends_at && <span className="text-xs text-muted-foreground">até {new Date(b.ends_at).toLocaleString("pt-BR")}</span>}
          <Button size="icon" variant="ghost" className="ml-auto h-7 w-7" onClick={() => removeBatch(b.id)}><Trash2 className="h-3 w-3" /></Button>
        </div>
      ))}
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
