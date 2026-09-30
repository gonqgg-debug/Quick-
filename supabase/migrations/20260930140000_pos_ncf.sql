-- Datos del negocio y secuencia de NCF para el recibo de mostrador.
-- No inventa un RNC ni un rango: la secuencia queda vacía hasta que se cargue la autorizada por DGII.

create table if not exists public.pos_negocio (
  id text primary key default 'quick',
  nombre_comercial text not null,
  razon_social text not null,
  rnc text,
  direccion text not null,
  telefono text,
  ncf_tipo text,
  ncf_siguiente bigint,
  ncf_hasta bigint,
  ncf_vence date,
  constraint pos_negocio_id_check check (id = 'quick'),
  constraint pos_negocio_rnc_check check (rnc is null or rnc ~ '^[0-9]{9}$' or rnc ~ '^[0-9]{11}$'),
  constraint pos_negocio_ncf_check check (
    (
      ncf_tipo is null
      and ncf_siguiente is null
      and ncf_hasta is null
      and ncf_vence is null
    )
    or (
      ncf_tipo in ('B02', 'E32')
      and ncf_siguiente >= 1
      and ncf_hasta >= 1
      and ncf_siguiente <= ncf_hasta + 1
      and ncf_vence is not null
    )
  )
);

insert into public.pos_negocio (id, nombre_comercial, razon_social, direccion, telefono)
values (
  'quick',
  'QUICK!',
  'Quick! Mini Market',
  'Residencial Jardines 3, Pueblo Bávaro, La Altagracia',
  '809-226-4986'
)
on conflict (id) do nothing;

alter table public.ventas_pos
  add column if not exists ncf text;

create unique index if not exists ventas_pos_ncf_key
  on public.ventas_pos (ncf)
  where ncf is not null;

comment on table public.pos_negocio is
  'Ficha fiscal del mostrador. El NCF solo se emite cuando hay tipo, rango y vencimiento.';

revoke all on table public.pos_negocio from anon, authenticated, public;
grant all on table public.pos_negocio to service_role;

alter table public.pos_negocio enable row level security;
alter table public.pos_negocio force row level security;

drop policy if exists "service_role_pos_negocio_all" on public.pos_negocio;
create policy "service_role_pos_negocio_all"
  on public.pos_negocio
  for all
  to service_role
  using (true)
  with check (true);

create or replace function public.asignar_ncf_venta(p_client_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venta_id uuid;
  v_existente text;
  v_tipo text;
  v_siguiente bigint;
  v_hasta bigint;
  v_vence date;
  v_ancho integer;
  v_ncf text;
begin
  if p_client_id is null then
    return null;
  end if;

  select id, ncf
    into v_venta_id, v_existente
  from public.ventas_pos
  where client_id = p_client_id
  for update;

  if v_venta_id is null then
    return null;
  end if;
  if v_existente is not null then
    return v_existente;
  end if;

  select ncf_tipo, ncf_siguiente, ncf_hasta, ncf_vence
    into v_tipo, v_siguiente, v_hasta, v_vence
  from public.pos_negocio
  where id = 'quick'
  for update;

  if v_tipo is null or v_siguiente is null or v_hasta is null or v_vence is null then
    return null;
  end if;
  if v_siguiente > v_hasta or v_vence < (timezone('America/Santo_Domingo', now()))::date then
    return null;
  end if;

  v_ancho := case when v_tipo like 'E%' then 10 else 8 end;
  if v_siguiente > (power(10, v_ancho) - 1)::bigint then
    return null;
  end if;

  v_ncf := v_tipo || lpad(v_siguiente::text, v_ancho, '0');
  if v_tipo like 'E%' then
    if v_ncf !~ '^E[0-9]{12}$' then
      return null;
    end if;
  elsif v_ncf !~ '^[A-Z][0-9]{10}$' then
    return null;
  end if;

  update public.pos_negocio
    set ncf_siguiente = v_siguiente + 1
  where id = 'quick';

  update public.ventas_pos
    set ncf = v_ncf
  where id = v_venta_id
    and ncf is null;

  if not found then
    raise exception 'No se pudo guardar el NCF';
  end if;

  return v_ncf;
end;
$$;

revoke all on function public.asignar_ncf_venta(uuid) from public, anon, authenticated;
grant execute on function public.asignar_ncf_venta(uuid) to service_role;
