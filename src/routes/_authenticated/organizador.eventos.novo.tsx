import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { slugify } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/organizador/eventos/novo")({
  component: NewEvent,
});

function NewEvent() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [venue, setVenue] = useState("");
  const [address, setAddress] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`;
    const { data, error } = await supabase
      .from("events")
      .insert({
        organizer_id: user.id,
        name,
        slug,
        description: description || null,
        venue: venue || null,
        address: address || null,
        starts_at: new Date(startsAt).toISOString(),
        cover_url: coverUrl || null,
        status: "draft",
      })
      .select("id")
      .single();
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Evento criado! Agora cadastre os ingressos.");
    navigate({ to: "/organizador/eventos/$id/editar", params: { id: data.id } });
  };

  return (
    <Card className="mx-auto max-w-2xl p-6">
      <h2 className="font-display text-2xl font-bold">Novo evento</h2>
      <p className="mt-1 text-sm text-muted-foreground">Preencha os dados básicos. Você poderá adicionar tipos de ingresso e lotes depois.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nome do evento *</Label>
          <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="desc">Descrição</Label>
          <Textarea id="desc" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="venue">Local</Label>
            <Input id="venue" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Ex.: Allianz Parque" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="addr">Endereço</Label>
            <Input id="addr" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="starts">Data e hora *</Label>
            <Input id="starts" type="datetime-local" required value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cover">URL da capa</Label>
            <Input id="cover" type="url" value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="https://..." />
          </div>
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Criando..." : "Criar evento"}
        </Button>
      </form>
    </Card>
  );
}
