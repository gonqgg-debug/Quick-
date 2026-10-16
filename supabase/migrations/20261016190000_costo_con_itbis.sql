-- El costo guardado (costo_manual y factura_lineas.costo_unitario) incluye ITBIS.
-- El margen quita ese ITBIS con la misma tasa de la venta:
--   (venta_con_itbis - unidades * costo_con_itbis) / (1 + tasa/100)
-- La tasa es la de la línea, si vino, y si no la de products.tasa_itbis.

alter table public.resumen_producto_dia
  add column if not exists unidades_sin_itbis numeric(16, 6) not null default 0;

comment on column public.resumen_producto_dia.unidades_sin_itbis is
  'Suma de cantidad / (1 + tasa/100). El margen es venta_neta menos costo con ITBIS por este factor.';

comment on column public.products.tasa_itbis is
  'ITBIS incluido en el precio de venta y en el costo: 0, 16 o 18.';

comment on column public.products.costo_manual is
  'Costo por unidad de venta, con ITBIS incluido.';

do $$
begin
  if to_regclass('public.factura_lineas') is not null then
    execute $c$comment on column public.factura_lineas.costo_unitario is
      'Costo por unidad de venta, con ITBIS incluido. No es el precio de la caja.'$c$;
  end if;
end $$;

create or replace function public.refrescar_resumenes_fechas(p_tienda text, p_fechas date[])
returns void
language plpgsql
set search_path = public
as $$
declare
  v_semana date;
