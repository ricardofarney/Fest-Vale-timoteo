-- Lotes com canal de venda, lote "a definir" e ingresso físico numerado.
-- Aplicado direto no projeto dwynfydbtkwwppwblkbu em 20/10/2026 (em partes:
-- lotes_canal_colunas, lotes_canal_trava_site, lotes_canal_portaria_e_relatorio,
-- lotes_trava_site_datas).
--
-- canal:
--   todos    — site e portaria (comportamento de antes; padrão)
--   site     — só pelo site
--   portaria — só no PDV, no dia
--   fisico   — ingresso impresso, vendido fora do sistema (ex.: membros da Maçonaria).
--              O lote aparece travado no site, com o aviso e o botão do WhatsApp.
-- a_definir: valor/data ainda não decididos. Aparece como "Em breve" e não vende em lugar nenhum.

alter table public.ticket_batches
  add column if not exists canal text not null default 'todos',
  add column if not exists a_definir boolean not null default false,
  add column if not exists aviso text;

alter table public.ticket_batches drop constraint if exists ticket_batches_canal_check;
alter table public.ticket_batches
  add constraint ticket_batches_canal_check check (canal in ('todos','site','portaria','fisico'));

comment on column public.ticket_batches.canal is
  'todos | site | portaria | fisico. fisico = impresso e vendido fora do sistema; travado no site.';
comment on column public.ticket_batches.a_definir is
  'Valor ou data ainda não definidos: aparece como Em breve e não é vendido.';
comment on column public.ticket_batches.aviso is
  'Mensagem mostrada no site quando o lote não está à venda online.';

-- Número impresso no ingresso físico (0001…1600). Nulo nos ingressos do site/portaria.
alter table public.tickets add column if not exists numero integer;
create unique index if not exists tickets_lote_numero_uk
  on public.tickets (batch_id, numero) where numero is not null;

-- ------------------------------------------------------------------
-- Trava no servidor: pedido do site (ainda pendente) só aceita lote
-- vendido online, já definido, e pelo preço cadastrado.
create or replace function public.order_items_trava_lote()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _o orders%rowtype;
  _b ticket_batches%rowtype;
begin
  select * into _o from orders where id = new.order_id;
  -- Vendas de portaria e emissão física já nascem pagas, por funções do servidor.
  if _o.status is distinct from 'pending' then
    return new;
  end if;

  select * into _b from ticket_batches where id = new.batch_id;
  if not found then raise exception 'Lote não encontrado'; end if;

  if _b.a_definir then
    raise exception 'O lote % ainda não está à venda', _b.name;
  end if;
  if _b.canal not in ('todos','site') then
    raise exception '%', coalesce(nullif(_b.aviso, ''), 'Este lote não é vendido pelo site');
  end if;
  if (_b.starts_at is not null and _b.starts_at > now())
     or (_b.ends_at is not null and _b.ends_at <= now()) then
    raise exception 'O lote % não está à venda agora', _b.name;
  end if;
  if new.unit_price_cents is distinct from _b.price_cents then
    raise exception 'O preço do lote mudou. Atualize a página e tente de novo.';
  end if;
  return new;
end;
$$;

drop trigger if exists order_items_trava_lote on public.order_items;
create trigger order_items_trava_lote
  before insert or update on public.order_items
  for each row execute function public.order_items_trava_lote();

-- ------------------------------------------------------------------
-- PDV (maquininha): só lista lote de portaria/todos, já definido.
create or replace function public.pdv_lotes_ativos(_ev uuid)
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
  select coalesce(jsonb_agg(x.j order by x.ordem), '[]'::jsonb)
    from (
      select distinct on (t.id)
             t.sort_order as ordem,
             jsonb_build_object('batch_id', b.id, 'tipo', t.name, 'lote', b.name,
                                'preco', b.price_cents,
                                'restantes', case when b.quantity_total > 0
                                                  then b.quantity_total - b.quantity_sold end) as j
        from ticket_types t
        join ticket_batches b on b.ticket_type_id = t.id
       where t.event_id = _ev
         and b.canal in ('todos','portaria')
         and not b.a_definir
         and (b.starts_at is null or b.starts_at <= now())
         and (b.ends_at   is null or b.ends_at   >  now())
         and (b.quantity_total = 0 or b.quantity_sold < b.quantity_total)
       order by t.id, b.sort_order, b.created_at
    ) x;
