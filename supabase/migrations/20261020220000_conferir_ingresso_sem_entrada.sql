-- Conferência de QR impresso SEM registrar entrada.
-- Aplicado direto no projeto dwynfydbtkwwppwblkbu em 20/10/2026.
--
-- Serve para testar os ingressos que saem da gráfica: lê o QR, diz número,
-- lote e situação, e anota o teste numa tabela à parte. O ingresso NÃO muda:
-- continua "válido" e entra normalmente no dia do evento.

create table if not exists public.ingressos_testes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id),
  ticket_id uuid references public.tickets(id),
  resultado text not null,
  lido_em timestamptz not null default now(),
  lido_por uuid default auth.uid()
);
create index if not exists ingressos_testes_ticket_idx on public.ingressos_testes (ticket_id);
alter table public.ingressos_testes enable row level security;
create policy "gestor le testes de ingresso" on public.ingressos_testes
  for select using (public.pode_gerenciar_evento(event_id));

create or replace function public.conferir_ingresso(_qr_token text, _event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _t tickets%rowtype;
  _o orders%rowtype;
  _b ticket_batches%rowtype;
  _tp ticket_types%rowtype;
  _antes int;
  _res text;
begin
  if not (public.is_event_organizer(_event_id) or public.is_event_staff(_event_id)) then
    raise exception 'Não autorizado a conferir ingressos deste evento';
  end if;

  select * into _t from tickets where qr_token = lower(btrim(_qr_token));
  if not found then
    insert into ingressos_testes (event_id, ticket_id, resultado) values (_event_id, null, 'nao_encontrado');
    return jsonb_build_object('status', 'invalido', 'message', 'QR não encontrado no sistema');
  end if;

  select * into _o from orders where id = _t.order_id;
  select * into _b from ticket_batches where id = _t.batch_id;
  select * into _tp from ticket_types where id = _b.ticket_type_id;
  select count(*) into _antes from ingressos_testes where ticket_id = _t.id;

  _res := case
    when _o.event_id <> _event_id then 'outro_evento'
    when _o.status <> 'paid' then 'nao_pago'
    when _t.status = 'cancelled' then 'cancelado'
    when _t.status = 'checked_in' then 'ja_usado'
    else 'valido' end;

  insert into ingressos_testes (event_id, ticket_id, resultado) values (_event_id, _t.id, _res);

  return jsonb_build_object(
    'status', _res,
    'numero', _t.numero,
    'lote', _b.name,
    'tipo', _tp.name,
    'checked_in_at', _t.checked_in_at,
    'testes_anteriores', _antes);
end;
$$;

-- A conferência do painel passa a dizer quantos de cada bloco já foram testados.
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
             'testados', x.testados,
             'integro', (x.n = c.quantidade and x.md5 = c.impressao_md5))
           order by c.primeiro)
      from ingressos_impressos_conferencia c
      cross join lateral (
        select count(*)::int n,
               count(*) filter (where t.status = 'cancelled')::int canc,
               count(*) filter (where t.status = 'checked_in')::int usados,
               count(*) filter (where exists (select 1 from ingressos_testes it where it.ticket_id = t.id))::int testados,
               md5(string_agg(t.qr_token, ',' order by t.numero)) md5
          from tickets t
         where t.batch_id = c.batch_id and t.numero between c.primeiro and c.ultimo) x
     where c.event_id = _event_id), '[]'::jsonb);
end;
$$;