begin
  if p_fechas is null or cardinality(p_fechas) = 0 then
    return;
  end if;

  delete from public.resumen_producto_dia where tienda = p_tienda and fecha = any (p_fechas);
  insert into public.resumen_producto_dia (tienda, fecha, codigo_odoo, product_id, nombre, unidades, venta, venta_neta, unidades_sin_itbis, n_ordenes)
  select
    o.tienda,
    o.fecha_operativa,
    l.codigo_odoo,
    (array_agg(l.product_id order by l.id) filter (where l.product_id is not null))[1],
    coalesce(max(pr.nombre), max(l.nombre_odoo), l.codigo_odoo),
    round(sum(l.cantidad), 3),
    round(sum(coalesce(l.subtotal_con_itbis, l.subtotal, 0)), 2),
    round(sum(
      coalesce(l.subtotal_con_itbis, l.subtotal, 0)
      / (1 + coalesce(l.tasa_itbis, pr.tasa_itbis, 18) / 100.0)
    ), 2),
    sum(
      l.cantidad / (1 + coalesce(l.tasa_itbis, pr.tasa_itbis, 18) / 100.0)
    ),
    count(distinct l.orden_id)::int
  from public.pos_orden_lineas l
  join public.pos_ordenes o on o.id = l.orden_id
  left join public.products pr on pr.id = l.product_id
  where o.tienda = p_tienda
    and public.pos_orden_cuenta(o.estado)
    and o.fecha_operativa = any (p_fechas)
  group by o.tienda, o.fecha_operativa, l.codigo_odoo;

  delete from public.resumen_hora_dia where tienda = p_tienda and fecha = any (p_fechas);
  insert into public.resumen_hora_dia (tienda, fecha, hora, dow, n_ordenes, venta, unidades)
  select
    o.tienda,
    o.fecha_operativa,
    o.hora_local,
    o.dow,
    count(*)::int,
    round(coalesce(sum(o.total), 0), 2),
    round(coalesce(sum(lu.unidades), 0), 3)
  from public.pos_ordenes o
  left join (
    select l.orden_id, sum(l.cantidad) as unidades
    from public.pos_orden_lineas l
    join public.pos_ordenes o2 on o2.id = l.orden_id
    where o2.tienda = p_tienda
      and public.pos_orden_cuenta(o2.estado)
      and o2.fecha_operativa = any (p_fechas)
    group by l.orden_id
  ) lu on lu.orden_id = o.id
  where o.tienda = p_tienda
    and public.pos_orden_cuenta(o.estado)
    and o.fecha_operativa = any (p_fechas)
  group by o.tienda, o.fecha_operativa, o.hora_local, o.dow;

  delete from public.resumen_hora_categoria_dia where tienda = p_tienda and fecha = any (p_fechas);
  insert into public.resumen_hora_categoria_dia (tienda, fecha, hora, dow, categoria, n_ordenes, venta, unidades)
  select
    o.tienda,
    o.fecha_operativa,
    o.hora_local,
    o.dow,
    case
      when l.match_estado = 'sin_match' or l.product_id is null then 'Sin match'
      else coalesce(nullif(btrim(pr.categoria), ''), 'Sin categoría')
    end,
    count(distinct o.id)::int,
    round(sum(coalesce(l.subtotal_con_itbis, l.subtotal, 0)), 2),
    round(sum(l.cantidad), 3)
  from public.pos_orden_lineas l
  join public.pos_ordenes o on o.id = l.orden_id
  left join public.products pr on pr.id = l.product_id
  where o.tienda = p_tienda
    and public.pos_orden_cuenta(o.estado)
    and o.fecha_operativa = any (p_fechas)
  group by 1, 2, 3, 4, 5;

  delete from public.resumen_categoria_dia where tienda = p_tienda and fecha = any (p_fechas);
  insert into public.resumen_categoria_dia (tienda, fecha, categoria, unidades, venta)
  select
    o.tienda,
    o.fecha_operativa,
    case
      when l.match_estado = 'sin_match' or l.product_id is null then 'Sin match'
      else coalesce(nullif(btrim(pr.categoria), ''), 'Sin categoría')
    end,
    round(sum(l.cantidad), 3),
    round(sum(coalesce(l.subtotal_con_itbis, l.subtotal, 0)), 2)
  from public.pos_orden_lineas l
  join public.pos_ordenes o on o.id = l.orden_id
  left join public.products pr on pr.id = l.product_id
  where o.tienda = p_tienda
    and public.pos_orden_cuenta(o.estado)
    and o.fecha_operativa = any (p_fechas)
  group by o.tienda, o.fecha_operativa, 3;

  delete from public.resumen_dia where tienda = p_tienda and fecha = any (p_fechas);
  insert into public.resumen_dia (
    tienda, fecha, n_ordenes, venta, ticket_promedio, unidades_por_ticket, unidades,
    efectivo, banco, tarjeta, credito, otro
  )
  select
    p_tienda,
    d.fecha,
    coalesce(o.n_ordenes, 0),
    coalesce(o.venta, 0),
    case when coalesce(o.n_ordenes, 0) = 0 then null else round(o.venta / o.n_ordenes, 2) end,
    case when coalesce(o.n_ordenes, 0) = 0 then null else round(coalesce(l.unidades, 0) / o.n_ordenes, 3) end,
    coalesce(l.unidades, 0),
    coalesce(p.efectivo, 0),
    coalesce(p.banco, 0),
    coalesce(p.tarjeta, 0),
    coalesce(p.credito, 0),
    coalesce(p.otro, 0)
  from unnest(p_fechas) as d(fecha)
  left join (
    select fecha_operativa as fecha, count(*)::int as n_ordenes, round(sum(total), 2) as venta
    from public.pos_ordenes
    where tienda = p_tienda
      and public.pos_orden_cuenta(estado)
      and fecha_operativa = any (p_fechas)
    group by fecha_operativa
  ) o on o.fecha = d.fecha
  left join (
    select o2.fecha_operativa as fecha, round(sum(l2.cantidad), 3) as unidades
    from public.pos_orden_lineas l2
    join public.pos_ordenes o2 on o2.id = l2.orden_id
    where o2.tienda = p_tienda
      and public.pos_orden_cuenta(o2.estado)
      and o2.fecha_operativa = any (p_fechas)
    group by o2.fecha_operativa
  ) l on l.fecha = d.fecha
  left join (
    select
      s.fecha_operativa as fecha,
      round(coalesce(sum(pg.monto) filter (where pg.metodo = 'efectivo'), 0), 2) as efectivo,
      round(coalesce(sum(pg.monto) filter (where pg.metodo = 'banco'), 0), 2) as banco,
      round(coalesce(sum(pg.monto) filter (where pg.metodo = 'tarjeta'), 0), 2) as tarjeta,
      round(coalesce(sum(pg.monto) filter (where pg.metodo = 'credito'), 0), 2) as credito,
      round(coalesce(sum(pg.monto) filter (where pg.metodo = 'otro'), 0), 2) as otro
    from public.pos_pagos pg
    join public.pos_ordenes op on op.id = pg.orden_id and public.pos_orden_cuenta(op.estado)
    join public.pos_sesiones s on s.id = pg.sesion_id
    where s.tienda = p_tienda
      and s.fecha_operativa = any (p_fechas)
      and coalesce(pg.es_cambio, false) = false
    group by s.fecha_operativa
  ) p on p.fecha = d.fecha;

  delete from public.resumen_turno_dia where tienda = p_tienda and fecha = any (p_fechas);
  insert into public.resumen_turno_dia (
    tienda, fecha, turno, n_ordenes, venta, ticket_promedio, unidades_por_ticket, unidades
  )
  select
    p_tienda,
    s.fecha_operativa,
    s.turno,
    count(o.id)::int,
    round(coalesce(sum(o.total), 0), 2),
    case when count(o.id) = 0 then null else round(coalesce(sum(o.total), 0) / count(o.id), 2) end,
    case when count(o.id) = 0 then null else round(coalesce(max(u.unidades), 0) / count(o.id), 3) end,
    coalesce(max(u.unidades), 0)
  from public.pos_sesiones s
  left join public.pos_ordenes o on o.sesion_id = s.id and public.pos_orden_cuenta(o.estado)
  left join (
    select s2.fecha_operativa, s2.turno, round(sum(l.cantidad), 3) as unidades
    from public.pos_orden_lineas l
    join public.pos_ordenes o2 on o2.id = l.orden_id and public.pos_orden_cuenta(o2.estado)
    join public.pos_sesiones s2 on s2.id = o2.sesion_id
    where s2.tienda = p_tienda and s2.fecha_operativa = any (p_fechas)
    group by s2.fecha_operativa, s2.turno
  ) u on u.fecha_operativa = s.fecha_operativa and u.turno = s.turno
  where s.tienda = p_tienda
    and s.fecha_operativa = any (p_fechas)
  group by s.fecha_operativa, s.turno;

  for v_semana in
    select distinct date_trunc('week', f)::date
    from unnest(p_fechas) as f
  loop
    perform public.refrescar_canasta(p_tienda, v_semana);
  end loop;
