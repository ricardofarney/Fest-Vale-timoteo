import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { brl } from "@/lib/format";
import { toast } from "sonner";
import { ArrowLeft, FileDown, Loader2, Lock, RefreshCw } from "lucide-react";

/**
 * Relatório final para a diretoria — o fechamento do evento inteiro numa
 * página só: ingressos (site e portaria), bar, maquininhas, cortesias, caixas
 * com a conferência dos envelopes, horário de pico e estoque final.
 * O botão gera um PDF de verdade (texto, não foto da tela), pronto para
 * imprimir ou mandar no WhatsApp.
 */
export const Route = createFileRoute("/_authenticated/pdv/$eventId/relatorio-final")({
  head: () => ({ meta: [{ title: "Relatório final — Fest Vale Timóteo" }] }),
  component: RelatorioFinal,
});

type Rel = {
  gerado_em: string;
  evento: { nome: string; inicio: string; modo_teste: boolean };
  ingressos: {
    por_lote: { tipo: string; lote: string; preco: number; site: number; portaria: number; receita: number }[];
    site_qtd: number; site_receita: number; portaria_qtd: number; portaria_receita: number;
    presentes: number; emitidos: number; site_por_meio: Record<string, number>;
  };
  bar: {
    receita: number; itens: number; vendas: number;
    por_categoria: { categoria: string; qtd: number; receita: number | null }[];
    por_produto: { nome: string; categoria: string | null; preco: number; vendidos: number; cortesias: number; receita: number; estoque_final: number }[];
    cortesias: { motivo: string; vendas: number; itens: number; valor: number }[];
  };
  maquininhas_por_meio: { credito: number; debito: number; pix: number; dinheiro: number; offline: number };
  caixas: {
    operador: string; aberto_em: string; fechado_em: string | null; fundo: number; vendido: number; vendas: number;
    dinheiro: number; sangrado: number; esperado: number; entregue: number | null; conferido: number | null;
    conferido_por: string | null; obs: string | null;
  }[];
  por_hora: { hora: string; valor: number; vendas: number }[];
};

const FUSO = "America/Sao_Paulo";
const hora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: FUSO }) : "—";
const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: FUSO });

const MEIO_SITE: Record<string, string> = {
  pix: "Pix", credit_card: "Cartão de crédito", debit_card: "Cartão de débito", boleto: "Boleto",
  ticket: "Boleto", "teste-interno": "Teste interno", outro: "Outro",
};

/** Diferença do envelope: o que foi contado (ou declarado) menos o esperado. */
const diferenca = (c: Rel["caixas"][number]) => {
  const base = c.conferido ?? c.entregue;
  return base == null || !c.fechado_em ? null : base - c.esperado;
};

