import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEventoAdmin } from "@/hooks/use-evento-admin";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { WaConversas } from "@/components/wa-conversas";
import { toast } from "sonner";
import {
  Ban,
  BotOff,
  Check,
  Loader2,
  MessageCircle,
  Pencil,
  Plus,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/whatsapp")({
  component: AdminWhatsapp,
});

type Contato = {
  id: string;
  wa_id: string;
  nome: string | null;
  humano_assumiu: boolean;
  humano_ate: string | null;
  bloqueado: boolean;
  ultima_em: string;
};

type Faq = { id: string; pergunta: string; resposta: string; ordem: number; ativo: boolean };

function AdminWhatsapp() {
  const { evento, loading } = useEventoAdmin();
  const [aba, setAba] = useState<"conversas" | "respostas">("conversas");

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!evento) return <Card className="p-12 text-center text-muted-foreground">Nenhum evento.</Card>;

  return (
    <div className="space-y-6">
      <div className="flex gap-2 text-sm">
        {(["conversas", "respostas"] as const).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAba(a)}
            className={`rounded-md border px-3 py-2 transition-colors ${
              aba === a
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border/60 hover:bg-secondary"
            }`}
          >
            {a === "conversas" ? "Conversas" : "Base de respostas"}
          </button>
        ))}
      </div>

      {aba === "conversas" ? <WaConversas eventId={evento.id} /> : <BaseRespostas eventId={evento.id} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════ base de respostas */

function BaseRespostas({ eventId }: { eventId: string }) {
  const qc = useQueryClient();
  const [editando, setEditando] = useState<string | null>(null);
  const [novo, setNovo] = useState(false);
  const [pergunta, setPergunta] = useState("");
  const [resposta, setResposta] = useState("");
  const [salvando, setSalvando] = useState(false);

  const { data: itens, isLoading } = useQuery({
    queryKey: ["wa-faq", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wa_faq")
        .select("id, pergunta, resposta, ordem, ativo")
        .eq("event_id", eventId)
        .order("ordem");
      if (error) throw error;
      return data as Faq[];
    },
  });

  const limpar = () => {
    setEditando(null);
    setNovo(false);
    setPergunta("");
    setResposta("");
  };

  const abrirEdicao = (f: Faq) => {
    setNovo(false);
    setEditando(f.id);
    setPergunta(f.pergunta);
    setResposta(f.resposta);
  };

  const salvar = async () => {
    if (!pergunta.trim() || !resposta.trim()) return toast.error("Preencha a pergunta e a resposta");
    setSalvando(true);
    try {
      if (editando) {
        const { error } = await supabase
          .from("wa_faq")
          .update({ pergunta: pergunta.trim(), resposta: resposta.trim(), updated_at: new Date().toISOString() })
          .eq("id", editando);
        if (error) throw error;
      } else {
        const proxima = (itens?.reduce((m, f) => Math.max(m, f.ordem), 0) ?? 0) + 10;
        const { error } = await supabase.from("wa_faq").insert({
          event_id: eventId,
          pergunta: pergunta.trim(),
          resposta: resposta.trim(),
          ordem: proxima,
        });
        if (error) throw error;
      }
      toast.success("Resposta salva. A IA já passa a usar.");
      limpar();
      qc.invalidateQueries({ queryKey: ["wa-faq", eventId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui salvar");
    } finally {
      setSalvando(false);
    }
  };

  const alternar = async (f: Faq) => {
    const { error } = await supabase.from("wa_faq").update({ ativo: !f.ativo }).eq("id", f.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["wa-faq", eventId] });
  };

  const apagar = async (f: Faq) => {
    const { error } = await supabase.from("wa_faq").delete().eq("id", f.id);
    if (error) return toast.error(error.message);
    toast.success("Resposta removida");
    qc.invalidateQueries({ queryKey: ["wa-faq", eventId] });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 bg-secondary/30 p-4 text-sm text-muted-foreground">
        A IA responde <span className="font-medium text-foreground">somente</span> com o que estiver
        aqui, mais o preço e a disponibilidade que ela lê do banco na hora. Se a pergunta não estiver
        nesta lista, ela chama uma pessoa em vez de arriscar.
      </div>

      {!novo && !editando && (
        <Button size="sm" onClick={() => { limpar(); setNovo(true); }}>
          <Plus className="mr-1.5 h-4 w-4" />Nova resposta
        </Button>
      )}

      {(novo || editando) && (
        <Card className="space-y-4 p-5">
          <h3 className="font-display text-lg font-semibold">
            {editando ? "Editar resposta" : "Nova resposta"}
          </h3>
          <div className="space-y-2">
            <Label htmlFor="pergunta">Pergunta</Label>
            <Input
              id="pergunta"
              value={pergunta}
              onChange={(e) => setPergunta(e.target.value)}
              placeholder="Ex.: Pode levar cadeira de praia?"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="resposta">Resposta</Label>
            <Textarea
              id="resposta"
              value={resposta}
              onChange={(e) => setResposta(e.target.value)}
              rows={4}
              placeholder="Escreva como você quer que a pessoa seja respondida."
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={salvar} disabled={salvando}>
              {salvando ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
              Salvar
            </Button>
            <Button size="sm" variant="outline" onClick={limpar}>
              <X className="mr-1.5 h-4 w-4" />Cancelar
            </Button>
          </div>
        </Card>
      )}

      {isLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}

      <div className="space-y-2">
        {itens?.map((f) => (
          <Card key={f.id} className={`p-4 ${f.ativo ? "" : "opacity-50"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{f.pergunta}</div>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {f.resposta}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => abrirEdicao(f)}
                        title="Editar">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => alternar(f)}
                        title={f.ativo ? "Desativar" : "Ativar"}>
                  {f.ativo ? <BotOff className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                </Button>
                <Button size="icon" variant="ghost" className="h-9 w-9 text-destructive"
                        onClick={() => apagar(f)} title="Apagar">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
