-- Punto de venta de mostrador.
-- stock NULL = el producto no controla existencias.
-- client_id es el UUID generado en la caja: un reintento no duplica la venta.

alter table public.products
  add column if not exists stock integer;

comment on column public.products.stock is
  'Existencia en tienda. NULL = sin control de inventario. Puede quedar negativo si dos cajas venden offline.';

create table public.ventas_pos (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  fecha timestamptz not null default now(),
  total numeric(12, 2) not null,
  metodo_pago text not null,
  monto_recibido numeric(12, 2),
  cambio numeric(12, 2),
  creado_por text,
  stock_advertencia boolean not null default false,
  stock_detalle jsonb,
  created_at timestamptz not null default now(),
  constraint ventas_pos_client_id_key unique (client_id),
  constraint ventas_pos_metodo_pago_check
    check (metodo_pago in ('efectivo', 'tarjeta', 'transferencia')),
  constraint ventas_pos_total_check check (total >= 0),
  constraint ventas_pos_efectivo_check check (
    (metodo_pago = 'efectivo' and monto_recibido is not null and cambio is not null)
    or (metodo_pago <> 'efectivo' and monto_recibido is null and cambio is null)
  )
);

create table public.ventas_pos_items (
  id uuid primary key default gen_random_uuid(),
  venta_id uuid not null references public.ventas_pos (id) on delete cascade,
  producto_id uuid references public.products (id) on delete restrict,
  nombre text not null,
  cantidad integer not null,
  precio_unitario numeric(12, 2) not null,
  constraint ventas_pos_items_cantidad_check check (cantidad > 0),
  constraint ventas_pos_items_precio_check check (precio_unitario >= 0)
);

create index idx_ventas_pos_fecha on public.ventas_pos (fecha desc);
create index idx_ventas_pos_stock_advertencia
  on public.ventas_pos (fecha desc)
  where stock_advertencia;
create index idx_ventas_pos_items_venta on public.ventas_pos_items (venta_id);
create index idx_ventas_pos_items_producto on public.ventas_pos_items (producto_id);

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

