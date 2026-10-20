-- Blindagem dos ingressos numerados (impressos, cortesias e os que nascerem
-- com número no site e na portaria). Aplicado direto no projeto
-- dwynfydbtkwwppwblkbu em 20/10/2026.
--
-- Regra: um QR que já foi entregue ou impresso não pode deixar de entrar na
-- portaria por causa de uma alteração no sistema. O banco recusa:
--   * apagar ingresso numerado;
--   * trocar QR, número, lote ou pedido de ingresso numerado;
--   * mudar o evento de um pedido com ingresso numerado;
--   * tirar do "pago" um pedido de emissão física/cortesia;
--   * mudar o lote de tipo, ou o tipo de evento, quando já há ingresso;
--   * encolher ou apagar faixa de números com ingresso dentro.
-- Continua permitido: registrar entrada (check-in) e CANCELAR um ingresso
-- de propósito (status = 'cancelled'), que é o jeito certo de invalidar um
-- bloco perdido.

create or replace function public.blindagem_tickets()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  if tg_op = 'DELETE' then
    if old.numero is not null then
      raise exception 'Ingresso Nº % já foi emitido e não pode ser apagado. Para invalidar, cancele o ingresso.', old.numero;
    end if;
    return old;
  end if;
  if old.numero is not null and (
       new.qr_token is distinct from old.qr_token
    or new.numero   is distinct from old.numero
    or new.batch_id is distinct from old.batch_id
    or new.order_id is distinct from old.order_id) then
    raise exception 'Ingresso Nº %: QR, número, lote e pedido não podem ser alterados depois de emitidos.', old.numero;
  end if;
  return new;
end;
$$;
create trigger blindagem_tickets
  before update or delete on public.tickets
  for each row execute function public.blindagem_tickets();

create or replace function public.blindagem_orders()
returns trigger language plpgsql set search_path to 'public' as $$
declare _tem boolean;
begin
  select exists (select 1 from tickets t where t.order_id = old.id and t.numero is not null) into _tem;
  if not _tem then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'Este pedido tem ingressos emitidos e não pode ser apagado.';
  end if;
  if new.event_id is distinct from old.event_id then
    raise exception 'Este pedido tem ingressos emitidos e não pode mudar de evento.';
  end if;
  if old.origem in ('fisico','cortesia') and new.status is distinct from old.status then
    raise exception 'A emissão de ingressos impressos não pode mudar de situação. Para invalidar, cancele os ingressos.';
  end if;
  return new;
end;
$$;
create trigger blindagem_orders
  before update or delete on public.orders
  for each row execute function public.blindagem_orders();

create or replace function public.blindagem_ticket_batches()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  if exists (select 1 from tickets t where t.batch_id = old.id) then
    if tg_op = 'DELETE' then
      raise exception 'O lote % já tem ingressos emitidos e não pode ser apagado. Use "Encerrar".', old.name;
    end if;
    if new.ticket_type_id is distinct from old.ticket_type_id then
      raise exception 'O lote % já tem ingressos emitidos e não pode mudar de tipo.', old.name;
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
create trigger blindagem_ticket_batches
  before update or delete on public.ticket_batches
  for each row execute function public.blindagem_ticket_batches();

create or replace function public.blindagem_ticket_types()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  if exists (select 1 from ticket_batches b join tickets t on t.batch_id = b.id where b.ticket_type_id = old.id) then
    if tg_op = 'DELETE' then
      raise exception 'O tipo % já tem ingressos emitidos e não pode ser apagado.', old.name;
    end if;
    if new.event_id is distinct from old.event_id then
      raise exception 'O tipo % já tem ingressos emitidos e não pode mudar de evento.', old.name;
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
create trigger blindagem_ticket_types
  before update or delete on public.ticket_types
  for each row execute function public.blindagem_ticket_types();

create or replace function public.blindagem_lote_faixas()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  if exists (
    select 1 from tickets t
     where t.batch_id = old.batch_id and t.numero between old.inicio and old.fim
       and (tg_op = 'DELETE' or new.batch_id is distinct from old.batch_id
            or t.numero < new.inicio or t.numero > new.fim)) then
    raise exception 'A faixa %–% tem ingressos emitidos e não pode ser reduzida nem apagada.', old.inicio, old.fim;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
create trigger blindagem_lote_faixas
  before update or delete on public.lote_faixas
  for each row execute function public.blindagem_lote_faixas();

-- ------------------------------------------------------------------
-- Conferência: impressão digital de cada bloco impresso, gravada no dia da
-- geração dos arquivos. A função compara com o que está no banco agora.
create table if not exists public.ingressos_impressos_conferencia (
  batch_id uuid primary key references public.ticket_batches(id),
  event_id uuid not null references public.events(id),
  lote text not null,
  primeiro integer not null,
  ultimo integer not null,
  quantidade integer not null,
  impressao_md5 text not null,
  arquivo text,
  gerado_em timestamptz not null default now()
);
alter table public.ingressos_impressos_conferencia enable row level security;
create policy "gestor le conferencia" on public.ingressos_impressos_conferencia
  for select using (public.pode_gerenciar_evento(event_id));

create or replace function public.conferir_ingressos_impressos(_event_id uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.pode_gerenciar_evento(_event_id) then
    raise exception 'Sem permissão';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'lote', c.lote, 'primeiro', c.primeiro, 'ultimo', c.ultimo, 'arquivo', c.arquivo,
             'esperado', c.quantidade, 'no_banco', x.n, 'cancelados', x.canc, 'usados', x.usados,
             'integro', (x.n = c.quantidade and x.md5 = c.impressao_md5))
           order by c.primeiro)
      from ingressos_impressos_conferencia c
      cross join lateral (
        select count(*)::int n,
               count(*) filter (where t.status = 'cancelled')::int canc,
               count(*) filter (where t.status = 'checked_in')::int usados,
               md5(string_agg(t.qr_token, ',' order by t.numero)) md5
          from tickets t
         where t.batch_id = c.batch_id and t.numero between c.primeiro and c.ultimo) x
     where c.event_id = _event_id), '[]'::jsonb);
end;
$$;

-- Impressão digital dos blocos entregues (md5 dos códigos em ordem de número,
-- separados por vírgula), calculada a partir dos arquivos gerados:
--   1º lote   0001–1600  079f4b2fbcaaa1e045a5084cf2bd37c9
--   2º lote   1601–2200  77e710c3e390494b8cc03ef68ac80673
--   Cortesia  3001–3300  6b3153e950ef163f65b833a2d4158316
-- (gravada em ingressos_impressos_conferencia no mesmo dia)

-- ------------------------------------------------------------------
-- (migração "painel_vendidos_x_impressos", mesma data)
-- admin_visao_geral passou a separar:
--   ingresso.*            só pedidos de site e portaria (receita e pedidos de verdade)
--   ingressos.vendidos    site + portaria; ingressos.impressos (físico) e
--   ingressos.cortesias   à parte; emitidos = todos válidos; usados = entradas
--   lotes[]               canal, oculto, a_definir, emitidos, usados e faixas de número
--   bar                   sem as vendas de ingresso da portaria
--   impressos_conferencia resultado de conferir_ingressos_impressos()
