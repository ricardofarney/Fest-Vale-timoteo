import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { brl } from "@/lib/format";
import { toast } from "sonner";
import {
  ArrowLeft,
  Ban,
  BotOff,
  Loader2,
  MessageCircle,
  Search,
  Send,
  Link2,
  Ticket,
  UserRound,
  X,
  Zap,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════ tipos */

export type Contato = {
  id: string;
  wa_id: string;
  nome: string | null;
  humano_assumiu: boolean;
  humano_ate: string | null;
  bloqueado: boolean;
  ultima_em: string;
  ultima_mensagem: string | null;
  ultima_direcao: "recebida" | "enviada" | null;
  nao_lidas: number;
  precisa_humano: boolean;
  email_comprador: string | null;
};

type Mensagem = {
  id: string;
  direcao: "recebida" | "enviada";
  texto: string;
  por_ia: boolean;
  precisou_humano: boolean;
  erro: string | null;
  created_at: string;
};

/* ══════════════════════════════════════════════════════════ utilitários */

/** A prévia da lista mostra "📷 Foto" em vez de "[image]". */
const PREVIA: Record<string, string> = {
  image: "📷 Foto",
  audio: "🎤 Áudio",
  video: "🎬 Vídeo",
  document: "📄 Documento",
  sticker: "💬 Figurinha",
  location: "📍 Localização",
  contacts: "👤 Contato",
};

function previa(texto: string | null): string {
  if (!texto) return "—";
  const m = texto.match(/^\[(\w+)\]$/);
  if (m) return PREVIA[m[1]] ?? "Anexo";
  return texto;
}

/** "há 5 min", "há 2 h", "ontem", "12 de mai." */
function quando(iso: string): string {
  const d = new Date(iso);
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const dias = Math.floor(h / 24);
  if (dias === 1) return "ontem";
  if (dias < 7) return `há ${dias} dias`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

/** Cabeçalho de dia entre os balões: "Hoje", "Ontem" ou a data. */
function rotuloDia(iso: string): string {
  const d = new Date(iso);
  const hoje = new Date();
  const mesmoDia = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (mesmoDia(d, hoje)) return "Hoje";
  const ontem = new Date(hoje);
  ontem.setDate(hoje.getDate() - 1);
  if (mesmoDia(d, ontem)) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

const estaCalada = (c: Contato) =>
  c.humano_assumiu && !!c.humano_ate && new Date(c.humano_ate) > new Date();

/* ═══════════════════════════════════════════════════════════ principal */

export function WaConversas({ eventId }: { eventId: string }) {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todas" | "esperando">("todas");
  const [abertaId, setAbertaId] = useState<string | null>(null);

  const { data: contatos, isLoading } = useQuery({
    queryKey: ["wa-contatos", eventId],
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wa_contatos")
        .select(
          "id, wa_id, nome, humano_assumiu, humano_ate, bloqueado, ultima_em, ultima_mensagem, ultima_direcao, nao_lidas, precisa_humano, email_comprador",
        )
        .eq("event_id", eventId)
        .order("ultima_em", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data as Contato[];
    },
  });

  /* Busca de verdade: procura nome, telefone E dentro das mensagens. */
  const { data: idsPorTexto } = useQuery({
    queryKey: ["wa-busca", eventId, busca],
    enabled: busca.trim().length >= 3,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wa_mensagens")
        .select("contato_id, wa_contatos!inner(event_id)")
        .eq("wa_contatos.event_id", eventId)
        .ilike("texto", `%${busca.trim()}%`)
        .limit(500);
      if (error) throw error;
      return new Set((data ?? []).map((m) => (m as { contato_id: string }).contato_id));
    },
  });

  const lista = useMemo(() => {
    let l = contatos ?? [];
    const t = busca.trim().toLowerCase();
    if (t) {
      l = l.filter(
        (c) =>
          (c.nome ?? "").toLowerCase().includes(t) ||
          c.wa_id.includes(t) ||
          (t.length >= 3 && idsPorTexto?.has(c.id)),
      );
    }
    if (filtro === "esperando") l = l.filter((c) => c.nao_lidas > 0 || c.precisa_humano);
    return l;
  }, [contatos, busca, filtro, idsPorTexto]);

  const esperando = (contatos ?? []).filter((c) => c.nao_lidas > 0 || c.precisa_humano).length;
  const aberta = (contatos ?? []).find((c) => c.id === abertaId) ?? null;

  const recarregar = () => qc.invalidateQueries({ queryKey: ["wa-contatos", eventId] });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!contatos?.length) {
    return (
      <Card className="p-12 text-center">
        <MessageCircle className="mx-auto h-8 w-8 text-muted-foreground/50" />
        <p className="mt-3 text-sm text-muted-foreground">
          Nenhuma conversa ainda. Assim que o número da Meta estiver ligado, tudo que chegar
          aparece aqui.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
      {/* ───────────────────────────────────────── lista de conversas */}
      <div className={`space-y-3 ${aberta ? "hidden lg:block" : ""}`}>
        <div className="space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar nome, telefone ou texto"
              className="pl-9"
            />
          </div>
          <div className="flex gap-2 text-sm">
            <Aba ativa={filtro === "todas"} onClick={() => setFiltro("todas")}>
              Todas ({contatos.length})
            </Aba>
            <Aba ativa={filtro === "esperando"} onClick={() => setFiltro("esperando")} alerta={esperando > 0}>
              Esperando ({esperando})
            </Aba>
          </div>
        </div>

        <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
          {lista.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">Nada encontrado.</p>
          )}
          {lista.map((c) => (
            <LinhaConversa
              key={c.id}
              c={c}
              ativa={c.id === abertaId}
              onClick={async () => {
                setAbertaId(c.id);
                if (c.nao_lidas > 0 || c.precisa_humano) {
                  await supabase.rpc("wa_marcar_lida", { _contato_id: c.id, _lida: true });
                  recarregar();
                }
              }}
            />
          ))}
        </div>
      </div>

      {/* ─────────────────────────────────────────── painel da conversa */}
      <div className={aberta ? "" : "hidden lg:block"}>
        {aberta ? (
          <PainelConversa
            contato={aberta}
            eventId={eventId}
            onVoltar={() => setAbertaId(null)}
            onMudou={recarregar}
          />
        ) : (
          <Card className="hidden h-full min-h-[24rem] place-items-center p-12 text-center lg:grid">
            <div>
              <MessageCircle className="mx-auto h-8 w-8 text-muted-foreground/40" />
              <p className="mt-3 text-sm text-muted-foreground">
                Escolha uma conversa à esquerda para ler e responder.
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════ peças da lista */

function Aba({
  ativa, alerta, onClick, children,
}: { ativa: boolean; alerta?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-md border px-3 py-1.5 transition-colors ${
        ativa
          ? "border-primary bg-primary text-primary-foreground"
          : alerta
            ? "border-primary/50 text-primary hover:bg-secondary"
            : "border-border/60 hover:bg-secondary"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Uma linha da lista. Quem está esperando resposta ganha faixa lateral,
 * fundo tingido e o aviso pulsando — dá para triar sem clicar em nada.
 */
function LinhaConversa({ c, ativa, onClick }: { c: Contato; ativa: boolean; onClick: () => void }) {
  const espera = c.nao_lidas > 0 || c.precisa_humano;
  const calada = estaCalada(c);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative w-full overflow-hidden rounded-xl border p-3 text-left transition-colors ${
        ativa
          ? "border-primary bg-primary/10"
          : espera
            ? "border-border/60 bg-primary/5 hover:bg-primary/10"
            : "border-border/60 bg-card hover:bg-secondary/40"
      }`}
    >
      {espera && <span className="absolute inset-y-0 left-0 w-1 bg-primary" aria-hidden="true" />}

      <div className="flex items-start gap-3 pl-1.5">
        <div className="relative shrink-0">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-secondary text-sm font-semibold">
            {(c.nome ?? "?").trim().charAt(0).toUpperCase()}
          </div>
          {espera && (
            <span className="absolute -right-0.5 -top-0.5 h-3 w-3 animate-pulse rounded-full bg-primary ring-2 ring-background" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className={`truncate ${espera ? "font-bold" : "font-medium"}`}>
              {c.nome ?? c.wa_id}
            </span>
            <span className="shrink-0 text-[11px] text-muted-foreground">{quando(c.ultima_em)}</span>
          </div>

          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {c.ultima_direcao === "enviada" && <span className="text-muted-foreground/70">você: </span>}
            {previa(c.ultima_mensagem)}
          </p>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {espera ? (
              <span className="animate-pulse text-[11px] font-medium text-primary">
                ⏱ Aguardando resposta
              </span>
            ) : (
              <span className="text-[11px] text-muted-foreground">Respondida</span>
            )}
            {c.nao_lidas > 0 && (
              <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground tabular-nums">
                {c.nao_lidas}
              </span>
            )}
            {calada && (
              <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                IA pausada
              </span>
            )}
            {c.bloqueado && (
              <span className="rounded bg-destructive/20 px-1.5 py-0.5 text-[10px] text-destructive">
                bloqueado
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

/* ══════════════════════════════════════════════ painel da conversa */

function PainelConversa({
  contato, eventId, onVoltar, onMudou,
}: { contato: Contato; eventId: string; onVoltar: () => void; onMudou: () => void }) {
  const qc = useQueryClient();
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mostrarRapidas, setMostrarRapidas] = useState(false);
  const [mostrarIngressos, setMostrarIngressos] = useState(false);
  const fim = useRef<HTMLDivElement>(null);

  const { data: mensagens, isLoading } = useQuery({
    queryKey: ["wa-mensagens", contato.id],
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wa_mensagens")
        .select("id, direcao, texto, por_ia, precisou_humano, erro, created_at")
        .eq("contato_id", contato.id)
        .order("created_at")
        .limit(400);
      if (error) throw error;
      return data as Mensagem[];
    },
  });

  const { data: rapidas } = useQuery({
    queryKey: ["wa-rapidas", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wa_respostas_rapidas")
        .select("id, titulo, texto")
        .eq("event_id", eventId)
        .order("ordem");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    fim.current?.scrollIntoView({ block: "end" });
  }, [mensagens?.length, contato.id]);

  const enviar = async () => {
    const corpo = texto.trim();
    if (!corpo) return;
    setEnviando(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-enviar", {
        body: { contato_id: contato.id, texto: corpo },
      });
      const erro = (data as { error?: string } | null)?.error;
      if (error || erro) throw new Error(erro ?? error!.message);
      setTexto("");
      qc.invalidateQueries({ queryKey: ["wa-mensagens", contato.id] });
      onMudou();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui enviar");
      qc.invalidateQueries({ queryKey: ["wa-mensagens", contato.id] });
    } finally {
      setEnviando(false);
    }
  };

  const ajustar = async (campos: Partial<Contato>, aviso: string) => {
    const { error } = await supabase.from("wa_contatos").update(campos).eq("id", contato.id);
    if (error) return toast.error(error.message);
    toast.success(aviso);
    onMudou();
  };

  const calada = estaCalada(contato);

  return (
    <Card className="flex h-[70vh] flex-col overflow-hidden">
      {/* ─────────────────────────────────────────────────── cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 p-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button size="icon" variant="ghost" className="h-9 w-9 lg:hidden" onClick={onVoltar}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <div className="truncate font-semibold">{contato.nome ?? "Sem nome"}</div>
            <div className="text-xs text-muted-foreground">{contato.wa_id}</div>
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            size="sm"
            variant={mostrarIngressos ? "default" : "outline"}
            onClick={() => setMostrarIngressos((v) => !v)}
            title="Ingressos desta pessoa"
          >
            <Ticket className="mr-1.5 h-4 w-4" />
            Ingressos
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              ajustar(
                calada
                  ? { humano_assumiu: false, humano_ate: null }
                  : { humano_assumiu: true, humano_ate: new Date(Date.now() + 12 * 3600_000).toISOString() },
                calada ? "A IA voltou a responder" : "A IA parou por 12 horas",
              )
            }
          >
            {calada ? <UserRound className="mr-1.5 h-4 w-4" /> : <BotOff className="mr-1.5 h-4 w-4" />}
            {calada ? "Devolver à IA" : "Assumir"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              ajustar({ bloqueado: !contato.bloqueado }, contato.bloqueado ? "Desbloqueado" : "Bloqueado")
            }
          >
            <Ban className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {mostrarIngressos && (
        <PainelIngressos contato={contato} onFechar={() => setMostrarIngressos(false)} onMudou={onMudou} />
      )}

      {/* ───────────────────────────────────────────────── mensagens */}
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {mensagens?.map((m, i) => {
          const anterior = mensagens[i - 1];
          const novoDia =
            !anterior ||
            new Date(anterior.created_at).toDateString() !== new Date(m.created_at).toDateString();
          return (
            <div key={m.id}>
              {novoDia && (
                <div className="my-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-border/60" />
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {rotuloDia(m.created_at)}
                  </span>
                  <div className="h-px flex-1 bg-border/60" />
                </div>
              )}
              <Balao m={m} />
            </div>
          );
        })}
        <div ref={fim} />
      </div>

      {/* ──────────────────────────────────────── respostas rápidas */}
      {mostrarRapidas && (rapidas?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-border/60 bg-secondary/30 p-3">
          {rapidas!.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                setTexto((t) => (t ? `${t}\n${r.texto}` : r.texto));
                setMostrarRapidas(false);
              }}
              className="rounded-full border border-border/60 bg-card px-3 py-1.5 text-xs transition-colors hover:bg-secondary"
            >
              {r.titulo}
            </button>
          ))}
        </div>
      )}

      {/* ──────────────────────────────────────────── campo de envio */}
      <div className="border-t border-border/60 p-3">
        {contato.bloqueado ? (
          <p className="py-2 text-center text-sm text-muted-foreground">
            Contato bloqueado. Desbloqueie para responder.
          </p>
        ) : (
          <div className="flex items-end gap-2">
            <Button
              size="icon"
              variant="outline"
              className="h-11 w-11 shrink-0"
              onClick={() => setMostrarRapidas((v) => !v)}
              title="Respostas rápidas"
            >
              <Zap className="h-4 w-4" />
            </Button>
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  enviar();
                }
              }}
              rows={1}
              placeholder="Escreva a resposta — Enter envia, Shift+Enter quebra a linha"
              className="max-h-32 min-h-11 resize-none"
            />
            <Button
              size="icon"
              className="h-11 w-11 shrink-0"
              onClick={enviar}
              disabled={enviando || !texto.trim()}
            >
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        )}
        <p className="mt-2 text-[11px] text-muted-foreground">
          A mensagem sai assinada com o seu nome, e a IA para de responder esta conversa por 12 horas.
        </p>
      </div>
    </Card>
  );
}

function Balao({ m }: { m: Mensagem }) {
  const minha = m.direcao === "enviada";
  return (
    <div
      className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
        minha ? "ml-auto bg-primary/15" : "bg-secondary/60"
      } ${m.erro ? "border border-destructive/50" : ""}`}
    >
      <div className="whitespace-pre-wrap break-words">{previa(m.texto)}</div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>{hora(m.created_at)}</span>
        {minha && <span>· {m.por_ia ? "IA" : "equipe"}</span>}
        {m.precisou_humano && <span>· pediu atendente</span>}
      </div>
      {m.erro && <p className="mt-1.5 text-xs text-destructive">Não enviada: {m.erro}</p>}
    </div>
  );
}

/* ═══════════════════════════════════════════ ingressos desta pessoa */

type Pedido = {
  id: string;
  status: string;
  total_cents: number;
  criado_em: string;
  pago_em: string | null;
  meio: string | null;
  origem: string;
  ingressos: number;
  usados: number;
  itens: Array<{ tipo: string; lote: string; qtd: number }>;
};

type Ingressos = {
  vinculado: boolean;
  email?: string;
  resumo?: { pedidos: number; pagos: number; aguardando: number; gasto_cents: number };
  pedidos?: Pedido[];
};

const SITUACAO: Record<string, { rotulo: string; classe: string }> = {
  paid: { rotulo: "Pago", classe: "bg-success/20 text-success" },
  pending: { rotulo: "Aguardando pagamento", classe: "bg-primary/20 text-primary" },
  expired: { rotulo: "Expirado", classe: "bg-muted text-muted-foreground" },
  cancelled: { rotulo: "Cancelado", classe: "bg-destructive/20 text-destructive" },
};

/**
 * Mostra o que a pessoa comprou, se pagou e se já entrou no evento.
 *
 * O vínculo é sempre pelo e-mail da compra — nunca pelo telefone de quem está
 * escrevendo, porque o número de quem manda mensagem não prova nada sobre
 * quem comprou.
 */
function PainelIngressos({
  contato, onFechar, onMudou,
}: { contato: Contato; onFechar: () => void; onMudou: () => void }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState(contato.email_comprador ?? "");
  const [salvando, setSalvando] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["wa-ingressos", contato.id, contato.email_comprador],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("wa_ingressos_do_contato", {
        _contato_id: contato.id,
      });
      if (error) throw error;
      return data as unknown as Ingressos;
    },
  });

  const vincular = async (novo: string) => {
    setSalvando(true);
    try {
      const { error } = await supabase.rpc("wa_vincular_email", {
        _contato_id: contato.id,
        _email: novo,
      });
      if (error) throw error;
      toast.success(novo ? "E-mail vinculado" : "Vínculo removido");
      qc.invalidateQueries({ queryKey: ["wa-ingressos", contato.id] });
      onMudou();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui vincular");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="border-b border-border/60 bg-secondary/30 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Ticket className="h-4 w-4 text-primary" />
          Ingressos desta pessoa
        </div>
        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onFechar}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}

      {/* ── sem vínculo: pedir o e-mail da compra */}
      {!isLoading && !data?.vinculado && (
        <div>
          <p className="text-sm text-muted-foreground">
            Ainda não sabemos quem é esta pessoa no sistema. Informe o e-mail que ela usou na
            compra para ver os ingressos aqui.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@dapessoa.com"
              className="h-10 min-w-0 flex-1"
              type="email"
            />
            <Button size="sm" className="h-10" onClick={() => vincular(email)} disabled={salvando || !email.trim()}>
              {salvando ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Link2 className="mr-1.5 h-4 w-4" />}
              Vincular
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Confira o e-mail com a pessoa antes de vincular. Nunca usamos o telefone como prova
            de compra.
          </p>
        </div>
      )}

      {/* ── vinculado: mostra o que ela comprou */}
      {!isLoading && data?.vinculado && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="truncate text-sm text-muted-foreground">{data.email}</span>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => vincular("")} disabled={salvando}>
              Desvincular
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <Mini rotulo="Pedidos pagos" valor={String(data.resumo?.pagos ?? 0)} />
            <Mini rotulo="Aguardando" valor={String(data.resumo?.aguardando ?? 0)} />
            <Mini rotulo="Total gasto" valor={brl(data.resumo?.gasto_cents ?? 0)} />
          </div>

          {data.pedidos?.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhum pedido neste e-mail. Confirme se foi esse mesmo que ela usou.
            </p>
          )}

          <div className="space-y-2">
            {data.pedidos?.map((p) => {
              const s = SITUACAO[p.status] ?? { rotulo: p.status, classe: "bg-muted" };
              return (
                <div key={p.id} className="rounded-lg border border-border/60 bg-card p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${s.classe}`}>
                      {s.rotulo}
                    </span>
                    <span className="font-semibold tabular-nums">{brl(p.total_cents)}</span>
                  </div>

                  <div className="mt-2 text-sm">
                    {p.itens.map((i, n) => (
                      <div key={n} className="text-muted-foreground">
                        {i.qtd}× {i.tipo} · {i.lote}
                      </div>
                    ))}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      {p.usados} de {p.ingressos} {p.ingressos === 1 ? "entrada usada" : "entradas usadas"}
                    </span>
                    {p.origem === "portaria" && <span>· vendido na portaria</span>}
                    {p.pago_em && <span>· pago em {new Date(p.pago_em).toLocaleDateString("pt-BR")}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Mini({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-2">
      <div className="font-display text-base font-bold tabular-nums">{valor}</div>
      <div className="text-[10px] leading-tight text-muted-foreground">{rotulo}</div>
    </div>
  );
}
