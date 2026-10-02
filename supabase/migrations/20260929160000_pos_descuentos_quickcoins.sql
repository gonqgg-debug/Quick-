-- Descuentos del ticket y QuickCoins. No cambia la firma de registrar_venta_pos.

alter table public.ventas_pos
  add column if not exists descuento_total numeric(12, 2) not null default 0;

alter table public.ventas_pos_items
  add column if not exists precio_lista numeric(12, 2);

alter table public.ventas_pos_items
  add column if not exists descuento numeric(12, 2) not null default 0;

create table if not exists public.quickcoins_reglas (
  id integer primary key default 1,
  pesos_por_coin numeric(12, 2) not null default 10,
  valor_coin numeric(12, 2) not null default 1,
  minimo_canje integer not null default 50,
  constraint quickcoins_reglas_singleton check (id = 1),
  constraint quickcoins_reglas_pesos_check check (pesos_por_coin > 0),
  constraint quickcoins_reglas_valor_check check (valor_coin > 0),
  constraint quickcoins_reglas_minimo_check check (minimo_canje >= 0)
);

insert into public.quickcoins_reglas (id)
values (1)
on conflict (id) do nothing;

create table if not exists public.quickcoins_movimientos (
  id uuid primary key default gen_random_uuid(),
  venta_client_id uuid not null,
  tipo text not null,
  customer_id uuid not null references public.customers (id),
  telefono text not null,
  puntos integer not null,
  created_at timestamptz not null default now(),
  constraint quickcoins_movimientos_tipo_check check (tipo in ('ganar', 'canjear', 'ajuste')),
  constraint quickcoins_movimientos_puntos_check check (puntos > 0),
  constraint quickcoins_movimientos_venta_tipo_key unique (venta_client_id, tipo)
);

create index if not exists idx_quickcoins_movimientos_customer
  on public.quickcoins_movimientos (customer_id, created_at desc);

comment on table public.quickcoins_movimientos is
  'Libro de QuickCoins. El par venta_client_id + tipo hace idempotente el reintento de la caja.';

revoke all on table public.quickcoins_reglas from anon, authenticated, public;
revoke all on table public.quickcoins_movimientos from anon, authenticated, public;
grant all on table public.quickcoins_reglas to service_role;
grant all on table public.quickcoins_movimientos to service_role;

alter table public.quickcoins_reglas enable row level security;
alter table public.quickcoins_movimientos enable row level security;
alter table public.quickcoins_reglas force row level security;
alter table public.quickcoins_movimientos force row level security;

drop policy if exists "service_role_quickcoins_reglas_all" on public.quickcoins_reglas;
create policy "service_role_quickcoins_reglas_all"
  on public.quickcoins_reglas
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "service_role_quickcoins_movimientos_all" on public.quickcoins_movimientos;
create policy "service_role_quickcoins_movimientos_all"
  on public.quickcoins_movimientos
  for all
  to service_role
  using (true)
  with check (true);

