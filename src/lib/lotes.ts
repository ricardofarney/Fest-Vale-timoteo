/**
 * Regras de exibição e venda dos lotes de ingresso.
 *
 * canal (coluna em ticket_batches):
 *   todos    — site e portaria
 *   site     — só pelo site
 *   portaria — só no PDV, no dia do evento
 *   fisico   — ingresso impresso, vendido fora do sistema (membros da Maçonaria).
 *              Aparece travado no site, com o aviso e o botão do WhatsApp.
 * a_definir — venda ainda não liberada: aparece como "Em breve" (com o valor, se já houver) e não vende.
 * oculto    — não aparece no site nem no atendimento (ex.: cortesias de parceiros).
 * pontos_venda — lugares onde o ingresso físico é vendido, mostrados no site.
 *
 * A trava de verdade está no banco (gatilho order_items_trava_lote e
 * pdv_lotes_ativos); aqui é só o que a pessoa vê.
 */
import { linkWhatsapp } from "@/lib/fest";

export type Canal = "todos" | "site" | "portaria" | "fisico";

export type LoteBase = {
  name: string;
  price_cents: number;
  quantity_total: number;
  quantity_sold: number;
  starts_at?: string | null;
  ends_at?: string | null;
  canal?: Canal | string | null;
  a_definir?: boolean | null;
  aviso?: string | null;
  oculto?: boolean | null;
  pontos_venda?: string[] | null;
};

export type EstadoLote =
  | "a_venda"   // dá para comprar no site agora
  | "fisico"    // travado: só com os membros
  | "portaria"  // só no dia, na entrada
  | "em_breve"  // valor/data a definir, ou ainda não começou
  | "esgotado"
  | "encerrado";

export const CANAL_LABEL: Record<Canal, string> = {
  todos: "Site e portaria",
  site: "Só pelo site",
  portaria: "Só na portaria",
  fisico: "Ingresso físico (fora do site)",
};

export function canalDe(b: LoteBase): Canal {
  const c = (b.canal ?? "todos") as Canal;
  return c in CANAL_LABEL ? c : "todos";
}

/** Quando o lote não tem limite (0), nunca esgota. */
export function restantesDe(b: LoteBase): number | null {
  if (!b.quantity_total) return null;
  return Math.max(b.quantity_total - (b.quantity_sold ?? 0), 0);
}

export function estadoDoLote(b: LoteBase, agora = Date.now()): EstadoLote {
  if (b.a_definir) return "em_breve";
  const canal = canalDe(b);
  if (b.ends_at && new Date(b.ends_at).getTime() <= agora) return "encerrado";
  // Portaria só vende no dia, mas no site já mostra "na portaria" com o valor.
  if (canal === "portaria") return "portaria";
  if (b.starts_at && new Date(b.starts_at).getTime() > agora) return "em_breve";
  if (canal === "fisico") return "fisico";
  const r = restantesDe(b);
  if (r !== null && r <= 0) return "esgotado";
  return "a_venda";
}

/** Lote que aparece no site (cortesias e afins ficam de fora). */
export const visivelNoSite = (b: LoteBase) => !b.oculto;

/** Valor para mostrar: "a definir" enquanto não houver preço. */
export const temPreco = (b: { price_cents: number }) => (b.price_cents ?? 0) > 0;

/**
 * Lote físico vendido pelos membros (sem pontos de venda cadastrados) ganha o
 * botão do WhatsApp; o de pontos de venda mostra a lista de lugares.
 */
export const usaWhatsapp = (b: LoteBase) => canalDe(b) === "fisico" && !(b.pontos_venda?.length);

/** Lote que o site pode vender agora (o primeiro, pela ordem). */
export function loteAVenda<T extends LoteBase & { sort_order?: number }>(lotes: T[]): T | null {
  const ord = [...lotes].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  return ord.find((b) => estadoDoLote(b) === "a_venda") ?? null;
}

export const AVISO_FISICO_PADRAO =
  "Lote disponível apenas para compra física com os membros da Maçonaria.";

/** Botão do WhatsApp do lote físico, com a mensagem já pronta. */
export function whatsappDoLoteFisico(nomeLote: string): string | null {
  return linkWhatsapp(`Olá! Vim pelo site do Fest Vale e quero comprar ingresso do ${nomeLote}.`);
}

/** "0001", "2650"… como sai impresso no ingresso. */
export const numeroIngresso = (n: number | null | undefined) =>
  n == null ? "" : String(n).padStart(4, "0");
