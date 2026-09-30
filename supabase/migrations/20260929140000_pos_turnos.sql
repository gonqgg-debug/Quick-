-- Turno de caja en el mostrador. Es independiente de caja_turnos (cuadre AM/PM).
-- client_id lo genera la caja: reabrir o reintentar el mismo turno no lo duplica.

alter table public.ventas_pos
  add column if not exists turno_client_id uuid;

create index if not exists idx_ventas_pos_turno_client
  on public.ventas_pos (turno_client_id);

create table if not exists public.pos_turnos (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  abierto_en timestamptz not null default now(),
  cerrado_en timestamptz,
  fondo_inicial numeric(12, 2) not null default 0,
  efectivo_contado numeric(12, 2),
  efectivo_esperado numeric(12, 2),
  diferencia numeric(12, 2),
  total_efectivo numeric(12, 2) not null default 0,
  total_tarjeta numeric(12, 2) not null default 0,
  total_transferencia numeric(12, 2) not null default 0,
  ventas_count integer not null default 0,
  estado text not null default 'abierto',
  abierto_por text not null,
  notas text,
  created_at timestamptz not null default now(),
  constraint pos_turnos_client_id_key unique (client_id),
  constraint pos_turnos_estado_check check (estado in ('abierto', 'cerrado')),
  constraint pos_turnos_fondo_check check (fondo_inicial >= 0),
  constraint pos_turnos_abierto_por_check check (char_length(btrim(abierto_por)) > 0)
);

create index if not exists idx_pos_turnos_abierto_en
  on public.pos_turnos (abierto_en desc);

comment on table public.pos_turnos is
  'Apertura y cierre de turno del personal en la caja. Una fila por dispositivo y turno.';

revoke all on table public.pos_turnos from anon, authenticated, public;
grant all on table public.pos_turnos to service_role;

alter table public.pos_turnos enable row level security;
alter table public.pos_turnos force row level security;

drop policy if exists "service_role_pos_turnos_all" on public.pos_turnos;
create policy "service_role_pos_turnos_all"
  on public.pos_turnos
  for all
  to service_role
  using (true)
  with check (true);

