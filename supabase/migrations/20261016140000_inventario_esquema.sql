-- Esquema de inventario. No se llena hasta el conteo inicial.
-- No importa stock.quant de Odoo.
-- inventario_movimientos ya puede existir como libro de stock (producto_id, stock y costo).
-- Esa tabla no se reemplaza. Aquí solo se crea inventario_conteos, y los movimientos si todavía no están.

create table if not exists public.inventario_conteos (
  id bigserial primary key,
  tienda text not null default 'quick',
  fecha date not null,
  product_id uuid not null references public.products (id),
  cantidad numeric(14, 3) not null,
  origen text not null,
  creado_en timestamptz not null default now(),
  unique (tienda, fecha, product_id)
);

revoke all on table public.inventario_conteos from anon, authenticated, public;
grant all on table public.inventario_conteos to service_role;
grant usage, select on sequence public.inventario_conteos_id_seq to service_role;

alter table public.inventario_conteos enable row level security;
alter table public.inventario_conteos force row level security;

drop policy if exists "service_role_inventario_conteos_all" on public.inventario_conteos;
create policy "service_role_inventario_conteos_all"
  on public.inventario_conteos
  for all
  to service_role
  using (true)
  with check (true);

do $$
begin
  if to_regclass('public.inventario_movimientos') is not null then
    return;
  end if;

  create table public.inventario_movimientos (
    id bigserial primary key,
    tienda text not null default 'quick',
    product_id uuid not null references public.products (id),
    fecha date not null,
    tipo text not null,
    cantidad_unidades numeric(14, 3) not null,
    ref_tabla text,
    ref_id text,
    creado_en timestamptz not null default now(),
    constraint inventario_movimientos_tipo_check check (tipo in ('conteo', 'compra', 'venta', 'ajuste', 'merma'))
  );

  create index idx_inventario_movimientos_producto
    on public.inventario_movimientos (tienda, product_id, fecha);

  revoke all on table public.inventario_movimientos from anon, authenticated, public;
  grant all on table public.inventario_movimientos to service_role;
  grant usage, select on sequence public.inventario_movimientos_id_seq to service_role;

  alter table public.inventario_movimientos enable row level security;
  alter table public.inventario_movimientos force row level security;

  create policy "service_role_inventario_movimientos_all"
    on public.inventario_movimientos
    for all
    to service_role
    using (true)
    with check (true);
end $$;
