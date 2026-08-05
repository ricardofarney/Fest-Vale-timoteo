/**
 * Tipos e helpers compartilhados pelas telas do PDV.
 *
 * MODO DEMONSTRAÇÃO: enquanto a maquininha não estiver conectada, os botões de
 * cartão e Pix registram a venda direto, sem cobrar de verdade. É o que permite
 * apresentar o sistema funcionando antes de existir terminal. Quando a
 * integração entrar, só o trecho marcado em `cobrar()` muda.
 */

export type MeioPagamento = "dinheiro" | "cartao" | "pix" | "cortesia";

export type Produto = {
  id: string;
  name: string;
  category: string | null;
  price_cents: number;
  stock_qty: number;
  stock_alert: number;
  controla_estoque: boolean;
  active: boolean;
  sort_order: number;
};

export type ItemCarrinho = { produto: Produto; qtd: number };

export type VendaRegistrada = {
  sale_id: string;
  ticket_token: string;
  total_cents: number;
  itens: { nome: string; qtd: number; preco_cents: number }[];
};

export const MEIOS: { id: MeioPagamento; label: string; dica: string }[] = [
  { id: "dinheiro", label: "Dinheiro", dica: "Recebido em espécie" },
  { id: "cartao", label: "Cartão", dica: "Crédito ou débito" },
  { id: "pix", label: "Pix", dica: "Transferência instantânea" },
];

export const totalCarrinho = (itens: ItemCarrinho[]) =>
  itens.reduce((s, i) => s + i.qtd * i.produto.price_cents, 0);

export const totalUnidades = (itens: ItemCarrinho[]) =>
  itens.reduce((s, i) => s + i.qtd, 0);

/** Nome do caixa fica no aparelho, para o operador não precisar reescolher a cada venda. */
const CHAVE_CAIXA = "festvale.pdv.caixa";

export function lerCaixaSalvo(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.sessionStorage.getItem(CHAVE_CAIXA) ?? "";
  } catch {
    return "";
  }
}

export function salvarCaixa(nome: string) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(CHAVE_CAIXA, nome);
  } catch {
    /* aparelho sem armazenamento: segue sem lembrar */
  }
}

/** Estoque baixo o suficiente para avisar na tela. */
export function estoqueCritico(p: Produto) {
  return p.controla_estoque && p.stock_alert > 0 && p.stock_qty <= p.stock_alert;
}

export function esgotado(p: Produto) {
  return p.controla_estoque && p.stock_qty <= 0;
}