create or replace function public.abrir_turno_pos(
  p_client_id uuid,
  p_abierto_en timestamptz,
  p_fondo_inicial numeric,
  p_abierto_por text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.pos_turnos%rowtype;
  v_nombre text;
  v_fondo numeric(12, 2);
  v_abierto timestamptz;
begin
  if p_client_id is null then
    raise exception 'Falta el identificador del turno';
  end if;

  select * into v_existing
  from public.pos_turnos
  where client_id = p_client_id;
  if found then
    return jsonb_build_object(
      'id', v_existing.id,
      'client_id', v_existing.client_id,
      'estado', v_existing.estado,
      'abierto_por', v_existing.abierto_por,
      'fondo_inicial', v_existing.fondo_inicial,
      'already_synced', true
    );
  end if;

  v_nombre := left(btrim(coalesce(p_abierto_por, '')), 80);
  if v_nombre = '' then
    raise exception 'Indica quién abre el turno';
  end if;
  if p_fondo_inicial is null or p_fondo_inicial < 0 or p_fondo_inicial > 1000000 then
    raise exception 'Fondo inicial inválido';
  end if;
  v_fondo := round(p_fondo_inicial, 2);
  v_abierto := coalesce(p_abierto_en, now());
  if v_abierto > now() + interval '1 day' or v_abierto < now() - interval '30 days' then
    v_abierto := now();
  end if;

  begin
    insert into public.pos_turnos (client_id, abierto_en, fondo_inicial, abierto_por, estado)
    values (p_client_id, v_abierto, v_fondo, v_nombre, 'abierto')
    returning * into v_existing;
  exception
    when unique_violation then
      select * into v_existing
      from public.pos_turnos
      where client_id = p_client_id;
      return jsonb_build_object(
        'id', v_existing.id,
        'client_id', v_existing.client_id,
        'estado', v_existing.estado,
        'abierto_por', v_existing.abierto_por,
        'fondo_inicial', v_existing.fondo_inicial,
        'already_synced', true
      );
  end;

  return jsonb_build_object(
    'id', v_existing.id,
    'client_id', v_existing.client_id,
    'estado', v_existing.estado,
    'abierto_por', v_existing.abierto_por,
    'fondo_inicial', v_existing.fondo_inicial,
    'already_synced', false
  );
end;
$$;

create or replace function public.cerrar_turno_pos(
  p_client_id uuid,
  p_cerrado_en timestamptz,
  p_efectivo_contado numeric,
  p_notas text,
  p_ventas_count integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_turno public.pos_turnos%rowtype;
  v_count integer;
  v_efectivo numeric(12, 2);
  v_tarjeta numeric(12, 2);
  v_transferencia numeric(12, 2);
  v_esperado numeric(12, 2);
  v_contado numeric(12, 2);
  v_diferencia numeric(12, 2);
  v_cerrado timestamptz;
begin
  if p_client_id is null then
    raise exception 'Falta el identificador del turno';
  end if;
  if p_efectivo_contado is null or p_efectivo_contado < 0 or p_efectivo_contado > 1000000 then
    raise exception 'Indica el efectivo contado';
  end if;
  if p_ventas_count is null or p_ventas_count < 0 then
    raise exception 'Conteo de ventas inválido';
  end if;

  select * into v_turno
  from public.pos_turnos
  where client_id = p_client_id
  for update;
  if not found then
    raise exception 'Turno no encontrado';
  end if;

  select
    count(*)::integer,
    coalesce(sum(total) filter (where metodo_pago = 'efectivo'), 0),
    coalesce(sum(total) filter (where metodo_pago = 'tarjeta'), 0),
    coalesce(sum(total) filter (where metodo_pago = 'transferencia'), 0)
  into v_count, v_efectivo, v_tarjeta, v_transferencia
  from public.ventas_pos
  where turno_client_id = p_client_id;

  if v_count < p_ventas_count then
    raise exception 'Faltan ventas por sincronizar';
  end if;

  v_esperado := round(v_turno.fondo_inicial + v_efectivo, 2);
  v_contado := round(p_efectivo_contado, 2);
  v_diferencia := round(v_contado - v_esperado, 2);
  v_cerrado := coalesce(p_cerrado_en, now());
  if v_cerrado > now() + interval '1 day' or v_cerrado < v_turno.abierto_en - interval '1 day' then
    v_cerrado := now();
  end if;

  update public.pos_turnos
  set
    cerrado_en = v_cerrado,
    efectivo_contado = v_contado,
    efectivo_esperado = v_esperado,
    diferencia = v_diferencia,
    total_efectivo = round(v_efectivo, 2),
    total_tarjeta = round(v_tarjeta, 2),
    total_transferencia = round(v_transferencia, 2),
    ventas_count = v_count,
    estado = 'cerrado',
    notas = nullif(left(btrim(coalesce(p_notas, '')), 500), '')
  where id = v_turno.id
  returning * into v_turno;

  return jsonb_build_object(
    'id', v_turno.id,
    'client_id', v_turno.client_id,
    'estado', v_turno.estado,
    'efectivo_esperado', v_turno.efectivo_esperado,
    'efectivo_contado', v_turno.efectivo_contado,
    'diferencia', v_turno.diferencia,
    'ventas_count', v_turno.ventas_count,
    'total_efectivo', v_turno.total_efectivo,
    'total_tarjeta', v_turno.total_tarjeta,
    'total_transferencia', v_turno.total_transferencia
  );
end;
$$;

revoke all on function public.abrir_turno_pos(uuid, timestamptz, numeric, text)
  from public, anon, authenticated;
grant execute on function public.abrir_turno_pos(uuid, timestamptz, numeric, text)
  to service_role;

revoke all on function public.cerrar_turno_pos(uuid, timestamptz, numeric, text, integer)
  from public, anon, authenticated;
grant execute on function public.cerrar_turno_pos(uuid, timestamptz, numeric, text, integer)
  to service_role;