$function$;

-- PDV web: recusa lote que não é de portaria
do $$
declare d text;
begin
  d := pg_get_functiondef('public.vender_ingresso_portaria'::regproc);
  if position('_batch.canal' in d) = 0 then
    d := replace(d,
      'select * into _tipo from ticket_types where id = _batch.ticket_type_id;',
      'select * into _tipo from ticket_types where id = _batch.ticket_type_id;
  if _batch.a_definir or _batch.canal not in (''todos'',''portaria'') then
    raise exception ''O lote % não é vendido na portaria'', _batch.name;
  end if;');
    if position('_batch.canal' in d) = 0 then raise exception 'vender_ingresso_portaria: trecho não encontrado'; end if;
    execute d;
  end if;
end $$;

-- ------------------------------------------------------------------
-- Atendimento por WhatsApp: a IA precisa saber canal, aviso e "a definir".
create or replace function public.wa_resumo_ingressos(_event_id uuid)
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
  select coalesce(jsonb_agg(x order by x->>'tipo', (x->>'ordem')::int), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'tipo', t.name,
      'lote', b.name,
      'ordem', b.sort_order,
      'preco', case when b.a_definir then 'a definir'
                    else to_char(b.price_cents / 100.0, 'FM999G999D00') end,
      'onde_comprar', case
          when b.a_definir then 'ainda não está à venda'
          when b.canal = 'fisico' then 'só ingresso físico, com os membros da Maçonaria (não vende no site)'
          when b.canal = 'portaria' then 'só na portaria, no dia do evento'
          when b.canal = 'site' then 'só pelo site'
          else 'site e portaria' end,
      'aviso', b.aviso,
      'esgotado', (b.canal <> 'fisico' and not b.a_definir
                   and b.quantity_total > 0 and b.quantity_sold >= b.quantity_total),
      'restam', case when b.canal <> 'fisico' and not b.a_definir and b.quantity_total > 0
                     then greatest(b.quantity_total - b.quantity_sold, 0) end
    ) as x
    from ticket_batches b
    join ticket_types t on t.id = b.ticket_type_id
    where t.event_id = _event_id
  ) s;
$function$;

-- ------------------------------------------------------------------
-- Relatório final: separa site, portaria e físico. O dinheiro do físico
-- é recebido pelos membros, fora do sistema, então não entra como receita.
do $$
declare d text; n int;
begin
  d := pg_get_functiondef('public.relatorio_final'::regproc);
  if position('fisico_emitidos' in d) > 0 then return; end if;

  n := (length(d) - length(replace(d, 'origem <> ''portaria''', ''))) / length('origem <> ''portaria''');
  if n <> 4 then raise exception 'relatorio_final: esperava 4 filtros de site, achei %', n; end if;
  d := replace(d, 'origem <> ''portaria''', 'origem = ''site''');

  d := replace(d,
    'sum(oi.qty) filter (where o.origem = ''portaria'')  as portaria,',
    'sum(oi.qty) filter (where o.origem = ''portaria'')  as portaria,
                   sum(oi.qty) filter (where o.origem = ''fisico'')    as fisico,');
  d := replace(d,
    'sum(oi.qty * oi.unit_price_cents)                   as receita',
    'sum(oi.qty * oi.unit_price_cents) filter (where o.origem <> ''fisico'') as receita');
  d := replace(d,
    '''portaria'', coalesce(x.portaria, 0),',
    '''portaria'', coalesce(x.portaria, 0), ''fisico'', coalesce(x.fisico, 0), ''canal'', b.canal,');
  d := replace(d,
    '''emitidos'',      (select',
    '''fisico_emitidos'', (select count(*) from tickets t join orders o on o.id = t.order_id
                         where o.event_id = _event_id and o.origem = ''fisico'' and t.status <> ''cancelled''),
      ''fisico_presentes'', (select count(*) from tickets t join orders o on o.id = t.order_id
                         where o.event_id = _event_id and o.origem = ''fisico'' and t.checked_in_at is not null),
      ''emitidos'',      (select');

  if position('as fisico' in d) = 0 or position('fisico_emitidos' in d) = 0
     or position('coalesce(x.fisico, 0)' in d) = 0
     or position('filter (where o.origem <> ''fisico'') as receita' in d) = 0 then
    raise exception 'relatorio_final: algum trecho não foi encontrado';
  end if;
  execute d;
end $$;
