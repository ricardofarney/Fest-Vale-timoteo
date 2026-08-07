import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEventoAdmin } from "@/hooks/use-evento-admin";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Check, Copy, ExternalLink, Loader2, ShieldCheck, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/integracoes")({
  component: Integracoes,
});

type Item = { nome: string; rotulo: string; ok: boolean; opcional?: boolean };
type Grupo = { chave: string; nome: string; descricao: string; itens: Item[]; pronto: boolean; faltam: number };
type Status = { grupos: Grupo[]; webhooks: Record<string, string>; verificado_em: string };

function Integracoes() {
  const { evento, loading } = useEventoAdmin();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["admin-status", evento?.id],
    enabled: !!evento,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-status", {
        body: { event_id: evento!.id },
      });
      if (error) throw error;
      return data as Status;
    },
  });

  if (loading || isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!evento) return <Card className="p-12 text-center text-muted-foreground">Nenhum evento.</Card>;

  const prontos = data?.grupos.filter((g) => g.pronto).length ?? 0;
  const total = data?.grupos.length ?? 0;

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <h2 className="font-display text-xl font-bold">
            {prontos} de {total} integrações ligadas
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Esta tela só mostra se a chave existe. Nenhum valor de senha ou token aparece aqui,
            nem para você.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isRefetching}>
          {isRefetching ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
          Verificar de novo
        </Button>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        {data?.grupos.map((g) => (
          <Card key={g.chave} className={`p-5 ${g.pronto ? "border-success/40" : "border-border/60"}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-display text-lg font-semibold">{g.nome}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{g.descricao}</p>
              </div>
              <span
                className={`shrink-0 rounded px-2 py-1 text-xs font-medium ${
                  g.pronto ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"
                }`}
              >
                {g.pronto ? "ligado" : `faltam ${g.faltam}`}
              </span>
            </div>

            <ul className="mt-4 space-y-2">
              {g.itens.map((i) => (
                <li key={i.nome} className="flex items-center gap-2 text-sm">
                  {i.ok ? (
                    <Check className="h-4 w-4 shrink-0 text-success" />
                  ) : (
                    <X className={`h-4 w-4 shrink-0 ${i.opcional ? "text-muted-foreground" : "text-destructive"}`} />
                  )}
                  <span className={i.ok ? "" : "text-muted-foreground"}>
                    {i.rotulo}
                    {i.opcional && !i.ok && " (opcional)"}
                  </span>
                  <code className="ml-auto shrink-0 rounded bg-secondary/60 px-1.5 py-0.5 text-[11px] text-muted-foreground">
                    {i.nome}
                  </code>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      {/* ─────────────────────────────────────────────────── endereços */}
      <Card className="p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <h3 className="font-display text-lg font-semibold">Endereços para cadastrar</h3>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Cole cada um no painel do serviço correspondente.
        </p>
        <div className="mt-4 space-y-3">
          <Endereco
            titulo="Webhook do Mercado Pago"
            valor={data?.webhooks.mercado_pago ?? ""}
            onde="Mercado Pago → Suas integrações → Webhooks"
          />
          <Endereco
            titulo="Webhook do WhatsApp"
            valor={data?.webhooks.whatsapp ?? ""}
            onde="Meta for Developers → WhatsApp → Configuração → Callback URL"
          />
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-display text-lg font-semibold">Onde colar as chaves</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          As chaves ficam guardadas no Supabase, fora do site, e nunca passam pelo navegador de
          ninguém. Para cadastrar ou trocar uma delas, abra o painel do Supabase em{" "}
          <span className="font-medium text-foreground">Project Settings → Edge Functions → Secrets</span>.
        </p>
        <Button size="sm" variant="outline" className="mt-4" asChild>
          <a
            href="https://supabase.com/dashboard/project/dwynfydbtkwwppwblkbu/settings/functions"
            target="_blank"
            rel="noreferrer"
          >
            Abrir o Supabase<ExternalLink className="ml-1.5 h-4 w-4" />
          </a>
        </Button>
      </Card>
    </div>
  );
}

function Endereco({ titulo, valor, onde }: { titulo: string; valor: string; onde: string }) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(valor);
      setCopiado(true);
      toast.success("Endereço copiado");
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error("Não consegui copiar. Selecione o texto e copie na mão.");
    }
  };

  return (
    <div className="rounded-xl border border-border/60 bg-secondary/30 p-4">
      <div className="text-sm font-medium">{titulo}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{onde}</div>
      <div className="mt-3 flex items-center gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded bg-background/60 px-2 py-1.5 text-xs">
          {valor}
        </code>
        <Button size="icon" variant="outline" className="h-9 w-9 shrink-0" onClick={copiar} title="Copiar">
          {copiado ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
