-- El costo manual también cuenta como costo, y el resumen comercial
-- devuelve la hora de la factura para compararla con ese costo.

create or replace function public.productos_con_costo()
returns jsonb
language sql
stable
set search_path = public
as $$
  select coalesce(jsonb_agg(distinct id), '[]'::jsonb)
  from (
    select l.producto_id as id
    from public.factura_lineas l
    join public.facturas f on f.id = l.factura_id
    where l.producto_id is not null
      and f.tipo_documento <> 'nota_credito'
      and (l.costo_unitario is not null or l.costo_por_presentacion is not null)
    union
    select p.id
    from public.products p
    where p.costo_manual is not null
  ) costos;
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
    union
    select p.id
    from public.products p
    where p.costo_manual is not null
  )
  select
    count(*)::integer as todos,
    count(*) filter (where filtrados.activo)::integer as activos,
    count(*) filter (where not filtrados.activo)::integer as inactivos,
    count(*) filter (where not exists (select 1 from con_costo c where c.id = filtrados.id))::integer as sin_costo
  from filtrados;
$$;

drop function if exists public.producto_resumen_comercial(uuid[]);

create function public.producto_resumen_comercial(p_ids uuid[])
returns table (
  producto_id uuid,
  factura_id uuid,
  costo numeric,
  costo_en text,
  costo_clave text,
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
      coalesce(f.recibido_en::text, f.fecha_emision::text) as costo_clave,
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
      costo_clave,
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
    nullif(btrim(m.costo_clave), '') as costo_clave,
    m.proveedor_nombre as proveedor,
    coalesce(p.proveedores, '[]'::jsonb) as proveedores
  from mejor m
  full join prov p on p.producto_id = m.producto_id;
$$;

revoke all on function public.productos_con_costo() from anon, authenticated, public;
revoke all on function public.catalogo_conteos(text, text) from anon, authenticated, public;
revoke all on function public.producto_resumen_comercial(uuid[]) from anon, authenticated, public;

grant execute on function public.productos_con_costo() to service_role;
grant execute on function public.catalogo_conteos(text, text) to service_role;
grant execute on function public.producto_resumen_comercial(uuid[]) to service_role;
