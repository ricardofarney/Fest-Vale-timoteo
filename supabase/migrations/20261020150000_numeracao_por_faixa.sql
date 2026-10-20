-- Numeração única dos ingressos do evento, por faixas de cada lote.
-- Aplicado direto no projeto dwynfydbtkwwppwblkbu em 20/10/2026.
--
-- Cada lote tem uma ou mais faixas (ex.: 3º lote 2201–2600). O ingresso
-- recebe o menor número livre das faixas do seu lote, na hora em que nasce
-- (site, portaria ou emissão física). Quando o lote ganha mais ingressos, ou
-- a portaria vende além do previsto, a faixa nova começa depois do maior
-- número já reservado no evento (ex.: 3301–3500). Nunca há número repetido.

alter table public.ticket_batches
  add column if not exists oculto boolean not null default false,
  add column if not exists pontos_venda text[] not null default '{}';
comment on column public.ticket_batches.oculto is
  'Não aparece no site nem no atendimento (ex.: cortesias de parceiros).';
comment on column public.ticket_batches.pontos_venda is
  'Pontos de venda físicos mostrados no site, um por item (ex.: Gráfica Ponta de Lápis — Quitandinha, Timóteo).';

create table if not exists public.lote_faixas (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id),
  batch_id uuid not null references public.ticket_batches(id) on delete cascade,
  inicio integer not null check (inicio > 0),
  fim integer not null,
  created_at timestamptz not null default now(),
  check (fim >= inicio)
);
create index if not exists lote_faixas_evento_idx on public.lote_faixas (event_id, fim);
create index if not exists lote_faixas_lote_idx on public.lote_faixas (batch_id);
alter table public.lote_faixas enable row level security;
create policy "gestor le faixas" on public.lote_faixas
  for select using (public.pode_gerenciar_evento(event_id));

create or replace function public.lote_evento(_batch uuid)
returns uuid language sql stable security definer set search_path to 'public' as $$
  select t.event_id from ticket_batches b join ticket_types t on t.id = b.ticket_type_id where b.id = _batch;
$$;

-- Reserva _qtd números novos para o lote, depois do maior número do evento.
create or replace function public.lote_alocar_faixa(_batch uuid, _qtd integer)
returns void language plpgsql security definer set search_path to 'public' as $$
declare _ev uuid; _ini int;
begin
  if _qtd is null or _qtd <= 0 then return; end if;
  _ev := public.lote_evento(_batch);
  perform pg_advisory_xact_lock(hashtextextended('numeracao:' || _ev::text, 0));
  select coalesce(max(fim), 0) + 1 into _ini from lote_faixas where event_id = _ev;
  -- Se a última faixa do evento já é deste lote, só estica
  update lote_faixas set fim = fim + _qtd
   where event_id = _ev and batch_id = _batch and fim = _ini - 1;
  if not found then
    insert into lote_faixas (event_id, batch_id, inicio, fim)
    values (_ev, _batch, _ini, _ini + _qtd - 1);
  end if;
end;
$$;
revoke all on function public.lote_alocar_faixa(uuid, integer) from public, anon, authenticated;

-- Lote criado ou ampliado: garante faixa para toda a quantidade.
create or replace function public.ticket_batches_numeracao()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare _cap int;
begin
  if coalesce(new.quantity_total, 0) <= 0 then return null; end if;
  if tg_op = 'UPDATE' and new.quantity_total <= coalesce(old.quantity_total, 0) then return null; end if;
  select coalesce(sum(fim - inicio + 1), 0) into _cap from lote_faixas where batch_id = new.id;
  if new.quantity_total > _cap then
    perform public.lote_alocar_faixa(new.id, new.quantity_total - _cap);
  end if;
  return null;
end;
$$;
create trigger ticket_batches_numeracao
  after insert or update of quantity_total on public.ticket_batches
  for each row execute function public.ticket_batches_numeracao();

-- Ingresso novo: menor número livre da faixa do lote (ou um a mais no fim).
create or replace function public.tickets_numero()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare _ev uuid; _n int;
begin
  if new.numero is not null then return new; end if;
  if not exists (select 1 from lote_faixas where batch_id = new.batch_id) then return new; end if;
  _ev := public.lote_evento(new.batch_id);
  perform pg_advisory_xact_lock(hashtextextended('numeracao:' || _ev::text, 0));
  select g.n into _n
    from lote_faixas f cross join lateral generate_series(f.inicio, f.fim) as g(n)
   where f.batch_id = new.batch_id
     and not exists (select 1 from tickets t where t.batch_id = new.batch_id and t.numero = g.n)
   order by g.n limit 1;
  if _n is null then
    perform public.lote_alocar_faixa(new.batch_id, 1);
    select max(fim) into _n from lote_faixas where batch_id = new.batch_id;
  end if;
  new.numero := _n;
  return new;
end;
$$;
create trigger tickets_numero
  before insert on public.tickets
  for each row execute function public.tickets_numero();

-- ------------------------------------------------------------------
-- (migração "numeracao_nas_funcoes", mesma data)
-- pdv_api.vender_ingresso e vender_ingresso_portaria passam a devolver
-- 'numeros' (um por ingresso, na ordem dos tokens) para imprimir no ticket;
-- validate_ticket devolve 'numero'. Alterados por substituição de texto
-- dentro de pg_get_functiondef (as funções completas vivem só no banco).
-- wa_resumo_ingressos: esconde lote oculto e encerrado; mostra pontos de venda
-- e se o lote já está liberado.
--
-- Lotes do 4º Fest Vale cadastrados neste dia:
--   1º lote   0001–1600  R$ 25  físico (Maçonaria)          — emitidos
--   2º lote   1601–2200  R$ 40  físico (pontos de venda)     — emitidos, em breve no site
--   3º lote   2201–2600  R$ 45  site                         — em breve
--   4º lote   2601–3000  R$ 50  portaria (a partir de 08/05/2027)
--   Cortesia  3001–3300  —      físico, fora do site          — emitidos
