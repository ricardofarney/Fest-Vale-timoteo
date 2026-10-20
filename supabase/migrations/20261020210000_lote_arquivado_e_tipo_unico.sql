-- Aplicado direto no projeto dwynfydbtkwwppwblkbu em 20/10/2026.
-- Todos os ingressos do Fest Vale são iguais (sem pista/VIP).
alter table public.ticket_batches add column if not exists arquivado boolean not null default false;
comment on column public.ticket_batches.arquivado is 'Lote que não vale mais (ex.: lote de teste). Some do painel de edição e do site; o histórico fica guardado.';
-- Lotes de teste antigos (R$ 30 e R$ 40, encerrados, sem venda) arquivados.
-- Tipo único do evento renomeado de "Pista" para "Fest Vale 2027"; com um tipo só,
-- o site mostra apenas o nome do lote.