function RelatorioFinal() {
  const { eventId } = Route.useParams();
  const [gerando, setGerando] = useState(false);

  const { data, error, isFetching, refetch } = useQuery({
    queryKey: ["relatorio-final", eventId],
    queryFn: async () => {
      // A função nova ainda não está nos tipos gerados do Supabase.
      const rpc = supabase.rpc.bind(supabase) as unknown as (f: string, a: Record<string, unknown>) =>
        Promise<{ data: unknown; error: { message: string } | null }>;
      const { data, error } = await rpc("relatorio_final", { _event_id: eventId });
      if (error) throw new Error(error.message);
      return data as Rel;
    },
  });

  if (error) {
    return (
      <div className="container mx-auto max-w-lg px-4 py-10">
        <Voltar eventId={eventId} />
        <Card className="p-6 text-center">
          <Lock className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium">Sem acesso ao relatório</p>
          <p className="mt-1 text-sm text-muted-foreground">{(error as Error).message}</p>
        </Card>
      </div>
    );
  }
  if (!data) {
    return <div className="py-24 text-center text-muted-foreground"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></div>;
  }

  const r = data;
  const totalIngressos = r.ingressos.site_receita + r.ingressos.portaria_receita;
  const totalGeral = totalIngressos + r.bar.receita;
  const m = r.maquininhas_por_meio;
  const totalMaquininhas = m.credito + m.debito + m.pix + m.dinheiro;
  const pico = r.por_hora.reduce<Rel["por_hora"][number] | null>((a, b) => (!a || b.valor > a.valor ? b : a), null);
  const fechados = r.caixas.filter((c) => c.fechado_em);
  const somaDif = fechados.reduce((s, c) => s + (diferenca(c) ?? 0), 0);
  const naoConferidos = fechados.filter((c) => c.conferido == null).length;
  const abertos = r.caixas.filter((c) => !c.fechado_em).length;
  const cortesiaValor = r.bar.cortesias.reduce((s, c) => s + c.valor, 0);

  const baixarPdf = async () => {
    setGerando(true);
    try {
      await gerarPdf(r);
    } catch (e) {
      console.error(e);
      toast.error("Não consegui gerar o PDF");
    } finally {
      setGerando(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-5">
      <Voltar eventId={eventId} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Relatório final</h1>
          <p className="text-sm text-muted-foreground">{r.evento.nome} · gerado em {dataHora(r.gerado_em)}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} aria-label="Atualizar">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" onClick={baixarPdf} disabled={gerando}>
            {gerando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
            Baixar PDF
          </Button>
        </div>
      </div>

      {r.evento.modo_teste && (
        <div className="mt-3 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs">
          <span className="font-semibold">Evento em modo de teste.</span> Os números incluem vendas de teste.
        </div>
      )}
      {(abertos > 0 || naoConferidos > 0) && (
        <div className="mt-3 rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm">
          {abertos > 0 && <div>{abertos} {abertos === 1 ? "caixa ainda aberto" : "caixas ainda abertos"} — o relatório não está fechado.</div>}
          {naoConferidos > 0 && <div>{naoConferidos} {naoConferidos === 1 ? "envelope sem conferência" : "envelopes sem conferência"} do financeiro.</div>}
        </div>
      )}

      {/* ----------------------------------------------------------- resumo */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Numero rotulo="Faturamento total" valor={brl(totalGeral)} destaque />
        <Numero rotulo="Ingressos" valor={brl(totalIngressos)} sub={`${r.ingressos.site_qtd + r.ingressos.portaria_qtd} vendidos`} />
        <Numero rotulo="Bar" valor={brl(r.bar.receita)} sub={`${r.bar.itens} itens`} />
        <Numero rotulo="Público presente" valor={String(r.ingressos.presentes)} sub={`de ${r.ingressos.emitidos} ingressos`} />
      </div>

      {/* -------------------------------------------------------- ingressos */}
      <Secao titulo="Ingressos">
        <Tabela
          cab={["Tipo / lote", "Preço", "Site", "Portaria", "Receita"]}
          linhas={r.ingressos.por_lote.map((l) => [`${l.tipo} — ${l.lote}`, brl(l.preco), l.site, l.portaria, brl(l.receita)])}
          rodape={["Total", "", r.ingressos.site_qtd, r.ingressos.portaria_qtd, brl(totalIngressos)]}
          direita={[1, 2, 3, 4]}
        />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Card className="p-4">
            <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Site, por forma de pagamento</div>
            {Object.entries(r.ingressos.site_por_meio).map(([k, v]) => (
              <Linha key={k} a={MEIO_SITE[k] ?? k} b={brl(v)} />
            ))}
            <Linha a="Total do site" b={brl(r.ingressos.site_receita)} forte />
          </Card>
          <Card className="p-4">
            <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Entrada</div>
            <Linha a="Ingressos emitidos" b={r.ingressos.emitidos} />
            <Linha a="Pessoas que entraram" b={r.ingressos.presentes} />
            <Linha a="Não compareceram" b={Math.max(0, r.ingressos.emitidos - r.ingressos.presentes)} />
            <Linha a="Vendidos na portaria" b={`${r.ingressos.portaria_qtd} · ${brl(r.ingressos.portaria_receita)}`} />
          </Card>
        </div>
      </Secao>

      {/* --------------------------------------------------------------- bar */}
      <Secao titulo="Bar e comida">
        <Tabela
          cab={["Categoria", "Itens", "Receita"]}
          linhas={r.bar.por_categoria.map((c) => [c.categoria, c.qtd, brl(c.receita ?? 0)])}
          rodape={["Total", r.bar.itens, brl(r.bar.receita)]}
          direita={[1, 2]}
        />
        <div className="mt-3">
          <Tabela
            cab={["Produto", "Vendidos", "Cortesia", "Receita", "Estoque final"]}
            linhas={r.bar.por_produto.map((p) => [p.nome, p.vendidos, p.cortesias || "", brl(p.receita), p.estoque_final])}
            direita={[1, 2, 3, 4]}
            destacarNegativo={4}
          />
        </div>
        {r.bar.cortesias.length > 0 && (
          <div className="mt-3">
            <Tabela
              cab={["Cortesia para", "Itens", "Valor de tabela"]}
              linhas={r.bar.cortesias.map((c) => [c.motivo, c.itens, brl(c.valor)])}
              rodape={["Total de cortesias", r.bar.cortesias.reduce((s, c) => s + c.itens, 0), brl(cortesiaValor)]}
              direita={[1, 2]}
            />
          </div>
        )}
      </Secao>

      {/* ------------------------------------------------------- maquininhas */}
      <Secao titulo="Maquininhas (bar e portaria)">
        <Card className="p-4">
          <Linha a="Crédito" b={brl(m.credito)} />
          <Linha a="Débito" b={brl(m.debito)} />
          <Linha a="Pix" b={brl(m.pix)} />
          <Linha a="Dinheiro" b={brl(m.dinheiro)} />
          <Linha a="Total" b={brl(totalMaquininhas)} forte />
          {m.offline > 0 && <p className="mt-2 text-xs text-muted-foreground">{m.offline} vendas foram feitas sem internet e subiram depois.</p>}
        </Card>
      </Secao>

      {/* ------------------------------------------------------------ caixas */}
      <Secao titulo="Caixas e conferência dos envelopes">
        <Tabela
          cab={["Operador", "Horário", "Vendido", "Fundo", "Sangrias", "Esperado", "Contado", "Diferença"]}
          linhas={r.caixas.map((c) => {
            const d = diferenca(c);
            return [
              c.operador,
              `${hora(c.aberto_em)}–${c.fechado_em ? hora(c.fechado_em) : "aberto"}`,
              brl(c.vendido), brl(c.fundo), brl(c.sangrado), brl(c.esperado),
              c.conferido != null ? brl(c.conferido) : c.entregue != null ? `${brl(c.entregue)}*` : "—",
              d == null ? "—" : d === 0 ? "ok" : d > 0 ? `+${brl(d)}` : `−${brl(-d)}`,
            ];
          })}
          rodape={["", "", "", "", "", "", "Saldo", somaDif === 0 ? "ok" : somaDif > 0 ? `+${brl(somaDif)}` : `−${brl(-somaDif)}`]}
          direita={[2, 3, 4, 5, 6, 7]}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          * valor declarado pelo operador, ainda não conferido pelo financeiro. Esperado = fundo + vendas em dinheiro − sangrias.
        </p>
      </Secao>

      {/* --------------------------------------------------------------- pico */}
      <Secao titulo="Vendas por hora (bar e portaria)">
        {pico && <p className="mb-2 text-sm">Pico: <span className="font-semibold">{pico.hora.slice(11, 16)}</span> com {brl(pico.valor)} em {pico.vendas} vendas.</p>}
        <Tabela
          cab={["Hora", "Vendas", "Valor"]}
          linhas={r.por_hora.map((h) => [`${h.hora.slice(8, 10)}/${h.hora.slice(5, 7)} ${h.hora.slice(11, 16)}`, h.vendas, brl(h.valor)])}
          direita={[1, 2]}
        />
      </Secao>
    </div>
  );
}

function Voltar({ eventId }: { eventId: string }) {
  return (
    <Link to="/pdv/$eventId/gestao" params={{ eventId }} className="mb-3 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="mr-1 h-4 w-4" />Gestão do dia
    </Link>
  );
}

function Numero({ rotulo, valor, sub, destaque }: { rotulo: string; valor: string; sub?: string; destaque?: boolean }) {
  return (
    <Card className={`p-4 ${destaque ? "border-primary/50 bg-primary/10" : ""}`}>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{rotulo}</div>
      <div className="mt-1 font-display text-xl font-bold tabular-nums">{valor}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </Card>
  );
}

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-2 font-display text-lg font-semibold">{titulo}</h2>
      {children}
    </section>
  );
}

function Linha({ a, b, forte }: { a: ReactNode; b: ReactNode; forte?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 py-0.5 text-sm ${forte ? "mt-1 border-t border-border/60 pt-1.5 font-semibold" : ""}`}>
      <span className={forte ? "" : "text-muted-foreground"}>{a}</span>
      <span className="tabular-nums">{b}</span>
    </div>
  );
}

function Tabela({ cab, linhas, rodape, direita = [], destacarNegativo }: {
  cab: string[]; linhas: (string | number)[][]; rodape?: (string | number)[]; direita?: number[]; destacarNegativo?: number;
}) {
  const alinh = (i: number) => (direita.includes(i) ? "text-right" : "text-left");
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-sm">
        <thead>
          <tr className="border-b border-border/60 text-xs uppercase tracking-wider text-muted-foreground">
            {cab.map((c, i) => <th key={i} className={`px-3 py-2 font-medium ${alinh(i)}`}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {linhas.length === 0 && (
            <tr><td colSpan={cab.length} className="px-3 py-4 text-center text-muted-foreground">Nada registrado.</td></tr>
          )}
          {linhas.map((l, n) => (
            <tr key={n} className="border-b border-border/40 last:border-0">
              {l.map((v, i) => (
                <td key={i} className={`px-3 py-1.5 tabular-nums ${alinh(i)} ${destacarNegativo === i && typeof v === "number" && v < 0 ? "font-semibold text-destructive" : ""}`}>{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
        {rodape && (
          <tfoot>
            <tr className="border-t border-border/60 font-semibold">
              {rodape.map((v, i) => <td key={i} className={`px-3 py-2 tabular-nums ${alinh(i)}`}>{v}</td>)}
            </tr>
          </tfoot>
        )}
      </table>
    </Card>
  );
}

// ------------------------------------------------------------------- PDF

async function gerarPdf(r: Rel) {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const larg = doc.internal.pageSize.getWidth();
  const cinza: [number, number, number] = [47, 48, 49];
  let y = 16;
  // A fonte padrão do PDF não tem o espaço especial que o real (R$) usa.
  const txt = (v: string | number) => String(v).replace(/\u00a0/g, " ").replace(/\u2212/g, "-");

  const titulo = (t: string) => {
    if (y > 250) { doc.addPage(); y = 16; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(...cinza);
    doc.text(t, 14, y); y += 3;
  };
  const tabela = (head: string[], body: (string | number)[][], foot?: (string | number)[], direita: number[] = []) => {
    autoTable(doc, {
      startY: y, head: [head], body: body.map((l) => l.map(txt)), foot: foot ? [foot.map(txt)] : undefined,
      theme: "grid", styles: { fontSize: 8.5, cellPadding: 1.6 },
      headStyles: { fillColor: cinza, textColor: 255 }, footStyles: { fillColor: [235, 237, 240], textColor: 20, fontStyle: "bold" },
      columnStyles: Object.fromEntries(direita.map((i) => [i, { halign: "right" }])),
      margin: { left: 14, right: 14 },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 8;
  };

  const totalIng = r.ingressos.site_receita + r.ingressos.portaria_receita;
  const m = r.maquininhas_por_meio;

  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(...cinza);
  doc.text("Relatório final", 14, y); y += 7;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text(`${r.evento.nome}`, 14, y); y += 5;
  doc.text(`Gerado em ${dataHora(r.gerado_em)} (horário de Brasília)`, 14, y); y += 5;
  if (r.evento.modo_teste) { doc.setTextColor(180, 90, 0); doc.text("Evento em modo de teste — os números incluem vendas de teste.", 14, y); doc.setTextColor(...cinza); y += 5; }
  y += 3;

  titulo("Resumo");
  tabela(["", "Valor"], [
    ["Ingressos (site + portaria)", brl(totalIng)],
    ["Bar e comida", brl(r.bar.receita)],
    ["Cortesias (valor de tabela, não somado)", brl(r.bar.cortesias.reduce((s, c) => s + c.valor, 0))],
    ["Público presente", `${r.ingressos.presentes} de ${r.ingressos.emitidos} ingressos`],
  ], ["Faturamento total", brl(totalIng + r.bar.receita)], [1]);

  titulo("Ingressos");
  tabela(["Tipo / lote", "Preço", "Site", "Portaria", "Receita"],
    r.ingressos.por_lote.map((l) => [`${l.tipo} — ${l.lote}`, brl(l.preco), l.site, l.portaria, brl(l.receita)]),
    ["Total", "", r.ingressos.site_qtd, r.ingressos.portaria_qtd, brl(totalIng)], [1, 2, 3, 4]);
  tabela(["Site, por forma de pagamento", "Valor"],
    Object.entries(r.ingressos.site_por_meio).map(([k, v]) => [MEIO_SITE[k] ?? k, brl(v)]),
    ["Total do site", brl(r.ingressos.site_receita)], [1]);

  titulo("Bar e comida");
  tabela(["Categoria", "Itens", "Receita"], r.bar.por_categoria.map((c) => [c.categoria, c.qtd, brl(c.receita ?? 0)]),
    ["Total", r.bar.itens, brl(r.bar.receita)], [1, 2]);
  tabela(["Produto", "Vendidos", "Cortesia", "Receita", "Estoque final"],
    r.bar.por_produto.map((p) => [p.nome, p.vendidos, p.cortesias || "", brl(p.receita), p.estoque_final]), undefined, [1, 2, 3, 4]);
  if (r.bar.cortesias.length) {
    tabela(["Cortesia para", "Itens", "Valor de tabela"], r.bar.cortesias.map((c) => [c.motivo, c.itens, brl(c.valor)]), undefined, [1, 2]);
  }

  titulo("Maquininhas (bar e portaria)");
  tabela(["Forma de pagamento", "Valor"], [["Crédito", brl(m.credito)], ["Débito", brl(m.debito)], ["Pix", brl(m.pix)], ["Dinheiro", brl(m.dinheiro)]],
    ["Total", brl(m.credito + m.debito + m.pix + m.dinheiro)], [1]);

  titulo("Caixas e conferência dos envelopes");
  tabela(["Operador", "Horário", "Vendido", "Fundo", "Sangrias", "Esperado", "Contado", "Dif."],
    r.caixas.map((c) => {
      const d = diferenca(c);
      return [c.operador, `${hora(c.aberto_em)}–${c.fechado_em ? hora(c.fechado_em) : "aberto"}`, brl(c.vendido), brl(c.fundo),
        brl(c.sangrado), brl(c.esperado),
        c.conferido != null ? brl(c.conferido) : c.entregue != null ? `${brl(c.entregue)}*` : "—",
        d == null ? "—" : d === 0 ? "ok" : d > 0 ? `+${brl(d)}` : `-${brl(-d)}`];
    }), undefined, [2, 3, 4, 5, 6, 7]);
  doc.setFontSize(8); doc.text("* declarado pelo operador, sem conferência do financeiro.", 14, y - 5);

  titulo("Vendas por hora");
  tabela(["Hora", "Vendas", "Valor"], r.por_hora.map((h) => [`${h.hora.slice(8, 10)}/${h.hora.slice(5, 7)} ${h.hora.slice(11, 16)}`, h.vendas, brl(h.valor)]), undefined, [1, 2]);

  // assinaturas
  if (y > 240) { doc.addPage(); y = 30; }
  y += 12;
  doc.setDrawColor(...cinza);
  doc.line(14, y, 90, y); doc.line(larg - 90, y, larg - 14, y);
  doc.setFontSize(9); doc.text("Financeiro", 14, y + 5); doc.text("Organizador", larg - 90, y + 5);

  const nome = `relatorio-final-${r.evento.nome.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}.pdf`;
  doc.save(nome);
}
