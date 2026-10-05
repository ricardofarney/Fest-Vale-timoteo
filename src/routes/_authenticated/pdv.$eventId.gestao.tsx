import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { brl } from "@/lib/format";
import { toast } from "sonner";
import {
  ArrowLeft, RefreshCw, AlertTriangle, Banknote, Boxes, Users, Settings2, Gauge,
  KeyRound, Smartphone, CheckCircle2, Loader2, Plus, Lock, Wallet,
} from "lucide-react";

/**
 * Gestão do dia — o painel do celular de quem comanda o evento
 * (master, organizador e financeiro). Ninguém dos três tem maquininha:
 * tudo que eles precisam ver e decidir durante a festa está aqui.
 *
 * Os números vêm de painel_dia; as ações passam por painel_acao.
 * As duas funções conferem a permissão no banco.
 */
export const Route = createFileRoute("/_authenticated/pdv/$eventId/gestao")({
  head: () => ({ meta: [{ title: "Gestão do dia — Fest Vale Timóteo" }] }),
  component: Gestao,
});

// ---------------------------------------------------------------- tipos

type Resumo = {
  caixa_id: string;
  operador: { id: string; nome: string };
  aberto_em: string;
  fechado_em: string | null;
  fundo: number;
  vendido: number;
  vendas: number;
  itens: number;
  meios: { credito: number; debito: number; pix: number; dinheiro: number };
  cortesias: { quantidade: number; valor: number };
  dinheiro: number;
  sangrado: number;
  sangrias: { em: string; valor: number }[];
  na_gaveta: number;
  esperado: number | null;
  entregue: number | null;
  acima_limite: boolean;
  conferido_em: string | null;
  conferido_cents: number | null;
  conferencia_obs: string | null;
  conferido_por: string | null;
};

type Produto = {
  id: string; nome: string; categoria: string | null; preco: number; estoque: number;
  alerta: number; controla: boolean; vendidos: number; receita: number;
};

type Painel = {
  agora: string;
  evento: { id: string; nome: string; limite_gaveta: number; modo_teste: boolean };
  eu: { gere_caixa: boolean; gerencia_evento: boolean; tem_pin: boolean };
  totais: {
    vendido: number; vendas: number; cortesias: number; credito: number; debito: number;
    pix: number; dinheiro: number; offline: number;
  };
  itens_vendidos: number;
  por_faixa: { inicio: string; valor: number; vendas: number }[];
  caixas: Resumo[];
  produtos: Produto[];
  operadores: { id: string; nome: string; ativo: boolean; caixa_aberto: boolean }[];
  terminais: { id: string; serial: string | null; modelo: string | null; ultimo_contato: string | null; pareado_em: string }[];
  gestores: { nome: string }[];
};

// As funções novas ainda não estão nos tipos gerados do Supabase.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = supabase.rpc.bind(supabase) as unknown as (fn: string, args: Record<string, unknown>) => Promise<{ data: any; error: { message: string } | null }>;

async function acao<T = Record<string, unknown>>(eventId: string, nome: string, dados: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await rpc("painel_acao", { _event_id: eventId, _acao: nome, _dados: dados });
  if (error) throw new Error(error.message);
  return data as T;
}

// ------------------------------------------------------- formatos e hora

const FUSO = "America/Sao_Paulo";

/** Sempre hora de Brasília — nunca UTC. */
const hora = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: FUSO }) : "—";

