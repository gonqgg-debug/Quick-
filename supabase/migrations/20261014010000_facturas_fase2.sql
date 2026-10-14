-- Fase 2 de facturas: unidades por presentación en el catálogo, propuesta de producto con confianza,
-- alias aprendidos por proveedor y recepción por línea.

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

create table if not exists public.producto_presentaciones (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.products (id) on delete cascade,
  proveedor_id uuid references public.proveedores (id) on delete cascade,
  presentacion text not null,
  unidades numeric(12, 3) not null,
  confirmado_por text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint producto_presentaciones_presentacion_check check (presentacion in ('paquete', 'caja', 'fardo', 'otro')),
  constraint producto_presentaciones_unidades_check check (unidades > 0)
);

create unique index if not exists idx_producto_presentaciones_unica
  on public.producto_presentaciones (producto_id, coalesce(proveedor_id, '00000000-0000-0000-0000-000000000000'::uuid), presentacion);

create table if not exists public.catalogo_alias (
  id uuid primary key default gen_random_uuid(),
  proveedor_id uuid references public.proveedores (id) on delete cascade,
  descripcion_norm text not null,
  producto_id uuid not null references public.products (id) on delete cascade,
  confirmado_por text not null,
  veces integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalogo_alias_descripcion_check check (char_length(descripcion_norm) >= 2),
  constraint catalogo_alias_veces_check check (veces >= 1)
);

create unique index if not exists idx_catalogo_alias_unico
  on public.catalogo_alias (coalesce(proveedor_id, '00000000-0000-0000-0000-000000000000'::uuid), descripcion_norm);

alter table public.factura_lineas
  add column if not exists propuesta_producto_id uuid references public.products (id) on delete set null,
  add column if not exists propuesta_confianza integer,
  add column if not exists propuesta_origen text,
  add column if not exists recepcion text not null default 'pendiente',
  add column if not exists cantidad_recibida numeric(14, 3),
  add column if not exists recepcion_por text,
  add column if not exists recepcion_en timestamptz;

alter table public.factura_lineas drop constraint if exists factura_lineas_propuesta_check;
alter table public.factura_lineas
  add constraint factura_lineas_propuesta_check
  check (
    (propuesta_producto_id is null and propuesta_confianza is null and propuesta_origen is null)
    or (
      propuesta_producto_id is not null
      and propuesta_confianza between 0 and 100
      and propuesta_origen in ('alias', 'barras', 'odoo', 'texto')
    )
  );

alter table public.factura_lineas drop constraint if exists factura_lineas_recepcion_check;
alter table public.factura_lineas
  add constraint factura_lineas_recepcion_check
  check (recepcion in ('pendiente', 'completa', 'faltante', 'regalo'));

alter table public.factura_lineas drop constraint if exists factura_lineas_cantidad_recibida_check;
alter table public.factura_lineas
  add constraint factura_lineas_cantidad_recibida_check
  check (cantidad_recibida is null or cantidad_recibida >= 0);

-- Las facturas que ya tenían la respuesta de Ramón conservan su estado: sus líneas cuentan como recibidas completas.
update public.factura_lineas l
set recepcion = 'completa',
    cantidad_recibida = l.cantidad_comprada,
    recepcion_por = coalesce(f.confirmacion_por, 'Ramón'),
    recepcion_en = coalesce(f.confirmacion_en, now())
from public.facturas f
where l.factura_id = f.id
  and l.recepcion = 'pendiente'
  and (f.confirmacion_en is not null or f.estado in ('registrada', 'verificada', 'conciliada'));

create index if not exists idx_products_nombre_trgm
  on public.products using gin (lower(nombre) extensions.gin_trgm_ops);

create or replace function public.productos_similares(q text, limite integer default 5)
returns table (id uuid, nombre text, similitud real)
language sql
stable
set search_path = public, extensions
as $$
  select p.id, p.nombre, extensions.similarity(lower(p.nombre), lower(q)) as similitud
  from public.products p
  where p.activo is not false
    and lower(p.nombre) operator(extensions.%) lower(q)
  order by similitud desc, p.nombre
  limit greatest(1, least(limite, 20));
$$;

-- Los vínculos ya elegidos a mano se vuelven alias de su proveedor.
insert into public.catalogo_alias (proveedor_id, descripcion_norm, producto_id, confirmado_por, veces)
select distinct on (f.proveedor_id, d.norm) f.proveedor_id, d.norm, l.producto_id, 'migración', 1
from public.factura_lineas l
join public.facturas f on f.id = l.factura_id
cross join lateral (
  select btrim(regexp_replace(lower(extensions.unaccent(coalesce(l.descripcion_original, l.producto_normalizado, ''))), '[^a-z0-9]+', ' ', 'g')) as norm
) d
where l.producto_id is not null
  and f.proveedor_id is not null
  and char_length(d.norm) >= 2
order by f.proveedor_id, d.norm, f.recibido_en desc
on conflict do nothing;

-- Propuesta por nombre para las líneas abiertas que no tienen producto.
with propuestas as (
  select l.id, s.id as producto_id, s.similitud
  from public.factura_lineas l
  join public.facturas f on f.id = l.factura_id
  cross join lateral public.productos_similares(coalesce(l.descripcion_original, l.producto_normalizado), 1) s
  where f.estado <> 'conciliada'
    and l.producto_id is null
    and coalesce(l.descripcion_original, l.producto_normalizado) is not null
    and s.similitud >= 0.25
)
update public.factura_lineas l
set propuesta_producto_id = p.producto_id,
    propuesta_confianza = least(85, round(p.similitud * 120))::integer,
    propuesta_origen = 'texto'
from propuestas p
where l.id = p.id;

revoke all on table public.producto_presentaciones from anon, authenticated, public;
revoke all on table public.catalogo_alias from anon, authenticated, public;
revoke all on function public.productos_similares(text, integer) from anon, authenticated, public;
grant all on table public.producto_presentaciones to service_role;
grant all on table public.catalogo_alias to service_role;
grant execute on function public.productos_similares(text, integer) to service_role;

alter table public.producto_presentaciones enable row level security;
alter table public.producto_presentaciones force row level security;
alter table public.catalogo_alias enable row level security;
alter table public.catalogo_alias force row level security;
