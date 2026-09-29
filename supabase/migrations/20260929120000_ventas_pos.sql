-- Cobro en mostrador. El catálogo no tenía existencias: stock queda
-- nullable (NULL = todavía no hay conteo). Una venta puede dejarlo negativo
-- cuando dos cajas venden lo mismo sin verse; eso se marca en la venta.

alter table public.products
  add column if not exists stock integer;

comment on column public.products.stock is
  'Unidades contadas. NULL = sin conteo. Puede quedar negativo si dos cajas venden offline.';

create table public.ventas_pos (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  created_at timestamptz not null default now(),
  total numeric not null,
  metodo_pago text not null,
  monto_recibido numeric,
  cambio numeric,
  creado_por text,
  stock_advertencia boolean not null default false,
  stock_advertencia_detalle text,
  constraint ventas_pos_client_id_key unique (client_id),
  constraint ventas_pos_metodo_pago_check
    check (metodo_pago in ('efectivo', 'tarjeta', 'transferencia')),
  constraint ventas_pos_total_check check (total >= 0)
);

create table public.ventas_pos_items (
  id uuid primary key default gen_random_uuid(),
  venta_id uuid not null references public.ventas_pos (id) on delete cascade,
  producto_id uuid not null references public.products (id) on delete restrict,
  cantidad integer not null,
  precio_unitario numeric not null,
  constraint ventas_pos_items_cantidad_check check (cantidad > 0),
  constraint ventas_pos_items_precio_check check (precio_unitario >= 0)
);

create index idx_ventas_pos_created_at on public.ventas_pos (created_at desc);
create index idx_ventas_pos_stock_advertencia
  on public.ventas_pos (created_at desc)
  where stock_advertencia;
create index idx_ventas_pos_items_venta_id on public.ventas_pos_items (venta_id);

revoke all on table public.ventas_pos from anon, authenticated, public;
revoke all on table public.ventas_pos_items from anon, authenticated, public;
grant all on table public.ventas_pos to service_role;
grant all on table public.ventas_pos_items to service_role;

alter table public.ventas_pos enable row level security;
alter table public.ventas_pos_items enable row level security;
alter table public.ventas_pos force row level security;
alter table public.ventas_pos_items force row level security;

create policy "service_role_ventas_pos_all"
  on public.ventas_pos
  for all
  to service_role
  using (true)
  with check (true);

create policy "service_role_ventas_pos_items_all"
  on public.ventas_pos_items
  for all
  to service_role
  using (true)
  with check (true);

-- Una sola transacción: inserta la venta, descuenta stock y es idempotente
-- por client_id para que un reintento no duplique ni descuente dos veces.
create or replace function public.registrar_venta_pos(
  p_client_id uuid,
  p_metodo_pago text,
  p_monto_recibido numeric,
  p_creado_por text,
  p_items jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_existing public.ventas_pos%rowtype;
  v_item jsonb;
  v_producto_id uuid;
  v_cantidad integer;
  v_precio numeric;
  v_nombre text;
  v_stock integer;
  v_total numeric := 0;
  v_cambio numeric;
  v_monto numeric;
  v_venta_id uuid;
  v_warning boolean := false;
  v_detail text := '';
begin
  if p_client_id is null then
    raise exception 'client_id_requerido';
  end if;
  if p_metodo_pago not in ('efectivo', 'tarjeta', 'transferencia') then
    raise exception 'metodo_pago_invalido';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'items_requeridos';
  end if;
  if jsonb_array_length(p_items) > 200 then
    raise exception 'demasiados_items';
  end if;

  select * into v_existing
  from public.ventas_pos
  where client_id = p_client_id;
  if found then
    return jsonb_build_object(
      'id', v_existing.id,
      'clientId', v_existing.client_id,
      'total', v_existing.total,
      'cambio', v_existing.cambio,
      'stockAdvertencia', v_existing.stock_advertencia,
      'alreadySynced', true
    );
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_cantidad := (v_item->>'cantidad')::integer;
    v_precio := round((v_item->>'precio_unitario')::numeric, 2);
    if v_cantidad is null or v_cantidad <= 0 or v_cantidad > 999 then
      raise exception 'cantidad_invalida';
    end if;
    if v_precio is null or v_precio < 0 then
      raise exception 'precio_invalido';
    end if;
    v_total := round(v_total + round(v_cantidad * v_precio, 2), 2);
  end loop;

  if p_metodo_pago = 'efectivo' then
    v_monto := round(p_monto_recibido, 2);
    if v_monto is null or v_monto + 0.001 < v_total then
      raise exception 'monto_insuficiente';
    end if;
    v_cambio := round(v_monto - v_total, 2);
  else
    v_monto := null;
    v_cambio := null;
  end if;

  begin
    insert into public.ventas_pos (
      client_id,
      total,
      metodo_pago,
      monto_recibido,
      cambio,
      creado_por,
      stock_advertencia
    ) values (
      p_client_id,
      v_total,
      p_metodo_pago,
      v_monto,
      v_cambio,
      nullif(trim(coalesce(p_creado_por, '')), ''),
      false
    )
    returning id into v_venta_id;
  exception
    when unique_violation then
      select * into v_existing
      from public.ventas_pos
      where client_id = p_client_id;
      return jsonb_build_object(
        'id', v_existing.id,
        'clientId', v_existing.client_id,
        'total', v_existing.total,
        'cambio', v_existing.cambio,
        'stockAdvertencia', v_existing.stock_advertencia,
        'alreadySynced', true
      );
  end;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_producto_id := (v_item->>'producto_id')::uuid;
    v_cantidad := (v_item->>'cantidad')::integer;
    v_precio := round((v_item->>'precio_unitario')::numeric, 2);

    select nombre, stock
    into v_nombre, v_stock
    from public.products
    where id = v_producto_id
    for update;

    if not found then
      raise exception 'producto_no_existe';
    end if;

    insert into public.ventas_pos_items (venta_id, producto_id, cantidad, precio_unitario)
    values (v_venta_id, v_producto_id, v_cantidad, v_precio);

    if v_stock is not null then
      if v_stock < v_cantidad then
        v_warning := true;
        v_detail := v_detail || v_nombre || ': había ' || v_stock::text || ', se vendieron ' || v_cantidad::text || '. ';
      end if;
      update public.products
      set stock = stock - v_cantidad
      where id = v_producto_id;
    end if;
  end loop;

  if v_warning then
    update public.ventas_pos
    set stock_advertencia = true,
        stock_advertencia_detalle = nullif(trim(v_detail), '')
    where id = v_venta_id;
  end if;

  return jsonb_build_object(
    'id', v_venta_id,
    'clientId', p_client_id,
    'total', v_total,
    'cambio', v_cambio,
    'stockAdvertencia', v_warning,
    'alreadySynced', false
  );
end;
$$;

revoke all on function public.registrar_venta_pos(uuid, text, numeric, text, jsonb) from public, anon, authenticated;
grant execute on function public.registrar_venta_pos(uuid, text, numeric, text, jsonb) to service_role;