end;
$$;

create or replace function public.consumo_margen_periodo(p_tienda text, p_desde date, p_hasta date)
returns table (
  venta numeric,
  venta_con_costo numeric,
  margen numeric,
  unidades numeric,
  venta_neta_con_costo numeric
)
language sql
stable
set search_path = public
as $$
  with agg as (
    select
      (array_agg(r.product_id) filter (where r.product_id is not null))[1] as product_id,
      sum(r.unidades) as unidades,
      sum(r.unidades_sin_itbis) as unidades_sin_itbis,
      sum(r.venta) as venta,
      sum(r.venta_neta) as venta_neta
    from public.resumen_producto_dia r
    where r.tienda = p_tienda
      and r.fecha between p_desde and p_hasta
    group by r.codigo_odoo
  )
  select
    round(coalesce(sum(a.venta), 0), 2),
    round(coalesce(sum(a.venta) filter (where c.costo_unit is not null), 0), 2),
    round(sum(coalesce(a.venta_neta, 0) - c.costo_unit * a.unidades_sin_itbis) filter (where c.costo_unit is not null), 2),
    round(coalesce(sum(a.unidades), 0), 3),
    round(coalesce(sum(a.venta_neta) filter (where c.costo_unit is not null), 0), 2)
  from agg a
  left join public.costo_producto_vigente c on c.product_id = a.product_id;
$$;

create or replace function public.consumo_top_productos(
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
  p_cursor_codigo text
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
  match_estado text
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
    )
  ),
  marcado as (
    select
      e.*,
      case
        when p_orden = 'unidades' then e.unidades
        when p_orden = 'margen' then e.margen
        when p_orden in ('variacion', 'variacion_asc') then e.variacion
        else e.venta
      end as sort_valor,
      case
        when p_orden in ('margen', 'variacion', 'variacion_asc') and (
          case when p_orden = 'margen' then e.margen else e.variacion end
        ) is null then 1
        else 0
      end as sort_null
    from enriquecido e
  )
  select
    m.codigo_odoo, m.product_id, m.nombre, m.marca, m.categoria, m.unidades, m.venta, m.n_ordenes,
    m.costo_unit, m.costo_origen, m.costo_fecha, m.costo_ref, m.margen, m.margen_pct,
    m.venta_anterior, m.variacion, m.match_estado
  from marcado m
  where p_cursor_codigo is null
    or m.sort_null > coalesce(p_cursor_null, 0)
    or (
      m.sort_null = coalesce(p_cursor_null, 0)
      and (
        (p_orden = 'variacion_asc' and m.sort_valor > p_cursor_valor)
        or (p_orden is distinct from 'variacion_asc' and m.sort_valor < p_cursor_valor)
      )
    )
    or (
      m.sort_null = coalesce(p_cursor_null, 0)
      and m.sort_valor is not distinct from p_cursor_valor
      and m.codigo_odoo > p_cursor_codigo
    )
  order by m.sort_null,
    case when p_orden = 'variacion_asc' then m.sort_valor end asc nulls last,
    case when p_orden is distinct from 'variacion_asc' then m.sort_valor end desc nulls last,
    m.codigo_odoo
  limit least(501, greatest(coalesce(p_limit, 50), 1));
$$;


update public.resumen_producto_dia r
set unidades_sin_itbis = s.factor
from (
  select
    o.tienda,
    o.fecha_operativa as fecha,
    l.codigo_odoo,
    sum(l.cantidad / (1 + coalesce(l.tasa_itbis, pr.tasa_itbis, 18) / 100.0)) as factor
  from public.pos_orden_lineas l
  join public.pos_ordenes o on o.id = l.orden_id
  left join public.products pr on pr.id = l.product_id
  where public.pos_orden_cuenta(o.estado)
  group by o.tienda, o.fecha_operativa, l.codigo_odoo
) s
where r.tienda = s.tienda
  and r.fecha = s.fecha
  and r.codigo_odoo = s.codigo_odoo;

update public.resumen_producto_dia r
set unidades_sin_itbis = r.unidades / (1 + coalesce(p.tasa_itbis, 18) / 100.0)
from public.products p
where r.product_id = p.id
  and r.unidades_sin_itbis = 0
  and r.unidades <> 0;