create or replace function public.aplicar_quickcoins(
  p_venta_client_id uuid,
  p_telefono text,
  p_nombre text,
  p_canje integer,
  p_ganar integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_customer_id uuid;
  v_nombre text;
  v_apellido text;
  v_saldo integer;
  v_minimo integer;
  v_ya_canje boolean;
  v_ya_gana boolean;
begin
  if p_venta_client_id is null then
    raise exception 'Falta el identificador de la venta';
  end if;
  v_phone := regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g');
  if char_length(v_phone) < 10 or char_length(v_phone) > 15 then
    raise exception 'Teléfono de QuickCoins inválido';
  end if;
  if p_canje is null or p_canje < 0 or p_ganar is null or p_ganar < 0 then
    raise exception 'QuickCoins inválidos';
  end if;

  select minimo_canje into v_minimo from public.quickcoins_reglas where id = 1;
  v_minimo := coalesce(v_minimo, 50);
  if p_canje > 0 and p_canje < v_minimo then
    raise exception 'El mínimo para canjear es % QuickCoins', v_minimo;
  end if;

  select id into v_customer_id
  from public.customers
  where phone_number = v_phone
  for update;
  if not found then
    v_nombre := left(btrim(coalesce(nullif(p_nombre, ''), 'Cliente')), 80);
    v_apellido := '-';
    insert into public.customers (phone_number, nombre, apellido)
    values (v_phone, v_nombre, v_apellido)
    on conflict (phone_number) do nothing;
    select id into v_customer_id
    from public.customers
    where phone_number = v_phone
    for update;
  end if;

  select coalesce(sum(case when tipo = 'canjear' then -puntos else puntos end), 0)::integer
    into v_saldo
  from public.quickcoins_movimientos
  where customer_id = v_customer_id;

  select exists (
    select 1 from public.quickcoins_movimientos
    where venta_client_id = p_venta_client_id and tipo = 'canjear'
  ) into v_ya_canje;
  select exists (
    select 1 from public.quickcoins_movimientos
    where venta_client_id = p_venta_client_id and tipo = 'ganar'
  ) into v_ya_gana;

  if p_canje > 0 and not v_ya_canje then
    if v_saldo < p_canje then
      raise exception 'Saldo QuickCoins insuficiente';
    end if;
    insert into public.quickcoins_movimientos (venta_client_id, tipo, customer_id, telefono, puntos)
    values (p_venta_client_id, 'canjear', v_customer_id, v_phone, p_canje);
    v_saldo := v_saldo - p_canje;
  end if;

  if p_ganar > 0 and not v_ya_gana then
    insert into public.quickcoins_movimientos (venta_client_id, tipo, customer_id, telefono, puntos)
    values (p_venta_client_id, 'ganar', v_customer_id, v_phone, p_ganar);
    v_saldo := v_saldo + p_ganar;
  end if;

  return jsonb_build_object(
    'customer_id', v_customer_id,
    'telefono', v_phone,
    'saldo', v_saldo,
    'already_synced', v_ya_canje or v_ya_gana
  );
end;
$$;

create or replace function public.registrar_venta_pos_y_coins(
  p_client_id uuid,
  p_fecha timestamptz,
  p_metodo_pago text,
  p_monto_recibido numeric,
  p_creado_por text,
  p_items jsonb,
  p_telefono text,
  p_nombre text,
  p_canje integer,
  p_ganar integer,
  p_descuento_total numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venta jsonb;
  v_venta_id uuid;
  v_item jsonb;
  v_coins jsonb;
begin
  if coalesce(p_canje, 0) > 0 then
    v_coins := public.aplicar_quickcoins(p_client_id, p_telefono, p_nombre, p_canje, 0);
  end if;

  v_venta := public.registrar_venta_pos(
    p_client_id,
    p_fecha,
    p_metodo_pago,
    p_monto_recibido,
    p_creado_por,
    p_items
  );
  v_venta_id := (v_venta->>'id')::uuid;

  update public.ventas_pos
  set descuento_total = round(coalesce(p_descuento_total, 0), 2)
  where id = v_venta_id;

  for v_item in select value from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    update public.ventas_pos_items
    set
      descuento = round(coalesce((v_item->>'descuento')::numeric, 0), 2),
      precio_lista = round((v_item->>'precio_lista')::numeric, 2)
    where venta_id = v_venta_id
      and producto_id = (v_item->>'producto_id')::uuid;
  end loop;

  if coalesce(p_ganar, 0) > 0 then
    v_coins := public.aplicar_quickcoins(p_client_id, p_telefono, p_nombre, 0, p_ganar);
  end if;

  return v_venta || jsonb_build_object('quickcoins', coalesce(v_coins, '{}'::jsonb));
end;
$$;

revoke all on function public.aplicar_quickcoins(uuid, text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.aplicar_quickcoins(uuid, text, text, integer, integer)
  to service_role;

revoke all on function public.registrar_venta_pos_y_coins(uuid, timestamptz, text, numeric, text, jsonb, text, text, integer, integer, numeric)
  from public, anon, authenticated;
grant execute on function public.registrar_venta_pos_y_coins(uuid, timestamptz, text, numeric, text, jsonb, text, text, integer, integer, numeric)
  to service_role;