create or replace function public.registrar_venta_pos(
  p_client_id uuid,
  p_fecha timestamptz,
  p_metodo_pago text,
  p_monto_recibido numeric,
  p_creado_por text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.ventas_pos%rowtype;
  v_venta_id uuid;
  v_total numeric(12, 2) := 0;
  v_cambio numeric(12, 2);
  v_fecha timestamptz;
  v_item jsonb;
  v_producto_id uuid;
  v_cantidad integer;
  v_precio numeric(12, 2);
  v_client_nombre text;
  v_db_nombre text;
  v_nombre text;
  v_stock integer;
  v_stock_before integer;
  v_found boolean;
  v_warnings jsonb := '[]'::jsonb;
  v_recibido numeric(12, 2);
begin
  if p_client_id is null then
    raise exception 'Falta el identificador de la venta';
  end if;
  if p_metodo_pago not in ('efectivo', 'tarjeta', 'transferencia') then
    raise exception 'Método de pago inválido';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta no tiene productos';
  end if;
  if jsonb_array_length(p_items) > 200 then
    raise exception 'Demasiados productos en la venta';
  end if;

  select * into v_existing
  from public.ventas_pos
  where client_id = p_client_id;
  if found then
    return jsonb_build_object(
      'id', v_existing.id,
      'client_id', v_existing.client_id,
      'total', v_existing.total,
      'cambio', v_existing.cambio,
      'metodo_pago', v_existing.metodo_pago,
      'monto_recibido', v_existing.monto_recibido,
      'stock_advertencia', v_existing.stock_advertencia,
      'already_synced', true
    );
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    begin
      v_producto_id := (v_item->>'producto_id')::uuid;
    exception
      when invalid_text_representation then
        raise exception 'Producto inválido';
    end;
    v_cantidad := (v_item->>'cantidad')::integer;
    v_precio := round((v_item->>'precio_unitario')::numeric, 2);
    if v_cantidad is null or v_cantidad <= 0 or v_cantidad > 9999 then
      raise exception 'Cantidad inválida';
    end if;
    if v_precio is null or v_precio < 0 or v_precio > 1000000 then
      raise exception 'Precio inválido';
    end if;
    v_total := round(v_total + round(v_precio * v_cantidad, 2), 2);
  end loop;

  v_fecha := coalesce(p_fecha, now());
  if v_fecha > now() + interval '1 day' or v_fecha < now() - interval '30 days' then
    v_fecha := now();
  end if;

  if p_metodo_pago = 'efectivo' then
    if p_monto_recibido is null or p_monto_recibido + 0.001 < v_total then
      raise exception 'El monto recibido no cubre el total';
    end if;
    v_recibido := round(p_monto_recibido, 2);
    v_cambio := round(v_recibido - v_total, 2);
  else
    v_recibido := null;
    v_cambio := null;
  end if;

  begin
    insert into public.ventas_pos (
      client_id,
      fecha,
      total,
      metodo_pago,
      monto_recibido,
      cambio,
      creado_por
    )
    values (
      p_client_id,
      v_fecha,
      v_total,
      p_metodo_pago,
      v_recibido,
      v_cambio,
      nullif(left(btrim(coalesce(p_creado_por, '')), 120), '')
    )
    returning id into v_venta_id;
  exception
    when unique_violation then
      select * into v_existing
      from public.ventas_pos
      where client_id = p_client_id;
      return jsonb_build_object(
        'id', v_existing.id,
        'client_id', v_existing.client_id,
        'total', v_existing.total,
        'cambio', v_existing.cambio,
        'metodo_pago', v_existing.metodo_pago,
        'monto_recibido', v_existing.monto_recibido,
        'stock_advertencia', v_existing.stock_advertencia,
        'already_synced', true
      );
  end;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_producto_id := (v_item->>'producto_id')::uuid;
    v_cantidad := (v_item->>'cantidad')::integer;
    v_precio := round((v_item->>'precio_unitario')::numeric, 2);
    v_client_nombre := left(btrim(coalesce(v_item->>'nombre', '')), 200);

    select p.nombre, p.stock
      into v_db_nombre, v_stock_before
    from public.products p
    where p.id = v_producto_id
    for update;
    v_found := found;

    if not v_found then
      v_nombre := coalesce(nullif(v_client_nombre, ''), 'Producto');
      insert into public.ventas_pos_items (venta_id, producto_id, nombre, cantidad, precio_unitario)
      values (v_venta_id, null, v_nombre, v_cantidad, v_precio);
      v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
        'producto_id', v_producto_id,
        'nombre', v_nombre,
        'cantidad', v_cantidad,
        'motivo', 'producto_no_encontrado'
      ));
    else
      v_nombre := coalesce(nullif(v_db_nombre, ''), nullif(v_client_nombre, ''), 'Producto');
      insert into public.ventas_pos_items (venta_id, producto_id, nombre, cantidad, precio_unitario)
      values (v_venta_id, v_producto_id, v_nombre, v_cantidad, v_precio);

      if v_stock_before is not null then
        update public.products
           set stock = stock - v_cantidad
         where id = v_producto_id
        returning stock into v_stock;

        if v_stock_before < v_cantidad then
          v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
            'producto_id', v_producto_id,
            'nombre', v_nombre,
            'cantidad', v_cantidad,
            'stock_antes', v_stock_before,
            'stock_despues', v_stock,
            'motivo', 'stock_insuficiente'
          ));
        end if;
      end if;
    end if;
  end loop;

  if jsonb_array_length(v_warnings) > 0 then
    update public.ventas_pos
       set stock_advertencia = true,
           stock_detalle = v_warnings
     where id = v_venta_id;
  end if;

  return jsonb_build_object(
    'id', v_venta_id,
    'client_id', p_client_id,
    'total', v_total,
    'cambio', v_cambio,
    'metodo_pago', p_metodo_pago,
    'monto_recibido', v_recibido,
    'stock_advertencia', jsonb_array_length(v_warnings) > 0,
    'already_synced', false
  );
end;
$$;

revoke all on function public.registrar_venta_pos(uuid, timestamptz, text, numeric, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.registrar_venta_pos(uuid, timestamptz, text, numeric, text, jsonb)
  to service_role;
