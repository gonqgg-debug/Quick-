-- La lista de productos y la de facturas dejan de bajar tablas enteras.
-- Los conteos, las categorías y el costo de la página salen de una función cada uno.

create index if not exists idx_facturas_updated_at
  on public.facturas (updated_at desc);

create index if not exists idx_facturas_proveedor_trgm
  on public.facturas using gin (proveedor extensions.gin_trgm_ops);

create index if not exists idx_facturas_ncf_trgm
  on public.facturas using gin (ncf extensions.gin_trgm_ops)
  where ncf is not null;

create index if not exists idx_facturas_numero_trgm
  on public.facturas using gin (numero_factura extensions.gin_trgm_ops)
  where numero_factura is not null;

create index if not exists idx_facturas_tienda_trgm
  on public.facturas using gin (tienda extensions.gin_trgm_ops)
  where tienda is not null;

create index if not exists idx_facturas_rnc_trgm
  on public.facturas using gin (rnc extensions.gin_trgm_ops)
  where rnc is not null;

create index if not exists idx_factura_lineas_costo_producto
  on public.factura_lineas (producto_id)
  where producto_id is not null
    and (costo_unitario is not null or costo_por_presentacion is not null);

create index if not exists idx_products_nombre
  on public.products (nombre);

create index if not exists idx_products_activo_nombre
  on public.products (activo, nombre);

create index if not exists idx_products_categoria_nombre
  on public.products (categoria, nombre);

create or replace function public.facturas_resumen()
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'total', count(*),
    'preguntasAbiertas', coalesce(sum(preguntas_abiertas), 0),
    'posiblesDuplicados', count(*) filter (where posible_duplicado),
    'sinFoto', count(*) filter (where numero_documentos = 0),
    'conProblema', count(*) filter (where problema),
    'atencion', count(*) filter (
      where problema
        or preguntas_abiertas > 0
        or posible_duplicado
        or numero_documentos = 0
    ),
    'porEstado', jsonb_build_object(
      'falta_factura', count(*) filter (where estado = 'falta_factura'),
      'recibida', count(*) filter (where estado = 'recibida'),
      'registrada', count(*) filter (where estado = 'registrada'),
      'verificada', count(*) filter (where estado = 'verificada'),
      'conciliada', count(*) filter (where estado = 'conciliada')
    )
  )
  from public.facturas;
$$;

create or replace function public.catalogo_categorias()
returns table (categoria text)
language sql
stable
set search_path = public
as $$
  select distinct btrim(p.categoria) as categoria
  from public.products p
  where btrim(coalesce(p.categoria, '')) <> ''
  order by 1;
$$;

create or replace function public.productos_con_costo()
returns jsonb
language sql
stable
set search_path = public
as $$
  select coalesce(jsonb_agg(distinct l.producto_id), '[]'::jsonb)
  from public.factura_lineas l
  join public.facturas f on f.id = l.factura_id
  where l.producto_id is not null
    and f.tipo_documento <> 'nota_credito'
    and (l.costo_unitario is not null or l.costo_por_presentacion is not null);
$$;

create or replace function public.catalogo_conteos(p_busqueda text, p_categoria text)
returns table (todos integer, activos integer, inactivos integer, sin_costo integer)
language sql
stable
set search_path = public
as $$
  with filtrados as (
    select p.id, p.activo
    from public.products p
    where (p_categoria is null or btrim(p_categoria) = '' or p.categoria = p_categoria)
      and (
        p_busqueda is null or btrim(p_busqueda) = ''
        or p.nombre ilike '%' || p_busqueda || '%'
        or coalesce(p.marca, '') ilike '%' || p_busqueda || '%'
        or coalesce(p.descripcion, '') ilike '%' || p_busqueda || '%'
        or coalesce(p.codigo_odoo, '') ilike '%' || p_busqueda || '%'
        or coalesce(p.codigo_barras, '') ilike '%' || p_busqueda || '%'
      )
  ),
  con_costo as (
    select distinct l.producto_id as id
    from public.factura_lineas l
    join public.facturas fa on fa.id = l.factura_id
    where l.producto_id is not null
      and fa.tipo_documento <> 'nota_credito'
      and (l.costo_unitario is not null or l.costo_por_presentacion is not null)
  )
  select
    count(*)::integer as todos,
    count(*) filter (where filtrados.activo)::integer as activos,
    count(*) filter (where not filtrados.activo)::integer as inactivos,
    count(*) filter (where not exists (select 1 from con_costo c where c.id = filtrados.id))::integer as sin_costo
  from filtrados;
$$;

create or replace function public.producto_resumen_comercial(p_ids uuid[])
returns table (
  producto_id uuid,
  factura_id uuid,
  costo numeric,
  costo_en text,
  proveedor text,
  proveedores jsonb
)
language sql
stable
set search_path = public
as $$
  with lineas as (
    select
      l.producto_id,
      l.factura_id,
      coalesce(l.costo_unitario, l.costo_por_presentacion) as costo,
      btrim(coalesce(f.fecha_emision::text, '') || ' ' || coalesce(f.recibido_en::text, '')) as fecha,
      f.proveedor_id,
      pr.nombre as proveedor_nombre
    from public.factura_lineas l
    join public.facturas f on f.id = l.factura_id
    left join public.proveedores pr on pr.id = f.proveedor_id
    where l.producto_id = any(p_ids)
      and f.tipo_documento <> 'nota_credito'
  ),
  mejor as (
    select distinct on (producto_id)
      producto_id,
      factura_id,
      costo,
      fecha,
      proveedor_nombre
    from lineas
    where costo is not null
    order by producto_id, fecha desc, factura_id desc
  ),
  por_proveedor as (
    select distinct on (producto_id, proveedor_id)
      producto_id,
      proveedor_id,
      proveedor_nombre,
      nullif(left(fecha, 10), '') as ultima
    from lineas
    where proveedor_id is not null
      and proveedor_nombre is not null
      and btrim(proveedor_nombre) <> ''
    order by producto_id, proveedor_id, fecha desc
  ),
  prov as (
    select
      producto_id,
      coalesce(
        jsonb_agg(
          jsonb_build_object('id', proveedor_id, 'nombre', proveedor_nombre, 'ultimaCompra', ultima)
          order by ultima desc nulls last, proveedor_nombre
        ),
        '[]'::jsonb
      ) as proveedores
    from por_proveedor
    group by producto_id
  )
  select
    coalesce(m.producto_id, p.producto_id) as producto_id,
    m.factura_id,
    m.costo,
    nullif(left(m.fecha, 10), '') as costo_en,
    m.proveedor_nombre as proveedor,
    coalesce(p.proveedores, '[]'::jsonb) as proveedores
  from mejor m
  full join prov p on p.producto_id = m.producto_id;
$$;

revoke all on function public.facturas_resumen() from anon, authenticated, public;
revoke all on function public.catalogo_categorias() from anon, authenticated, public;
revoke all on function public.productos_con_costo() from anon, authenticated, public;
revoke all on function public.catalogo_conteos(text, text) from anon, authenticated, public;
revoke all on function public.producto_resumen_comercial(uuid[]) from anon, authenticated, public;

grant execute on function public.facturas_resumen() to service_role;
grant execute on function public.catalogo_categorias() to service_role;
grant execute on function public.productos_con_costo() to service_role;
grant execute on function public.catalogo_conteos(text, text) to service_role;
grant execute on function public.producto_resumen_comercial(uuid[]) to service_role;
