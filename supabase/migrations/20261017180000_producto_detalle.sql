-- Horas de un producto. Reloj real: fecha timestamptz convertida una vez a America/Santo_Domingo.
-- Reloj caja: fecha_operativa y hora_local, ya grabadas en esa zona. No son equivalentes.
-- ocurrencias = días en que una sesión cerrada cubrió esa hora. Cero ventas con ocurrencias no es “sin datos”.

create or replace function public.consumo_producto_horas_vista(
  p_tienda text,
  p_codigo text,
  p_desde date,
  p_hasta date,
  p_reloj text default 'real'
)
returns table (
  hora smallint,
  n_ordenes integer,
  venta numeric,
  unidades numeric,
  ocurrencias integer
)
language sql
stable
set search_path = public
as $$
  with sesiones as (
    select s.fecha_operativa, s.start_at, s.stop_at, s.ingesta
    from public.pos_sesiones s
    where s.tienda = p_tienda
      and s.fecha_operativa between p_desde and p_hasta
      and s.stop_at is not null
      and s.ingesta = 'cerrada'
  ),
  abiertas as (
    select gs::date as fecha, extract(hour from gs)::int as hora
    from sesiones s
    cross join lateral generate_series(
      date_trunc('hour', s.start_at at time zone 'America/Santo_Domingo'),
      date_trunc('hour', s.stop_at at time zone 'America/Santo_Domingo'),
      interval '1 hour'
    ) gs
    where p_reloj = 'real'
      and gs::date between p_desde and p_hasta
    union all
    select s.fecha_operativa, h.hora
    from sesiones s
    cross join lateral generate_series(
      extract(hour from s.start_at at time zone 'America/Santo_Domingo')::int,
      case
        when (s.stop_at at time zone 'America/Santo_Domingo')::date > s.fecha_operativa then 23
        else greatest(
          extract(hour from s.start_at at time zone 'America/Santo_Domingo')::int,
          extract(hour from s.stop_at at time zone 'America/Santo_Domingo')::int
        )
      end
    ) as h(hora)
    where p_reloj is distinct from 'real'
      and h.hora between 0 and 23
  ),
  ocurrencias as (
    select a.hora, count(distinct a.fecha)::int as ocurrencias
    from abiertas a
    group by a.hora
  ),
  ventas as (
    select
      extract(hour from (o.fecha at time zone 'America/Santo_Domingo'))::int as hora,
      count(distinct o.id)::int as n_ordenes,
      round(sum(coalesce(l.subtotal_con_itbis, l.subtotal, 0)), 2) as venta,
      round(sum(l.cantidad), 3) as unidades
    from public.pos_orden_lineas l
    join public.pos_ordenes o on o.id = l.orden_id
    where p_reloj = 'real'
      and o.tienda = p_tienda
      and public.pos_orden_cuenta(o.estado)
      and l.codigo_odoo = p_codigo
      and (o.fecha at time zone 'America/Santo_Domingo')::date between p_desde and p_hasta
    group by 1
    union all
    select
      o.hora_local::int,
      count(distinct o.id)::int,
      round(sum(coalesce(l.subtotal_con_itbis, l.subtotal, 0)), 2),
      round(sum(l.cantidad), 3)
    from public.pos_orden_lineas l
    join public.pos_ordenes o on o.id = l.orden_id
    where p_reloj is distinct from 'real'
      and o.tienda = p_tienda
      and public.pos_orden_cuenta(o.estado)
      and l.codigo_odoo = p_codigo
      and o.fecha_operativa between p_desde and p_hasta
    group by 1
  )
  select
    coalesce(v.hora, o.hora)::smallint,
    coalesce(v.n_ordenes, 0)::int,
    coalesce(v.venta, 0),
    coalesce(v.unidades, 0),
    coalesce(o.ocurrencias, 0)::int
  from ventas v
  full join ocurrencias o on o.hora = v.hora
  where coalesce(v.hora, o.hora) between 0 and 23
  order by 1;
$$;

-- Hallazgos y propuestas ya vinculados al producto. No inventa recomendaciones.
create or replace function public.miles_producto_vinculos(
  p_tienda text,
  p_codigo text,
  p_product_id uuid
)
returns table (
  origen text,
  id uuid,
  titulo text,
  tipo text,
  resumen text,
  periodo_desde date,
  periodo_hasta date,
  estado text,
  actualizado_en timestamptz
)
language sql
stable
set search_path = public
as $$
  select distinct on (origen, id)
    origen, id, titulo, tipo, resumen, periodo_desde, periodo_hasta, estado, actualizado_en
  from (
    select
      'hallazgo'::text as origen,
      h.id,
      h.titulo,
      h.tipo,
      h.resumen,
      h.periodo_desde,
      h.periodo_hasta,
      h.estado,
      h.actualizado_en
    from public.miles_hallazgos h
    where h.tienda = p_tienda
      and p_codigo <> ''
      and position(p_codigo in h.evidencia::text) > 0
    union all
    select
      'hallazgo',
      h.id,
      h.titulo,
      h.tipo,
      h.resumen,
      h.periodo_desde,
      h.periodo_hasta,
      h.estado,
      h.actualizado_en
    from public.miles_propuesta_productos pp
    join public.miles_propuesta_hallazgos ph on ph.propuesta_id = pp.propuesta_id
    join public.miles_hallazgos h on h.id = ph.hallazgo_id
    where p_product_id is not null
      and pp.product_id = p_product_id
      and h.tienda = p_tienda
    union all
    select
      'propuesta',
      p.id,
      p.nombre,
      p.tipo,
      p.objetivo,
      p.periodo_desde,
      p.periodo_hasta,
      p.estado,
      p.actualizado_en
    from public.miles_propuesta_productos pp
    join public.miles_propuestas p on p.id = pp.propuesta_id
    where p_product_id is not null
      and pp.product_id = p_product_id
      and p.tienda = p_tienda
  ) vinculos
  order by origen, id, actualizado_en desc
  limit 12;
$$;

revoke all on function public.consumo_producto_horas_vista(text, text, date, date, text) from public, anon, authenticated;
grant execute on function public.consumo_producto_horas_vista(text, text, date, date, text) to service_role;

revoke all on function public.miles_producto_vinculos(text, text, uuid) from public, anon, authenticated;
grant execute on function public.miles_producto_vinculos(text, text, uuid) to service_role;
