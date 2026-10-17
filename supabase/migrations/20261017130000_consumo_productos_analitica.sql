-- Vista de ventas por producto.
-- No cambia el margen, el ITBIS ni el costo vigente: reutiliza las mismas fórmulas
-- de consumo_top_productos y consumo_margen_periodo. El costo sigue siendo el
-- manual si existe y, si no, el de la última factura. No es el costo del día de la venta.

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
  p_offset integer default 0,
  p_sin_costo boolean default false
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
      case when c.costo_unit is null then null else round(coalesce(a.venta_neta, 0) - c.costo_unit * a.unidades_sin_itbis, 2) end as margen,
      case
        when c.costo_unit is null or coalesce(a.venta_neta, 0) = 0 then null
        else round((a.venta_neta - c.costo_unit * a.unidades_sin_itbis) / a.venta_neta, 4)
      end as margen_pct,
      round(an.venta, 2) as venta_anterior,
      case
        when an.venta is null or an.venta = 0 then null
        else round((a.venta - an.venta) / an.venta, 4)
      end as variacion,
      case when a.product_id is null then 'sin_match' else 'match' end as match_estado,
      round(coalesce(a.venta_neta, 0), 2) as venta_neta,
      case when c.costo_unit is null then null else round(c.costo_unit * a.unidades_sin_itbis, 2) end as costo_ventas,
      p.codigo_barras
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
      not coalesce(p_sin_costo, false)
      or c.costo_unit is null
    )
  ),
  marcado as (
    select
      e.*,
      case
        when p_orden in ('unidades', 'unidades_asc') then e.unidades
        when p_orden in ('margen', 'margen_asc') then e.margen
        when p_orden in ('margen_pct', 'margen_pct_asc') then e.margen_pct
        when p_orden in ('variacion', 'variacion_asc') then e.variacion
        when p_orden in ('venta_neta', 'venta_neta_asc') then e.venta_neta
        when p_orden in ('costo_ventas', 'costo_ventas_asc') then e.costo_ventas
        else e.venta
      end as sort_valor,
      case
        when p_orden in (
          'margen', 'margen_asc', 'margen_pct', 'margen_pct_asc',
          'variacion', 'variacion_asc', 'venta_neta', 'venta_neta_asc',
          'costo_ventas', 'costo_ventas_asc'
        ) and (
          case
            when p_orden in ('margen', 'margen_asc') then e.margen
            when p_orden in ('margen_pct', 'margen_pct_asc') then e.margen_pct
            when p_orden in ('venta_neta', 'venta_neta_asc') then e.venta_neta
            when p_orden in ('costo_ventas', 'costo_ventas_asc') then e.costo_ventas
            else e.variacion
          end
        ) is null then 1
        else 0
      end as sort_null
    from enriquecido e
  )
  select
    m.codigo_odoo, m.product_id, m.nombre, m.marca, m.categoria, m.unidades, m.venta, m.n_ordenes,
    m.costo_unit, m.costo_origen, m.costo_fecha, m.costo_ref, m.margen, m.margen_pct,
    m.venta_anterior, m.variacion, m.match_estado, m.venta_neta, m.costo_ventas, m.codigo_barras
  from marcado m
  where p_cursor_codigo is null
    or m.sort_null > coalesce(p_cursor_null, 0)
    or (
      m.sort_null = coalesce(p_cursor_null, 0)
      and (
        (
          p_orden in ('variacion_asc', 'venta_asc', 'unidades_asc', 'margen_asc', 'margen_pct_asc', 'venta_neta_asc', 'costo_ventas_asc')
          and m.sort_valor > p_cursor_valor
        )
        or (
          p_orden not in ('variacion_asc', 'venta_asc', 'unidades_asc', 'margen_asc', 'margen_pct_asc', 'venta_neta_asc', 'costo_ventas_asc')
          and m.sort_valor < p_cursor_valor
        )
      )
    )
    or (
      m.sort_null = coalesce(p_cursor_null, 0)
      and m.sort_valor is not distinct from p_cursor_valor
      and m.codigo_odoo > p_cursor_codigo
    )
  order by m.sort_null,
    case
      when p_orden in ('variacion_asc', 'venta_asc', 'unidades_asc', 'margen_asc', 'margen_pct_asc', 'venta_neta_asc', 'costo_ventas_asc')
      then m.sort_valor
    end asc nulls last,
    case
      when p_orden not in ('variacion_asc', 'venta_asc', 'unidades_asc', 'margen_asc', 'margen_pct_asc', 'venta_neta_asc', 'costo_ventas_asc')
      then m.sort_valor
    end desc nulls last,
    m.codigo_odoo
  limit least(5000, greatest(coalesce(p_limit, 50), 1))
  offset greatest(coalesce(p_offset, 0), 0);
$$;

drop function if exists public.consumo_venta_alcance(text, date, date, text, text);

create function public.consumo_venta_alcance(
  p_tienda text,
  p_desde date,
  p_hasta date,
  p_categoria text,
  p_q text,
  p_sin_costo boolean default false
)
returns numeric
language sql
stable
set search_path = public
as $$
  with actual as (
    select
      r.codigo_odoo,
      (array_agg(r.product_id) filter (where r.product_id is not null))[1] as product_id,
      max(r.nombre) as nombre_resumen,
      sum(r.venta) as venta
    from public.resumen_producto_dia r
    where r.tienda = p_tienda
      and r.fecha between p_desde and p_hasta
    group by r.codigo_odoo
  )
  select round(coalesce(sum(a.venta), 0), 2)
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
    not coalesce(p_sin_costo, false)
    or c.costo_unit is null
  );