const haQuanto = (iso: string | null | undefined, agora: string) => {
  if (!iso) return "nunca";
  const min = Math.round((new Date(agora).getTime() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  return h < 24 ? `há ${h} h ${min % 60} min` : `em ${new Date(iso).toLocaleDateString("pt-BR", { timeZone: FUSO })}`;
};

/** "125", "125,50", "1.250,00" → centavos */
const lerReais = (t: string): number | null => {
  const s = t.trim().replace(/\./g, "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
};

const pinValido = (p: string) => /^[0-9]{4}$/.test(p);

// ------------------------------------------------------------- página

type Aba = "agora" | "caixas" | "estoque" | "equipe" | "ajustes";

const ABAS: { id: Aba; nome: string; icone: typeof Gauge }[] = [
  { id: "agora", nome: "Agora", icone: Gauge },
  { id: "caixas", nome: "Caixas", icone: Wallet },
  { id: "estoque", nome: "Estoque", icone: Boxes },
  { id: "equipe", nome: "Equipe", icone: Users },
  { id: "ajustes", nome: "Ajustes", icone: Settings2 },
];

function Gestao() {
  const { eventId } = Route.useParams();
  const [aba, setAba] = useState<Aba>("agora");

  const { data, error, isFetching, refetch } = useQuery({
    queryKey: ["painel-dia", eventId],
    queryFn: async () => {
      const { data, error } = await rpc("painel_dia", { _event_id: eventId });
      if (error) throw new Error(error.message);
      return data as Painel;
    },
    refetchInterval: 15_000,
    retry: 1,
  });

  if (error) {
    return (
      <div className="container mx-auto max-w-lg px-4 py-10">
        <Voltar />
        <Card className="p-6 text-center">
          <Lock className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium">Sem acesso à gestão deste evento</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Esta tela é do master, do organizador e do financeiro. ({(error as Error).message})
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-28 pt-5">
      <Voltar />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold leading-tight">Gestão do dia</h1>
          <p className="truncate text-sm text-muted-foreground">{data?.evento.nome ?? "Carregando…"}</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching} aria-label="Atualizar">
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>
      {data && (
        <p className="mt-1 text-xs text-muted-foreground">
          Atualizado às {hora(data.agora)} · atualiza sozinho a cada 15 s
        </p>
      )}

      {data?.evento.modo_teste && (
        <div className="mt-3 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs">
          <span className="font-semibold">Modo de teste.</span> As maquininhas cobram no ambiente de testes do PagBank.
        </div>
      )}

      {data && !data.eu.tem_pin && (
        <button
          onClick={() => setAba("ajustes")}
          className="mt-3 flex w-full items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-left text-sm"
        >
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <span>
            <span className="font-semibold">Crie seu PIN de gestor.</span> Sem ele você não autoriza
            abertura de caixa, entrega de dinheiro nem cortesia na maquininha. Toque aqui.
          </span>
        </button>
      )}

      {!data ? (
        <div className="py-20 text-center text-muted-foreground"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>
      ) : (
        <div className="mt-5">
          {aba === "agora" && <AbaAgora p={data} irPara={setAba} />}
          {aba === "caixas" && <AbaCaixas p={data} eventId={eventId} />}
          {aba === "estoque" && <AbaEstoque p={data} eventId={eventId} />}
          {aba === "equipe" && <AbaEquipe p={data} eventId={eventId} />}
          {aba === "ajustes" && <AbaAjustes p={data} eventId={eventId} />}
        </div>
      )}

      {/* navegação de baixo, no alcance do polegar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[padding:max(0px)]:pb-[max(0px,env(safe-area-inset-bottom))]">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {ABAS.map((a) => {
            const Icone = a.icone;
            const ativa = aba === a.id;
            const alerta =
              (a.id === "caixas" && (data?.caixas ?? []).some((c) => c.acima_limite && !c.fechado_em)) ||
              (a.id === "estoque" && (data?.produtos ?? []).some((p) => p.controla && p.estoque <= p.alerta));
            return (
              <button
                key={a.id}
                onClick={() => { setAba(a.id); window.scrollTo({ top: 0 }); }}
                className={`relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${ativa ? "text-primary" : "text-muted-foreground"}`}
              >
                <Icone className="h-5 w-5" />
                {a.nome}
                {alerta && <span className="absolute right-[calc(50%-16px)] top-1.5 h-2 w-2 rounded-full bg-destructive" />}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function Voltar() {
  return (
    <Link to="/pdv" className="mb-3 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="mr-1 h-4 w-4" />PDV
    </Link>
  );
}

function Titulo({ children, extra }: { children: ReactNode; extra?: ReactNode }) {
  return (
    <div className="mb-2 mt-7 flex items-baseline justify-between gap-2 first:mt-0">
      <h2 className="font-display text-base font-semibold">{children}</h2>
      {extra && <span className="text-xs text-muted-foreground">{extra}</span>}
    </div>
  );
}

function Linha({ rotulo, valor, forte, cor }: { rotulo: ReactNode; valor: ReactNode; forte?: boolean; cor?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className={forte ? "font-medium" : "text-sm text-muted-foreground"}>{rotulo}</span>
      <span className={`tabular-nums ${forte ? "font-display text-lg font-bold" : "font-medium"} ${cor ?? ""}`}>{valor}</span>
    </div>
  );
}

// =============================================================== AGORA

function AbaAgora({ p, irPara }: { p: Painel; irPara: (a: Aba) => void }) {
  const abertos = p.caixas.filter((c) => !c.fechado_em);
  const emCampo = abertos.reduce((s, c) => s + c.na_gaveta, 0);
  const acima = abertos.filter((c) => c.acima_limite);
  const baixos = p.produtos.filter((x) => x.controla && x.estoque <= x.alerta);
  const fechadosSemConferir = p.caixas.filter((c) => c.fechado_em && !c.conferido_em).length;

  return (
    <>
      {/* dinheiro em campo: o número que mais importa para o financeiro */}
      <Card className={`p-4 ${acima.length ? "border-destructive/60 bg-destructive/5" : ""}`}>
        <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
          <Banknote className="h-3.5 w-3.5" />Dinheiro nas mãos dos operadores
        </div>
        <div className="mt-1 font-display text-4xl font-bold tabular-nums">{brl(emCampo)}</div>
        <div className="text-xs text-muted-foreground">
          {abertos.length} {abertos.length === 1 ? "caixa aberto" : "caixas abertos"} · alerta acima de {brl(p.evento.limite_gaveta)} por pessoa
        </div>
        {acima.length > 0 && (
          <button onClick={() => irPara("caixas")} className="mt-3 flex w-full items-start gap-2 rounded-lg bg-destructive/15 px-3 py-2 text-left text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <span>
              <span className="font-semibold">Recolher dinheiro:</span>{" "}
              {acima.map((c) => `${c.operador.nome.split(" ")[0]} (${brl(c.na_gaveta)})`).join(" · ")}
            </span>
          </button>
        )}
      </Card>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Vendido</div>
          <div className="mt-1 font-display text-2xl font-bold tabular-nums">{brl(p.totais.vendido)}</div>
          <div className="text-xs text-muted-foreground">{p.totais.vendas} vendas · {p.itens_vendidos} itens</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Ticket médio</div>
          <div className="mt-1 font-display text-2xl font-bold tabular-nums">
            {brl(p.totais.vendas ? Math.round(p.totais.vendido / p.totais.vendas) : 0)}
          </div>
          <div className="text-xs text-muted-foreground">{p.totais.cortesias} cortesias</div>
        </Card>
      </div>

      {(baixos.length > 0 || fechadosSemConferir > 0 || p.totais.offline > 0) && (
        <div className="mt-3 space-y-2">
          {baixos.length > 0 && (
            <button onClick={() => irPara("estoque")} className="flex w-full items-start gap-2 rounded-lg border border-primary/50 bg-primary/10 px-3 py-2 text-left text-sm">
              <Boxes className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span><span className="font-semibold">Estoque baixo:</span> {baixos.map((x) => `${x.nome} (${x.estoque})`).join(" · ")}</span>
            </button>
          )}
          {fechadosSemConferir > 0 && (
            <button onClick={() => irPara("caixas")} className="flex w-full items-start gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-left text-sm">
              <Wallet className="mt-0.5 h-4 w-4 shrink-0" />
              <span><span className="font-semibold">{fechadosSemConferir} {fechadosSemConferir === 1 ? "envelope" : "envelopes"}</span> para conferir.</span>
            </button>
          )}
          {p.totais.offline > 0 && (
            <div className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">
              {p.totais.offline} {p.totais.offline === 1 ? "venda foi feita" : "vendas foram feitas"} sem internet e já subiram.
            </div>
          )}
        </div>
      )}

      <Titulo>Por forma de pagamento</Titulo>
      <Meios t={p.totais} />

      <Titulo extra="a cada 15 minutos">Ritmo de vendas</Titulo>
      <Grafico faixas={p.por_faixa} />

      <Titulo>Mais vendidos</Titulo>
      <Card className="p-4">
        {[...p.produtos].filter((x) => x.vendidos > 0).sort((a, b) => b.receita - a.receita).slice(0, 8).map((x) => (
          <Linha key={x.id} rotulo={`${x.vendidos}× ${x.nome}`} valor={brl(x.receita)} />
        ))}
        {p.produtos.every((x) => x.vendidos === 0) && <p className="text-center text-sm text-muted-foreground">Nenhuma venda ainda.</p>}
      </Card>
    </>
  );
}

function Meios({ t }: { t: Painel["totais"] }) {
  const linhas = [
    { nome: "Crédito", v: t.credito, cor: "bg-chart-1" },
    { nome: "Débito", v: t.debito, cor: "bg-chart-2" },
    { nome: "Pix", v: t.pix, cor: "bg-chart-3" },
    { nome: "Dinheiro", v: t.dinheiro, cor: "bg-chart-4" },
  ];
  const total = Math.max(1, linhas.reduce((s, l) => s + l.v, 0));
  return (
    <Card className="p-4">
      <div className="flex h-3 overflow-hidden rounded-full bg-secondary">
        {linhas.filter((l) => l.v > 0).map((l) => (
          <div key={l.nome} className={l.cor} style={{ width: `${(l.v / total) * 100}%` }} />
        ))}
      </div>
      <div className="mt-3 space-y-0.5">
        {linhas.map((l) => (
          <Linha
            key={l.nome}
            rotulo={<span className="inline-flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-sm ${l.cor}`} />{l.nome}</span>}
            valor={<>{brl(l.v)} <span className="ml-1 text-xs text-muted-foreground">{Math.round((l.v / total) * 100)}%</span></>}
          />
        ))}
      </div>
    </Card>
  );
}

/** Barras de 15 minutos. O pico fica marcado. */
function Grafico({ faixas }: { faixas: Painel["por_faixa"] }) {
  // Se houver vendas de mais de um dia (testes antigos), mostra só a noite mais recente.
  const visiveis = useMemo(() => {
    if (faixas.length === 0) return [];
    const ult = faixas[faixas.length - 1].inicio;
    const limite = new Date(new Date(ult + ":00Z").getTime() - 14 * 3600_000).toISOString().slice(0, 16);
    return faixas.filter((f) => f.inicio >= limite);
  }, [faixas]);
  const [sel, setSel] = useState<number | null>(null);

  if (visiveis.length === 0) {
    return <Card className="p-6 text-center text-sm text-muted-foreground">O gráfico aparece com a primeira venda.</Card>;
  }
  const max = Math.max(...visiveis.map((f) => f.valor), 1);
  const pico = visiveis.reduce((a, b) => (b.valor > a.valor ? b : a));
  const atual = sel !== null ? visiveis[sel] : pico;
  const rotulo = (inicio: string) => inicio.slice(11, 16);

  return (
    <Card className="p-4">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <div className="text-xs text-muted-foreground">{sel !== null ? "Faixa escolhida" : "Pico"}</div>
          <div className="font-display text-lg font-bold">
            {rotulo(atual.inicio)} · {brl(atual.valor)}
          </div>
        </div>
        <div className="text-right text-xs text-muted-foreground">{atual.vendas} vendas em 15 min</div>
      </div>
      <div className="mt-3 flex h-36 items-end gap-[2px]" onMouseLeave={() => setSel(null)}>
        {visiveis.map((f, i) => {
          const ePico = f === pico;
          const escolhida = sel === i;
          return (
            <button
              key={f.inicio}
              aria-label={`${rotulo(f.inicio)}: ${brl(f.valor)}`}
              onClick={() => setSel(escolhida ? null : i)}
              onMouseEnter={() => setSel(i)}
              className="flex h-full flex-1 items-end"
            >
              <div
                className={`w-full rounded-t-sm transition-colors ${escolhida ? "bg-foreground" : ePico ? "bg-primary" : "bg-primary/35"}`}
                style={{ height: `${Math.max(2, (f.valor / max) * 100)}%` }}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] tabular-nums text-muted-foreground">
        <span>{rotulo(visiveis[0].inicio)}</span>
        {visiveis.length > 4 && <span>{rotulo(visiveis[Math.floor(visiveis.length / 2)].inicio)}</span>}
        <span>{rotulo(visiveis[visiveis.length - 1].inicio)}</span>
      </div>
    </Card>
  );
}

// ============================================================== CAIXAS

function AbaCaixas({ p, eventId }: { p: Painel; eventId: string }) {
  const abertos = p.caixas.filter((c) => !c.fechado_em).sort((a, b) => b.na_gaveta - a.na_gaveta);
  const paraConferir = p.caixas.filter((c) => c.fechado_em && !c.conferido_em);
  const conferidos = p.caixas.filter((c) => c.conferido_em);

  return (
    <>
      <Titulo extra={`${abertos.length} agora`}>Caixas abertos</Titulo>
      {abertos.length === 0 && <Card className="p-6 text-center text-sm text-muted-foreground">Nenhum caixa aberto.</Card>}
      <div className="space-y-2">
        {abertos.map((c) => <CartaoCaixa key={c.caixa_id} c={c} />)}
      </div>

      <Titulo extra={paraConferir.length ? `${paraConferir.length} pendentes` : undefined}>Envelopes para conferir</Titulo>
      <p className="-mt-1 mb-2 text-xs text-muted-foreground">
        Caixa fechado na maquininha. Abra o envelope, conte e registre o que encontrou.
      </p>
      {paraConferir.length === 0 && <Card className="p-6 text-center text-sm text-muted-foreground">Nada para conferir.</Card>}
      <div className="space-y-2">
        {paraConferir.map((c) => <Conferir key={c.caixa_id} c={c} eventId={eventId} />)}
      </div>

      {conferidos.length > 0 && (
        <>
          <Titulo>Já conferidos</Titulo>
          <Card className="divide-y divide-border/60">
            {conferidos.map((c) => {
              const dif = (c.conferido_cents ?? 0) - (c.esperado ?? 0);
              return (
                <div key={c.caixa_id} className="p-3 text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{c.operador.nome}</span>
                    <span className={`tabular-nums font-semibold ${dif < 0 ? "text-destructive" : dif > 0 ? "text-chart-2" : "text-success"}`}>
                      {dif === 0 ? "bateu" : dif > 0 ? `sobra ${brl(dif)}` : `falta ${brl(-dif)}`}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    contado {brl(c.conferido_cents ?? 0)} de {brl(c.esperado ?? 0)} · {c.conferido_por ?? "—"} às {hora(c.conferido_em)}
                    {c.conferencia_obs ? ` · “${c.conferencia_obs}”` : ""}
                  </div>
                </div>
              );
            })}
          </Card>
        </>
      )}
    </>
  );
}

function CartaoCaixa({ c }: { c: Resumo }) {
  const [aberto, setAberto] = useState(false);
  return (
    <Card className={`p-4 ${c.acima_limite ? "border-destructive/60" : ""}`}>
      <button className="w-full text-left" onClick={() => setAberto(!aberto)}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate font-medium">{c.operador.nome}</div>
            <div className="text-xs text-muted-foreground">
              desde {hora(c.aberto_em)} · {c.vendas} vendas · {brl(c.vendido)}
            </div>
          </div>
          <div className="text-right">
            <div className={`font-display text-xl font-bold tabular-nums ${c.acima_limite ? "text-destructive" : ""}`}>{brl(c.na_gaveta)}</div>
            <div className="text-[11px] text-muted-foreground">na gaveta</div>
          </div>
        </div>
        {c.acima_limite && (
          <div className="mt-2 rounded-md bg-destructive/15 px-2 py-1 text-xs font-medium text-destructive">
            Acima do limite — recolha dinheiro (a sangria é feita na maquininha dele, com seu PIN)
          </div>
        )}
      </button>
      {aberto && (
        <div className="mt-3 border-t border-border/60 pt-2">
          <Linha rotulo="Crédito" valor={brl(c.meios.credito)} />
          <Linha rotulo="Débito" valor={brl(c.meios.debito)} />
          <Linha rotulo="Pix" valor={brl(c.meios.pix)} />
          <Linha rotulo="Dinheiro" valor={brl(c.meios.dinheiro)} />
          {c.cortesias.quantidade > 0 && <Linha rotulo={`Cortesias (${c.cortesias.quantidade})`} valor={brl(c.cortesias.valor)} />}
          <div className="my-1 border-t border-dashed border-border/60" />
          <Linha rotulo="Fundo de troco" valor={brl(c.fundo)} />
          {c.sangrias.map((s, i) => <Linha key={i} rotulo={`Recolhido às ${hora(s.em)}`} valor={`− ${brl(s.valor)}`} />)}
          <Linha rotulo="Na gaveta agora" valor={brl(c.na_gaveta)} forte />
        </div>
      )}
    </Card>
  );
}

function Conferir({ c, eventId }: { c: Resumo; eventId: string }) {
  const qc = useQueryClient();
  const [valor, setValor] = useState("");
  const [obs, setObs] = useState("");
  const [enviando, setEnviando] = useState(false);
  const contado = lerReais(valor);
  const esperado = c.esperado ?? 0;
  const difOperador = (c.entregue ?? 0) - esperado;
  const dif = contado === null ? null : contado - esperado;

  const salvar = async () => {
    if (contado === null) return toast.error("Digite quanto encontrou no envelope");
    setEnviando(true);
    try {
      await acao(eventId, "conferir_caixa", { caixa_id: c.caixa_id, conferido_cents: contado, obs: obs.trim() || null });
      toast.success(`Caixa de ${c.operador.nome} conferido`);
      qc.invalidateQueries({ queryKey: ["painel-dia", eventId] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium">{c.operador.nome}</span>
        <span className="text-xs text-muted-foreground">fechou às {hora(c.fechado_em)}</span>
      </div>
      <div className="mt-2">
        <Linha rotulo="Deveria ter no envelope" valor={brl(esperado)} />
        <Linha
          rotulo="O operador disse que entregou"
          valor={brl(c.entregue ?? 0)}
          cor={difOperador < 0 ? "text-destructive" : undefined}
        />
      </div>
      <div className="mt-3 flex gap-2">
        <Input inputMode="decimal" placeholder="Quanto você contou (R$)" value={valor} onChange={(e) => setValor(e.target.value)} />
        <Button onClick={salvar} disabled={enviando || contado === null}>
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Conferir"}
        </Button>
      </div>
      {dif !== null && (
        <p className={`mt-2 text-sm font-medium ${dif < 0 ? "text-destructive" : dif > 0 ? "text-chart-2" : "text-success"}`}>
          {dif === 0 ? "Bateu certinho." : dif > 0 ? `Sobra de ${brl(dif)}.` : `Falta de ${brl(-dif)}.`}
        </p>
      )}
      <Input className="mt-2" placeholder="Observação (opcional)" value={obs} onChange={(e) => setObs(e.target.value)} />
    </Card>
  );
}

// ============================================================= ESTOQUE

function AbaEstoque({ p, eventId }: { p: Painel; eventId: string }) {
  const grupos = useMemo(() => {
    const m = new Map<string, Produto[]>();
    for (const x of p.produtos) {
      const k = x.categoria ?? "Outros";
      m.set(k, [...(m.get(k) ?? []), x]);
    }
    return [...m.entries()];
  }, [p.produtos]);

  return (
    <>
      {!p.eu.gerencia_evento && (
        <div className="mb-3 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
          Você acompanha o estoque. Repor é com o organizador.
        </div>
      )}
      {grupos.map(([cat, itens]) => (
        <div key={cat}>
          <Titulo>{cat}</Titulo>
          <Card className="divide-y divide-border/60">
            {itens.map((x) => <LinhaEstoque key={x.id} x={x} eventId={eventId} podeRepor={p.eu.gerencia_evento} />)}
          </Card>
        </div>
      ))}
    </>
  );
}

function LinhaEstoque({ x, eventId, podeRepor }: { x: Produto; eventId: string; podeRepor: boolean }) {
  const qc = useQueryClient();
  const [qtd, setQtd] = useState("");
  const [enviando, setEnviando] = useState(false);
  const negativo = x.controla && x.estoque < 0;
  const baixo = x.controla && x.estoque <= x.alerta;

  const repor = async () => {
    const n = parseInt(qtd, 10);
    if (!Number.isFinite(n) || n === 0) return toast.error("Digite a quantidade");
    setEnviando(true);
    try {
      const r = await acao<{ estoque: number }>(eventId, "repor", { product_id: x.id, qtd: n });
      toast.success(`${x.nome}: agora ${r.estoque}`);
      setQtd("");
      qc.invalidateQueries({ queryKey: ["painel-dia", eventId] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="p-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 text-sm font-medium">{x.nome}</span>
        <span className={`shrink-0 font-display text-lg font-bold tabular-nums ${negativo ? "text-destructive" : baixo ? "text-primary" : ""}`}>
          {x.estoque}
        </span>
      </div>
      <div className="text-xs text-muted-foreground">
        {x.vendidos} vendidos · {brl(x.receita)} · alerta em {x.alerta}
        {negativo && <span className="font-medium text-destructive"> · vendeu além do estoque</span>}
      </div>
      {podeRepor && (
        <div className="mt-2 flex gap-2">
          <Input inputMode="numeric" placeholder="Quantidade que chegou" value={qtd} onChange={(e) => setQtd(e.target.value.replace(/[^0-9-]/g, ""))} className="h-9" />
          <Button size="sm" variant="outline" onClick={repor} disabled={enviando || !qtd}>
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="mr-1 h-4 w-4" />Repor</>}
          </Button>
        </div>
      )}
    </div>
  );
}

// ============================================================== EQUIPE

function AbaEquipe({ p, eventId }: { p: Painel; eventId: string }) {
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [pin, setPin] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [codigo, setCodigo] = useState<{ codigo: string; expira_em: string } | null>(null);

  const recarregar = () => qc.invalidateQueries({ queryKey: ["painel-dia", eventId] });

  const cadastrar = async () => {
    if (nome.trim().length < 2) return toast.error("Digite o nome");
    if (!pinValido(pin)) return toast.error("O PIN precisa ter 4 números");
    setEnviando(true);
    try {
      await acao(eventId, "cadastrar_operador", { nome: nome.trim(), pin });
      toast.success(`${nome.trim()} cadastrado. Já aparece nas maquininhas.`);
      setNome(""); setPin("");
      recarregar();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  const gerarCodigo = async () => {
    try {
      setCodigo(await acao(eventId, "gerar_codigo"));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <>
      <Titulo>Cadastrar operador</Titulo>
      <Card className="p-4">
        <p className="mb-3 text-xs text-muted-foreground">
          Quem vai usar a maquininha. A pessoa escolhe o próprio PIN de 4 números — ele identifica as vendas dela.
        </p>
        <Input placeholder="Nome completo" value={nome} onChange={(e) => setNome(e.target.value)} />
        <div className="mt-2 flex gap-2">
          <Input inputMode="numeric" maxLength={4} placeholder="PIN (4 números)" value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} />
          <Button onClick={cadastrar} disabled={enviando}>
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cadastrar"}
          </Button>
        </div>
      </Card>

      <Titulo extra={`${p.operadores.filter((o) => o.ativo).length} ativos`}>Operadores</Titulo>
      <Card className="divide-y divide-border/60">
        {p.operadores.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Ninguém cadastrado ainda.</div>}
        {p.operadores.map((o) => <LinhaOperador key={o.id} o={o} eventId={eventId} aoMudar={recarregar} />)}
      </Card>

      <Titulo>Maquininhas</Titulo>
      <Card className="p-4">
        {codigo ? (
          <div className="text-center">
            <div className="text-xs text-muted-foreground">Digite este código na maquininha</div>
            <div className="my-2 select-all font-mono text-4xl font-bold tracking-[0.2em]">{codigo.codigo}</div>
            <div className="text-xs text-muted-foreground">Vale até {hora(codigo.expira_em)} · serve para uma maquininha</div>
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => { setCodigo(null); recarregar(); }}>Pronto</Button>
          </div>
        ) : (
          <Button className="w-full" variant="outline" onClick={gerarCodigo}>
            <Smartphone className="mr-2 h-4 w-4" />Parear uma maquininha
          </Button>
        )}
      </Card>
      {p.terminais.length > 0 && (
        <Card className="mt-2 divide-y divide-border/60">
          {p.terminais.map((t) => <LinhaTerminal key={t.id} t={t} agora={p.agora} eventId={eventId} aoMudar={recarregar} />)}
        </Card>
      )}

      <Titulo>Gestores com PIN</Titulo>
      <Card className="p-4 text-sm">
        {p.gestores.length === 0
          ? <span className="text-muted-foreground">Nenhum gestor criou PIN ainda. Cada um cria o seu em Ajustes.</span>
          : p.gestores.map((g) => g.nome).join(" · ")}
      </Card>
    </>
  );
}

function LinhaOperador({ o, eventId, aoMudar }: {
  o: Painel["operadores"][number]; eventId: string; aoMudar: () => void;
}) {
  const [trocando, setTrocando] = useState(false);
  const [pin, setPin] = useState("");

  const novoPin = async () => {
    if (!pinValido(pin)) return toast.error("O PIN precisa ter 4 números");
    try {
      await acao(eventId, "novo_pin_operador", { operador_id: o.id, pin });
      toast.success(`PIN de ${o.nome} trocado`);
      setTrocando(false); setPin("");
    } catch (e) { toast.error((e as Error).message); }
  };

  const alternar = async () => {
    try {
      await acao(eventId, "ativar_operador", { operador_id: o.id, ativo: !o.ativo });
      toast.success(o.ativo ? `${o.nome} desativado` : `${o.nome} reativado`);
      aoMudar();
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className={`truncate font-medium ${o.ativo ? "" : "text-muted-foreground line-through"}`}>{o.nome}</div>
          <div className="text-xs text-muted-foreground">{o.caixa_aberto ? "com caixa aberto" : o.ativo ? "sem caixa aberto" : "desativado"}</div>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button size="sm" variant="ghost" onClick={() => setTrocando(!trocando)}>PIN</Button>
          <Button size="sm" variant="ghost" onClick={alternar} disabled={o.caixa_aberto && o.ativo}>
            {o.ativo ? "Desativar" : "Reativar"}
          </Button>
        </div>
      </div>
      {trocando && (
        <div className="mt-2 flex gap-2">
          <Input inputMode="numeric" maxLength={4} placeholder="Novo PIN" value={pin} className="h-9"
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} />
          <Button size="sm" onClick={novoPin}>Salvar</Button>
        </div>
      )}
    </div>
  );
}

function LinhaTerminal({ t, agora, eventId, aoMudar }: {
  t: Painel["terminais"][number]; agora: string; eventId: string; aoMudar: () => void;
}) {
  const [confirmar, setConfirmar] = useState(false);
  const desparear = async () => {
    if (!confirmar) return setConfirmar(true);
    try {
      await acao(eventId, "desparear", { terminal_id: t.id });
      toast.success("Maquininha despareada");
      aoMudar();
    } catch (e) { toast.error((e as Error).message); }
  };
  const recente = t.ultimo_contato && new Date(agora).getTime() - new Date(t.ultimo_contato).getTime() < 3 * 60_000;
  return (
    <div className="flex items-center justify-between gap-2 p-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className={`h-2 w-2 rounded-full ${recente ? "bg-success" : "bg-muted-foreground/40"}`} />
          {t.modelo || "Maquininha"} <span className="font-mono text-xs text-muted-foreground">{t.serial ?? ""}</span>
        </div>
        <div className="text-xs text-muted-foreground">último contato {haQuanto(t.ultimo_contato, agora)}</div>
      </div>
      <Button size="sm" variant={confirmar ? "destructive" : "ghost"} onClick={desparear} onBlur={() => setConfirmar(false)}>
        {confirmar ? "Confirmar" : "Desparear"}
      </Button>
    </div>
  );
}

// ============================================================= AJUSTES

function AbaAjustes({ p, eventId }: { p: Painel; eventId: string }) {
  const qc = useQueryClient();
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [limite, setLimite] = useState((p.evento.limite_gaveta / 100).toString());
  const [salvando, setSalvando] = useState<"" | "pin" | "limite">("");

  const salvarPin = async () => {
    if (!pinValido(pin)) return toast.error("O PIN precisa ter 4 números");
    if (pin !== pin2) return toast.error("Os dois PINs não são iguais");
    setSalvando("pin");
    try {
      await acao(eventId, "definir_meu_pin", { pin });
      toast.success("PIN salvo. Use-o na maquininha para autorizar.");
      setPin(""); setPin2("");
      qc.invalidateQueries({ queryKey: ["painel-dia", eventId] });
    } catch (e) { toast.error((e as Error).message); }
    finally { setSalvando(""); }
  };

  const salvarLimite = async () => {
    const v = lerReais(limite);
    if (v === null || v <= 0) return toast.error("Digite um valor");
    setSalvando("limite");
    try {
      await acao(eventId, "definir_limite", { valor_cents: v });
      toast.success(`Alerta a partir de ${brl(v)} por operador`);
      qc.invalidateQueries({ queryKey: ["painel-dia", eventId] });
    } catch (e) { toast.error((e as Error).message); }
    finally { setSalvando(""); }
  };

  return (
    <>
      <Titulo extra={p.eu.tem_pin ? "já criado" : "ainda não criado"}>Meu PIN de gestor</Titulo>
      <Card className="p-4">
        <p className="mb-3 text-xs text-muted-foreground">
          Na maquininha, este PIN autoriza abertura de caixa, recolhimento de dinheiro e cortesia —
          e fica registrado em seu nome. Não conte para ninguém.
        </p>
        <div className="flex gap-2">
          <Input type="password" inputMode="numeric" maxLength={4} placeholder="Novo PIN" value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} />
          <Input type="password" inputMode="numeric" maxLength={4} placeholder="Repita" value={pin2}
            onChange={(e) => setPin2(e.target.value.replace(/\D/g, "").slice(0, 4))} />
        </div>
        <Button className="mt-2 w-full" onClick={salvarPin} disabled={salvando === "pin"}>
          {salvando === "pin" ? <Loader2 className="h-4 w-4 animate-spin" /> : p.eu.tem_pin ? "Trocar meu PIN" : "Criar meu PIN"}
        </Button>
      </Card>

      <Titulo>Alerta de dinheiro na gaveta</Titulo>
      <Card className="p-4">
        <p className="mb-3 text-xs text-muted-foreground">
          Quando um operador passar deste valor em dinheiro, o caixa dele fica vermelho aqui para alguém ir recolher.
        </p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
            <Input inputMode="decimal" className="pl-9" value={limite} onChange={(e) => setLimite(e.target.value)} />
          </div>
          <Button onClick={salvarLimite} disabled={salvando === "limite"}>
            {salvando === "limite" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
          </Button>
        </div>
      </Card>

      <Card className="mt-6 flex items-start gap-2 bg-secondary/30 p-4 text-xs text-muted-foreground">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          O relatório final para a diretoria é uma tela à parte. Esta aqui é para comandar a festa enquanto ela acontece.
        </span>
      </Card>
    </>
  );
}
