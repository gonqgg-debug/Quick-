-- Listado de ventas por producto: mismas fórmulas de ITBIS y margen.
-- El costo sigue siendo el vigente (manual o última factura), no el del día de la venta.
-- Un costo null no entra como cero. Un costo 0 sí es un costo.

alter table public.products
  add column if not exists codigo_barras text;

drop function if exists public.consumo_top_productos(text, date, date, date, date, text, text, text, integer, integer, numeric, text);

create function public.consumo_top_productos(
  p_tienda text,
  p_desde date,
  p_hasta date,
  p_desde_ant date,
  p_hasta_ant date,
  p_orden text,
  p_categoria text,
  p_q text,
  p_limit integer,
  p_cursor_null integer,
  p_cursor_valor numeric,
  p_cursor_codigo text,
  p_sin_costo boolean default false,
  p_offset integer default 0
)
returns table (
  codigo_odoo text,
  product_id uuid,
  nombre text,
  marca text,
  categoria text,
  unidades numeric,
  venta numeric,
  n_ordenes integer,
  costo_unit numeric,
  costo_origen text,
  costo_fecha timestamptz,
  costo_ref text,
  margen numeric,
  margen_pct numeric,
  venta_anterior numeric,
  variacion numeric,
  match_estado text,
  venta_neta numeric,
  costo_ventas numeric,
  codigo_barras text
)
language sql
stable
set search_path = public
as $$
  with actual as (
    select
      r.codigo_odoo,
      (array_agg(r.product_id) filter (where r.product_id is not null))[1] as product_id,
      max(r.nombre) as nombre_resumen,
      sum(r.unidades) as unidades,
      sum(r.unidades_sin_itbis) as unidades_sin_itbis,
      sum(r.venta) as venta,
      sum(r.venta_neta) as venta_neta,
      sum(r.n_ordenes)::int as n_ordenes
    from public.resumen_producto_dia r
    where r.tienda = p_tienda
      and r.fecha between p_desde and p_hasta
    group by r.codigo_odoo
  ),
  anterior as (
    select r.codigo_odoo, sum(r.venta) as venta
    from public.resumen_producto_dia r
    where p_desde_ant is not null
      and r.tienda = p_tienda
      and r.fecha between p_desde_ant and p_hasta_ant
    group by r.codigo_odoo
  ),
  enriquecido as (
    select
      a.codigo_odoo,
      a.product_id,
      coalesce(p.nombre, a.nombre_resumen, a.codigo_odoo) as nombre,
      p.marca,
      p.codigo_barras,
      case
        when a.product_id is null then 'Sin match'
        else coalesce(nullif(btrim(p.categoria), ''), 'Sin categoría')
      end as categoria,
      round(a.unidades, 3) as unidades,
      round(a.venta, 2) as venta,
      a.n_ordenes,
      c.costo_unit,
      c.origen as costo_origen,
      c.fecha as costo_fecha,
      c.ref as costo_ref,
      round(coalesce(a.venta_neta, 0), 2) as venta_neta,
      case
        when c.costo_unit is null then null
        else round(c.costo_unit * a.unidades_sin_itbis, 2)
      end as costo_ventas,
      case
        when c.costo_unit is null then null
        else round(coalesce(a.venta_neta, 0) - c.costo_unit * a.unidades_sin_itbis, 2)
      end as margen,
      case
        when c.costo_unit is null or coalesce(a.venta_neta, 0) = 0 then null
        else round((a.venta_neta - c.costo_unit * a.unidades_sin_itbis) / a.venta_neta, 4)
      end as margen_pct,
      round(an.venta, 2) as venta_anterior,
      case
        when an.venta is null or an.venta = 0 then null
        else round((a.venta - an.venta) / an.venta, 4)
      end as variacion,
      case when a.product_id is null then 'sin_match' else 'match' end as match_estado
    from actual a
    left join public.products p on p.id = a.product_id
    left join public.costo_producto_vigente c on c.product_id = a.product_id
    left join anterior an on an.codigo_odoo = a.codigo_odoo
    where (
      p_categoria is null
      or btrim(p_categoria) = ''
      or (p_categoria = 'Sin match' and a.product_id is null)
      or (p_categoria <> 'Sin match' and p.categoria = p_categoria)
    )
    and (
      p_q is null
      or btrim(p_q) = ''
      or coalesce(p.nombre, a.nombre_resumen, '') ilike '%' || p_q || '%'
      or a.codigo_odoo ilike '%' || p_q || '%'
      or coalesce(p.codigo_barras, '') ilike '%' || p_q || '%'
    )
    and (
      p_sin_costo is not true
      or c.costo_unit is null
    )
  ),
  marcado as (
    select
      e.*,
      case
        when p_orden in ('unidades', 'unidades_asc') then e.unidades
        when p_orden in ('margen', 'margen_asc') then e.margen
        when p_orden in ('variacion', 'variacion_asc') then e.variacion
        else e.venta
      end as sort_valor,
      case
        when p_orden in ('margen', 'margen_asc', 'variacion', 'variacion_asc')
          and (
            case when p_orden in ('margen', 'margen_asc') then e.margen else e.variacion end
          ) is null then 1
        else 0
      end as sort_null,
      p_orden in ('venta_asc', 'unidades_asc', 'margen_asc', 'variacion_asc') as sort_asc
    from enriquecido e
  )
  select
    m.codigo_odoo, m.product_id, m.nombre, m.marca, m.categoria, m.unidades, m.venta, m.n_ordenes,
    m.costo_unit, m.costo_origen, m.costo_fecha, m.costo_ref, m.margen, m.margen_pct,
    m.venta_anterior, m.variacion, m.match_estado, m.venta_neta, m.costo_ventas, m.codigo_barras
  from marcado m
  where coalesce(p_offset, 0) > 0
    or p_cursor_codigo is null
    or m.sort_null > coalesce(p_cursor_null, 0)
    or (
      m.sort_null = coalesce(p_cursor_null, 0)
      and (
        (m.sort_asc and m.sort_valor > p_cursor_valor)
        or (not m.sort_asc and m.sort_valor < p_cursor_valor)
      )
    )
    or (
      m.sort_null = coalesce(p_cursor_null, 0)
      and m.sort_valor is not distinct from p_cursor_valor
      and m.codigo_odoo > p_cursor_codigo
    )
  order by m.sort_null,
    case when m.sort_asc then m.sort_valor end asc nulls last,
    case when not m.sort_asc then m.sort_valor end desc nulls last,
    m.codigo_odoo
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(501, greatest(coalesce(p_limit, 50), 1));
$$;

