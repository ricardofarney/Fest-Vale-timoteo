import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEventoAdmin } from "@/hooks/use-evento-admin";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { brl, fmtDateTime } from "@/lib/format";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Boxes,
  FlaskConical,
  Loader2,
  MessageCircle,
  ScanLine,
  ShoppingCart,
  Ticket,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: VisaoGeral,
});

type Visao = {
  ingresso: { pedidos_pagos: number; aguardando: number; expirados: number; receita_cents: number; pela_portaria: number };
  ingressos: { emitidos: number; usados: number; cancelados: number };
  lotes: Array<{ tipo: string; lote: string; preco_cents: number; total: number; vendidos: number }>;
  bar: { vendas: number; receita_cents: number; cortesias: number; canceladas: number };
  sangria_cents: number;
  estoque_alerta: Array<{ nome: string; restam: number; alerta: number }>;
  equipe: Record<string, number>;
  whatsapp: { contatos: number; mensagens: number; pediram_humano: number; respostas_ativas: number };
  demo: boolean;
};

function VisaoGeral() {
  const { evento, loading: carregandoEvento } = useEventoAdmin();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-visao", evento?.id],
    enabled: !!evento,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_visao_geral", { _event_id: evento!.id });
      if (error) throw error;
      return data as unknown as Visao;
    },
  });

  if (carregandoEvento || isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!evento) {
    return (
      <Card className="p-12 text-center">
        <p className="text-muted-foreground">Nenhum evento encontrado para administrar.</p>
      </Card>
    );
  }

  const v = data;
  const receitaTotal = (v?.ingresso.receita_cents ?? 0) + (v?.bar.receita_cents ?? 0);
  const presenca = v?.ingressos.emitidos
    ? Math.round((v.ingressos.usados / v.ingressos.emitidos) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* ─────────────────────────────────────────────── cabeçalho do evento */}
      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-xl font-bold">{evento.name}</h2>
            <span
              className={`rounded px-2 py-0.5 text-xs font-medium ${
                evento.status === "published"
                  ? "bg-success/20 text-success"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {evento.status === "published" ? "Publicado" : "Rascunho"}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{fmtDateTime(evento.starts_at)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link to="/organizador/eventos/$id/dashboard" params={{ id: evento.id }}>
              <BarChart3 className="mr-1.5 h-4 w-4" />Dashboard de vendas
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/organizador/eventos/$id/editar" params={{ id: evento.id }}>
              Editar evento
            </Link>
          </Button>
        </div>
      </Card>

      {v?.demo && (
        <div className="flex items-start gap-3 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3">
          <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-sm">
            <span className="font-semibold">Dados de demonstração ativos.</span> Os números abaixo
            incluem compradores e vendas fictícias, criados para você mostrar o sistema. Peça a
            remoção quando for para valer.
          </p>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────── números */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Numero titulo="Receita total" valor={brl(receitaTotal)} detalhe="ingresso + bar" destaque />
        <Numero titulo="Ingressos vendidos" valor={String(v?.ingressos.emitidos ?? 0)}
                detalhe={`${v?.ingresso.pedidos_pagos ?? 0} pedidos pagos`} />
        <Numero titulo="Entradas registradas" valor={String(v?.ingressos.usados ?? 0)}
                detalhe={`${presenca}% dos ingressos`} />
        <Numero titulo="Vendas no bar" valor={String(v?.bar.vendas ?? 0)}
                detalhe={brl(v?.bar.receita_cents ?? 0)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Numero titulo="Receita de ingresso" valor={brl(v?.ingresso.receita_cents ?? 0)}
                detalhe={`${v?.ingresso.pela_portaria ?? 0} vendidos na portaria`} />
        <Numero titulo="Aguardando pagamento" valor={String(v?.ingresso.aguardando ?? 0)}
                detalhe={`${v?.ingresso.expirados ?? 0} expiraram`} />
        <Numero titulo="Cortesias" valor={String(v?.bar.cortesias ?? 0)}
                detalhe={`${v?.bar.canceladas ?? 0} vendas canceladas`} />
        <Numero titulo="Sangria de caixa" valor={brl(v?.sangria_cents ?? 0)} detalhe="retirado do caixa" />
      </div>

      {/* ───────────────────────────────────────────────── o que pede atenção */}
      {(v?.estoque_alerta.length ?? 0) > 0 && (
        <Card className="border-destructive/40 p-5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <h3 className="font-display text-lg font-semibold">Estoque acabando</h3>
          </div>
          <ul className="mt-4 space-y-2">
            {v!.estoque_alerta.map((p) => (
              <li key={p.nome} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">{p.nome}</span>
                <span className="shrink-0 font-semibold tabular-nums text-destructive">
                  {p.restam === 0 ? "esgotado" : `${p.restam} restam`}
                </span>
              </li>
            ))}
          </ul>
          <Button size="sm" variant="outline" className="mt-5" asChild>
            <Link to="/pdv/$eventId/estoque" params={{ eventId: evento.id }}>
              <Boxes className="mr-1.5 h-4 w-4" />Repor estoque
            </Link>
          </Button>
        </Card>
      )}

      {/* ────────────────────────────────────────────────────────── lotes */}
      <Card className="p-5">
        <h3 className="font-display text-lg font-semibold">Lotes de ingresso</h3>
        <div className="mt-4 space-y-3">
          {v?.lotes.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum lote cadastrado ainda.</p>
          )}
          {v?.lotes.map((l) => {
            const pct = l.total > 0 ? Math.min(Math.round((l.vendidos / l.total) * 100), 100) : 0;
            return (
              <div key={`${l.tipo}-${l.lote}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium">
                    {l.tipo} · <span className="text-muted-foreground">{l.lote}</span>
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {brl(l.preco_cents)} — {l.vendidos}
                    {l.total > 0 ? ` de ${l.total}` : ""}
                  </span>
                </div>
                {l.total > 0 && (
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* ───────────────────────────────────────────── atalhos e whatsapp */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-primary" />
            <h3 className="font-display text-lg font-semibold">Atendimento por WhatsApp</h3>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <Mini rotulo="Pessoas atendidas" valor={v?.whatsapp.contatos ?? 0} />
            <Mini rotulo="Mensagens trocadas" valor={v?.whatsapp.mensagens ?? 0} />
            <Mini rotulo="Pediram um humano" valor={v?.whatsapp.pediram_humano ?? 0} />
            <Mini rotulo="Respostas cadastradas" valor={v?.whatsapp.respostas_ativas ?? 0} />
          </div>
          <Button size="sm" variant="outline" className="mt-5" asChild>
            <Link to="/admin/whatsapp">
              Ver conversas<ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h3 className="font-display text-lg font-semibold">Equipe do evento</h3>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <Mini rotulo="Organizadores" valor={v?.equipe?.organizador ?? 0} />
            <Mini rotulo="Caixas" valor={v?.equipe?.caixa ?? 0} />
            <Mini rotulo="Portaria" valor={v?.equipe?.portaria ?? 0} />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link to="/organizador/eventos/$id/equipe" params={{ id: evento.id }}>
                Gerenciar equipe
              </Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link to="/admin/usuarios">Usuários do sistema</Link>
            </Button>
          </div>
        </Card>
      </div>

      {/* ────────────────────────────────────────────────────── atalhos */}
      <Card className="p-5">
        <h3 className="font-display text-lg font-semibold">Ir direto para</h3>
        <div className="mt-4 flex flex-wrap gap-2">
          <Atalho to="/pdv" icone={ShoppingCart} label="PDV do evento" />
          <Atalho to="/validacao" icone={ScanLine} label="Validação na entrada" />
          <Atalho to="/admin/integracoes" icone={Ticket} label="Integrações e chaves" />
        </div>
      </Card>
    </div>
  );
}

/* ───────────────────────────────────────────────────────── peças da tela */

function Numero({
  titulo, valor, detalhe, destaque,
}: { titulo: string; valor: string; detalhe?: string; destaque?: boolean }) {
  return (
    <Card className={`p-5 ${destaque ? "border-primary/40 bg-primary/5" : ""}`}>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{titulo}</div>
      <div className="mt-2 font-display text-2xl font-bold tabular-nums">{valor}</div>
      {detalhe && <div className="mt-1 text-xs text-muted-foreground">{detalhe}</div>}
    </Card>
  );
}

function Mini({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <div className="rounded-lg border border-border/60 bg-secondary/30 p-3">
      <div className="font-display text-xl font-bold tabular-nums">{valor}</div>
      <div className="mt-0.5 text-xs leading-tight text-muted-foreground">{rotulo}</div>
    </div>
  );
}

function Atalho({
  to, icone: Icone, label,
}: { to: "/pdv" | "/validacao" | "/admin/integracoes"; icone: typeof Ticket; label: string }) {
  return (
    <Button size="sm" variant="outline" asChild>
      <Link to={to}>
        <Icone className="mr-1.5 h-4 w-4" />
        {label}
      </Link>
    </Button>
  );
}
