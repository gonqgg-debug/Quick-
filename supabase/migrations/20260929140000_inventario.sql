/* Existencias por tienda y libro de movimientos.
   El costo y el stock no viven en products: cada tienda tiene su fila. */

create table if not exists public.inventario_existencias (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.products (id) on delete cascade,
  tienda text not null default 'quick',
  cantidad numeric(14,3) not null default 0,
  costo_promedio numeric(14,4),
  ultimo_costo numeric(14,4),
  punto_reorden numeric(14,3) not null default 0,
  updated_at timestamptz not null default now(),
  constraint inventario_existencias_tienda_check check (char_length(btrim(tienda)) >= 1),
  constraint inventario_existencias_punto_check check (punto_reorden >= 0)
);

create unique index if not exists idx_inventario_existencias_producto_tienda
  on public.inventario_existencias (producto_id, tienda);

create index if not exists idx_inventario_existencias_tienda
  on public.inventario_existencias (tienda, cantidad);

create table if not exists public.inventario_movimientos (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.products (id) on delete restrict,
  tienda text not null,
  tipo text not null,
  cantidad numeric(14,3) not null,
  costo_unitario numeric(14,4),
  stock_antes numeric(14,3) not null,
  stock_despues numeric(14,3) not null,
  costo_promedio_despues numeric(14,4),
  factura_id uuid references public.facturas (id) on delete restrict,
  factura_linea_id uuid references public.factura_lineas (id) on delete restrict,
  compra_id uuid references public.compras (id) on delete set null,
  origen text not null,
  nota text,
  created_at timestamptz not null default now(),
  constraint inventario_movimientos_tipo_check check (
    tipo in ('recepcion', 'venta', 'ajuste', 'merma', 'conteo', 'devolucion_proveedor')
  ),
  constraint inventario_movimientos_origen_check check (origen in ('agente', 'admin', 'pos')),
  constraint inventario_movimientos_cantidad_check check (cantidad <> 0 or tipo = 'conteo'),
  constraint inventario_movimientos_tienda_check check (char_length(btrim(tienda)) >= 1)
);

create unique index if not exists idx_inventario_movimientos_recepcion_linea
  on public.inventario_movimientos (factura_linea_id)
  where tipo = 'recepcion' and factura_linea_id is not null;

create index if not exists idx_inventario_movimientos_tienda_fecha
  on public.inventario_movimientos (tienda, created_at desc);

create index if not exists idx_inventario_movimientos_producto
  on public.inventario_movimientos (producto_id, created_at desc);

create index if not exists idx_inventario_movimientos_factura
  on public.inventario_movimientos (factura_id)
  where factura_id is not null;

alter table public.facturas
  add column if not exists compra_id uuid references public.compras (id) on delete set null,
  add column if not exists inventario_estado text not null default 'pendiente',
  add column if not exists inventario_aplicado_en timestamptz;

alter table public.facturas drop constraint if exists facturas_inventario_estado_check;
alter table public.facturas
  add constraint facturas_inventario_estado_check
  check (inventario_estado in ('pendiente', 'parcial', 'aplicada'));

create index if not exists idx_facturas_compra
  on public.facturas (compra_id)
  where compra_id is not null;

alter table public.compras
  add column if not exists factura_id uuid references public.facturas (id) on delete set null;

create unique index if not exists idx_compras_factura
  on public.compras (factura_id)
  where factura_id is not null;

alter table public.inventario_existencias enable row level security;
alter table public.inventario_existencias force row level security;
alter table public.inventario_movimientos enable row level security;
alter table public.inventario_movimientos force row level security;

revoke all on table public.inventario_existencias from anon, authenticated, public;
revoke all on table public.inventario_movimientos from anon, authenticated, public;
grant all on table public.inventario_existencias to service_role;
grant all on table public.inventario_movimientos to service_role;

drop policy if exists "service_role_inventario_existencias_all" on public.inventario_existencias;
create policy "service_role_inventario_existencias_all"
  on public.inventario_existencias
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "service_role_inventario_movimientos_all" on public.inventario_movimientos;
create policy "service_role_inventario_movimientos_all"
  on public.inventario_movimientos
  for all
  to service_role
  using (true)
  with check (true);