create or replace function public.consumo_productos_totales(
  p_tienda text,
  p_desde date,
  p_hasta date,
  p_categoria text,
  p_q text,
  p_sin_costo boolean default false
)
returns table (
  venta numeric,
  unidades numeric,
  productos integer,
  venta_con_costo numeric,
  venta_neta numeric,
  venta_neta_con_costo numeric,
  costo_ventas numeric,
  margen numeric,
  sin_costo_productos integer
)
language sql
stable
set search_path = public
as $$
  with actual as (
    select
      r.codigo_odoo,
      (array_agg(r.product_id) filter (where r.product_id is not null))[1] as product_id,
      max(r.nombre) as nombre_resumen,
      sum(r.unidades) as unidades,
      sum(r.unidades_sin_itbis) as unidades_sin_itbis,
      sum(r.venta) as venta,
      sum(r.venta_neta) as venta_neta
    from public.resumen_producto_dia r
    where r.tienda = p_tienda
      and r.fecha between p_desde and p_hasta
    group by r.codigo_odoo
  ),
  filtrado as (
    select a.*, c.costo_unit
    from actual a
    left join public.products p on p.id = a.product_id
    left join public.costo_producto_vigente c on c.product_id = a.product_id
    where (
      p_categoria is null
      or btrim(p_categoria) = ''
      or (p_categoria = 'Sin match' and a.product_id is null)
      or (p_categoria <> 'Sin match' and p.categoria = p_categoria)
    )
    and (
      p_q is null
      or btrim(p_q) = ''
      or coalesce(p.nombre, a.nombre_resumen, '') ilike '%' || p_q || '%'
      or a.codigo_odoo ilike '%' || p_q || '%'
      or coalesce(p.codigo_barras, '') ilike '%' || p_q || '%'
    )
    and (
      p_sin_costo is not true
      or c.costo_unit is null
    )
  )
  select
    round(coalesce(sum(f.venta), 0), 2),
    round(coalesce(sum(f.unidades), 0), 3),
    count(*)::int,
    round(coalesce(sum(f.venta) filter (where f.costo_unit is not null), 0), 2),
    round(coalesce(sum(f.venta_neta), 0), 2),
    round(coalesce(sum(f.venta_neta) filter (where f.costo_unit is not null), 0), 2),
    round(sum(f.costo_unit * f.unidades_sin_itbis) filter (where f.costo_unit is not null), 2),
    round(sum(coalesce(f.venta_neta, 0) - f.costo_unit * f.unidades_sin_itbis) filter (where f.costo_unit is not null), 2),
    count(*) filter (where f.costo_unit is null)::int
  from filtrado f;
$$;

revoke all on function public.consumo_top_productos(text, date, date, date, date, text, text, text, integer, integer, numeric, text, boolean, integer) from public, anon, authenticated;
grant execute on function public.consumo_top_productos(text, date, date, date, date, text, text, text, integer, integer, numeric, text, boolean, integer) to service_role;

revoke all on function public.consumo_productos_totales(text, date, date, text, text, boolean) from public, anon, authenticated;
grant execute on function public.consumo_productos_totales(text, date, date, text, text, boolean) to service_role;
