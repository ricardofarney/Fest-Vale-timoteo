-- Dados de teste do evento oficial ficam guardados, mas fora dos números.
-- Aplicado direto no projeto dwynfydbtkwwppwblkbu em 20/10/2026
-- (a exclusão definitiva dependia de uma aprovação que não chegava ao usuário).
--
-- Estrutura (migração "caixas_de_teste_fora_dos_relatorios"):
--   pdv_caixas.teste boolean — caixa de teste fica fora do relatório final e do painel do dia;
--   relatorio_final: lote encerrado sem nenhuma venda/ingresso sai da lista por lote.
--
-- Dados (UPDATE, sem apagar nada):
--   pedido de teste 735d409e… (ingresso R$ 1,00 vendido na maquininha em 06/10) -> cancelado,
--     ingresso dele cancelado; venda a1149787… no PDV -> cancelada;
--   lotes antigos de teste (R$ 30 e R$ 40) -> quantidade vendida 0 (já estavam encerrados);
--   2 caixas abertos em 06/10 sem movimento -> fechados, marcados teste = true;
--   evento oficial -> modo_teste = false.
-- Conferência dos ingressos impressos após a mudança: 1º lote, 2º lote e Cortesia íntegros.

alter table public.pdv_caixas add column if not exists teste boolean not null default false;