$$;

-- Totales del conjunto filtrado, antes de paginar.
-- venta y unidades incluyen productos sin costo.
-- margen y costo_ventas quedan null si ninguno tiene costo: no se sustituyen por cero.
-- venta_anterior incluye productos del periodo comparado que cumplen el mismo filtro,
-- aunque no se hayan vendido en el periodo actual.
create function public.consumo_productos_resumen(
  p_tienda text,
  p_desde date,
  p_hasta date,
  p_desde_cmp date,
  p_hasta_cmp date,
  p_desde_ant date,
  p_hasta_ant date,
  p_categoria text,
  p_q text,
  p_sin_costo boolean default false
)
returns table (
  n_productos integer,
  unidades numeric,
  venta numeric,
  venta_neta numeric,
  venta_con_costo numeric,
  venta_neta_con_costo numeric,
  costo_ventas numeric,
  margen numeric,
  n_sin_costo integer,
  venta_comparable numeric,
  venta_anterior numeric
)
language sql
stable
set search_path = public
as $$
  with rango as (
    select
      r.codigo_odoo,
      (array_agg(r.product_id) filter (where r.product_id is not null))[1] as product_id,
      max(r.nombre) as nombre_resumen,
      sum(r.unidades) filter (where r.fecha between p_desde and p_hasta) as unidades,
      sum(r.unidades_sin_itbis) filter (where r.fecha between p_desde and p_hasta) as unidades_sin_itbis,
      sum(r.venta) filter (where r.fecha between p_desde and p_hasta) as venta,
      sum(r.venta_neta) filter (where r.fecha between p_desde and p_hasta) as venta_neta,
      sum(r.venta) filter (where p_desde_cmp is not null and r.fecha between p_desde_cmp and p_hasta_cmp) as venta_cmp,
      sum(r.venta) filter (where p_desde_ant is not null and r.fecha between p_desde_ant and p_hasta_ant) as venta_ant
    from public.resumen_producto_dia r
    where r.tienda = p_tienda
      and r.fecha between least(p_desde, coalesce(p_desde_cmp, p_desde), coalesce(p_desde_ant, p_desde))
        and greatest(p_hasta, coalesce(p_hasta_cmp, p_hasta), coalesce(p_hasta_ant, p_hasta))
    group by r.codigo_odoo
  ),
  enriquecido as (
    select
      a.*,
      c.costo_unit
    from rango a
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
      not coalesce(p_sin_costo, false)
      or c.costo_unit is null
    )
  )
  select
    count(*) filter (where e.venta is not null)::int,
    round(coalesce(sum(e.unidades) filter (where e.venta is not null), 0), 3),
    round(coalesce(sum(e.venta) filter (where e.venta is not null), 0), 2),
    round(coalesce(sum(e.venta_neta) filter (where e.venta is not null), 0), 2),
    round(coalesce(sum(e.venta) filter (where e.venta is not null and e.costo_unit is not null), 0), 2),
    round(coalesce(sum(e.venta_neta) filter (where e.venta is not null and e.costo_unit is not null), 0), 2),
    round(sum(e.costo_unit * e.unidades_sin_itbis) filter (where e.venta is not null and e.costo_unit is not null), 2),
    round(sum(coalesce(e.venta_neta, 0) - e.costo_unit * coalesce(e.unidades_sin_itbis, 0)) filter (where e.venta is not null and e.costo_unit is not null), 2),
    count(*) filter (where e.venta is not null and e.costo_unit is null)::int,
    case
      when p_desde_cmp is null then null
      else round(coalesce(sum(e.venta_cmp) filter (where e.venta_cmp is not null), 0), 2)
    end,
    case
      when p_desde_ant is null then null
      else round(coalesce(sum(e.venta_ant) filter (where e.venta_ant is not null), 0), 2)
    end
  from enriquecido e;
$$;

create or replace function public.consumo_tiendas()
returns table (tienda text)
language sql
stable
set search_path = public
as $$
  select distinct s.tienda
  from public.pos_sesiones s
  where s.tienda is not null and btrim(s.tienda) <> ''
  order by 1;
$$;

revoke all on function public.consumo_top_productos(text, date, date, date, date, text, text, text, integer, integer, numeric, text, integer, boolean) from public, anon, authenticated;
grant execute on function public.consumo_top_productos(text, date, date, date, date, text, text, text, integer, integer, numeric, text, integer, boolean) to service_role;

revoke all on function public.consumo_venta_alcance(text, date, date, text, text, boolean) from public, anon, authenticated;
grant execute on function public.consumo_venta_alcance(text, date, date, text, text, boolean) to service_role;

revoke all on function public.consumo_productos_resumen(text, date, date, date, date, date, date, text, text, boolean) from public, anon, authenticated;
grant execute on function public.consumo_productos_resumen(text, date, date, date, date, date, date, text, text, boolean) to service_role;

revoke all on function public.consumo_tiendas() from public, anon, authenticated;
grant execute on function public.consumo_tiendas() to service_role;
