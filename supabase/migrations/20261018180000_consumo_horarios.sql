-- Horarios: una fila por fecha y hora, con la misma atribución que consumo_mapa_horas.
-- La hora de la venta es extract(hour), el intervalo [hora, hora + 1).
-- Reloj real: fecha y hora de la transacción en America/Santo_Domingo, una sola vez.
-- Reloj caja: fecha_operativa y hora_local, ya grabadas en esa zona.
-- Cobertura completa: la hora cae dentro de una sesión cerrada. No hay horario de tienda configurado.

create or replace function public.consumo_horas_fecha(
  p_tienda text,
  p_desde date,
  p_hasta date,
  p_categoria text,
  p_reloj text,
  p_limit integer default 1000,
  p_offset integer default 0
)
returns table (
  fecha date,
  hora smallint,
  n_ordenes integer,
  venta numeric,
  unidades numeric,
  cobertura text
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
      and s.stop_at is not null
      and s.ingesta = 'cerrada'
      and gs::date between p_desde and p_hasta
    union
    select s.fecha_operativa as fecha, h.hora
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
      and s.stop_at is not null
      and s.ingesta = 'cerrada'
      and h.hora between 0 and 23
  ),
  incompletas as (
    select
      case
        when p_reloj = 'real' then (s.start_at at time zone 'America/Santo_Domingo')::date
        else s.fecha_operativa
      end as fecha,
      extract(hour from s.start_at at time zone 'America/Santo_Domingo')::int as hora
    from sesiones s
    where (s.stop_at is null or s.ingesta = 'parcial')
      and (
        case
          when p_reloj = 'real' then (s.start_at at time zone 'America/Santo_Domingo')::date
          else s.fecha_operativa
        end
      ) between p_desde and p_hasta
  ),
  ventas as (
    select
      (o.fecha at time zone 'America/Santo_Domingo')::date as fecha,
      extract(hour from (o.fecha at time zone 'America/Santo_Domingo'))::int as hora,
      count(distinct o.id)::int as n_ordenes,
      round(sum(o.total), 2) as venta,
      round(coalesce(sum(lu.unidades), 0), 3) as unidades
    from public.pos_ordenes o
    left join (
      select l.orden_id, sum(l.cantidad) as unidades
      from public.pos_orden_lineas l
      join public.pos_ordenes o3 on o3.id = l.orden_id
      where o3.tienda = p_tienda
        and (o3.fecha at time zone 'America/Santo_Domingo')::date between p_desde and p_hasta
      group by l.orden_id
    ) lu on lu.orden_id = o.id
    where p_reloj = 'real'
      and (p_categoria is null or btrim(p_categoria) = '')
      and o.tienda = p_tienda
      and public.pos_orden_cuenta(o.estado)
      and (o.fecha at time zone 'America/Santo_Domingo')::date between p_desde and p_hasta
    group by 1, 2
    union all
    select
      o.fecha_operativa,
      o.hora_local::int,
      count(distinct o.id)::int,
      round(sum(o.total), 2),
      round(coalesce(sum(lu.unidades), 0), 3)
    from public.pos_ordenes o
    left join (
      select l.orden_id, sum(l.cantidad) as unidades
      from public.pos_orden_lineas l
      join public.pos_ordenes o3 on o3.id = l.orden_id
      where o3.tienda = p_tienda
        and o3.fecha_operativa between p_desde and p_hasta
      group by l.orden_id
    ) lu on lu.orden_id = o.id
    where p_reloj is distinct from 'real'
      and (p_categoria is null or btrim(p_categoria) = '')
      and o.tienda = p_tienda
      and public.pos_orden_cuenta(o.estado)
      and o.fecha_operativa between p_desde and p_hasta
    group by 1, 2
    union all
    select
      (o.fecha at time zone 'America/Santo_Domingo')::date,
      extract(hour from (o.fecha at time zone 'America/Santo_Domingo'))::int,
      count(distinct o.id)::int,
      round(sum(coalesce(l.subtotal_con_itbis, l.subtotal, 0)), 2),
      round(sum(l.cantidad), 3)
    from public.pos_orden_lineas l
    join public.pos_ordenes o on o.id = l.orden_id
    left join public.products p on p.id = l.product_id
    where p_reloj = 'real'
      and p_categoria is not null
      and btrim(p_categoria) <> ''
      and o.tienda = p_tienda
      and public.pos_orden_cuenta(o.estado)
      and (o.fecha at time zone 'America/Santo_Domingo')::date between p_desde and p_hasta
      and (
        (p_categoria = 'Sin match' and l.product_id is null)
        or (p_categoria <> 'Sin match' and p.categoria = p_categoria)
      )
    group by 1, 2
    union all
    select
      o.fecha_operativa,
      o.hora_local::int,
      count(distinct o.id)::int,
      round(sum(coalesce(l.subtotal_con_itbis, l.subtotal, 0)), 2),
      round(sum(l.cantidad), 3)
    from public.pos_orden_lineas l
    join public.pos_ordenes o on o.id = l.orden_id
    left join public.products p on p.id = l.product_id
    where p_reloj is distinct from 'real'
      and p_categoria is not null
      and btrim(p_categoria) <> ''
      and o.tienda = p_tienda
      and public.pos_orden_cuenta(o.estado)
      and o.fecha_operativa between p_desde and p_hasta
      and (
        (p_categoria = 'Sin match' and l.product_id is null)
        or (p_categoria <> 'Sin match' and p.categoria = p_categoria)
      )
    group by 1, 2
  ),
  claves as (
    select fecha, hora from abiertas
    union
    select fecha, hora from incompletas
    union
    select fecha, hora from ventas
  ),
  filas as (
    select
      c.fecha,
      c.hora::smallint as hora,
      coalesce(v.n_ordenes, 0)::int as n_ordenes,
      coalesce(v.venta, 0) as venta,
      coalesce(v.unidades, 0) as unidades,
      case
        when exists (select 1 from abiertas a where a.fecha = c.fecha and a.hora = c.hora) then 'completa'
        when exists (select 1 from incompletas i where i.fecha = c.fecha and i.hora = c.hora) then 'parcial'
        else 'desconocida'
      end as cobertura
    from claves c
    left join ventas v on v.fecha = c.fecha and v.hora = c.hora
  )
  select filas.fecha, filas.hora, filas.n_ordenes, filas.venta, filas.unidades, filas.cobertura
  from filas
  order by filas.fecha, filas.hora
  limit greatest(coalesce(p_limit, 1000), 0)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.consumo_productos_franja(
  p_tienda text,
  p_desde date,
  p_hasta date,
  p_categoria text,
  p_reloj text,
  p_dow integer,
  p_hora integer,
  p_limit integer default 200
)
returns table (
  codigo text,
  product_id uuid,
  nombre text,
  unidades numeric,
  venta numeric,
  n_ordenes integer
)
language sql
stable
set search_path = public
as $$
  select
    l.codigo_odoo,
    (array_agg(l.product_id) filter (where l.product_id is not null))[1],
    coalesce(max(p.nombre), max(l.nombre_odoo), l.codigo_odoo),
    round(sum(l.cantidad), 3),
    round(sum(coalesce(l.subtotal_con_itbis, l.subtotal, 0)), 2),
    count(distinct o.id)::int
  from public.pos_orden_lineas l
  join public.pos_ordenes o on o.id = l.orden_id
  left join public.products p on p.id = l.product_id
  where o.tienda = p_tienda
    and public.pos_orden_cuenta(o.estado)
    and p_dow between 1 and 7
    and p_hora between 0 and 23
    and (
      (
        p_reloj = 'real'
        and (o.fecha at time zone 'America/Santo_Domingo')::date between p_desde and p_hasta
        and extract(isodow from (o.fecha at time zone 'America/Santo_Domingo'))::int = p_dow
        and extract(hour from (o.fecha at time zone 'America/Santo_Domingo'))::int = p_hora
      )
      or (
        p_reloj is distinct from 'real'
        and o.fecha_operativa between p_desde and p_hasta
        and o.dow::int = p_dow
        and o.hora_local::int = p_hora
      )
    )
    and (
      p_categoria is null
      or btrim(p_categoria) = ''
      or (p_categoria = 'Sin match' and l.product_id is null)
      or (p_categoria <> 'Sin match' and p.categoria = p_categoria)
    )
  group by l.codigo_odoo
  order by sum(coalesce(l.subtotal_con_itbis, l.subtotal, 0)) desc, l.codigo_odoo
  limit least(greatest(coalesce(p_limit, 200), 1), 201);
$$;

-- Transacciones del periodo agrupadas por el turno de la sesión que las contiene.
-- El turno sale de la hora de apertura de la caja, no de un corte de las ventas a las 2:00 p. m.
create or replace function public.consumo_turnos_periodo(
  p_tienda text,
  p_desde date,
  p_hasta date,
  p_categoria text,
  p_reloj text
)
returns table (
  turno text,
  n_ordenes integer,
  venta numeric,
  unidades numeric,
  n_sesiones integer,
  apertura_min timestamptz,
  apertura_max timestamptz,
  cierre_min timestamptz,
  cierre_max timestamptz
)
language sql
stable
set search_path = public
as $$
  with ordenes as (
    select o.id, o.total, o.sesion_id
    from public.pos_ordenes o
    where o.tienda = p_tienda
      and public.pos_orden_cuenta(o.estado)
      and (
        (p_reloj = 'real' and (o.fecha at time zone 'America/Santo_Domingo')::date between p_desde and p_hasta)
        or (p_reloj is distinct from 'real' and o.fecha_operativa between p_desde and p_hasta)
      )
  ),
  lineas as (
    select
      o.id as orden_id,
      round(sum(coalesce(l.subtotal_con_itbis, l.subtotal, 0)), 2) as venta,
      round(sum(l.cantidad), 3) as unidades
    from ordenes o
    join public.pos_orden_lineas l on l.orden_id = o.id
    left join public.products p on p.id = l.product_id
    where p_categoria is null
      or btrim(p_categoria) = ''
      or (p_categoria = 'Sin match' and l.product_id is null)
      or (p_categoria <> 'Sin match' and p.categoria = p_categoria)
    group by o.id
  ),
  base as (
    select
      s.turno,
      o.id as orden_id,
      s.id as sesion_id,
      s.start_at,
      s.stop_at,
      case
        when p_categoria is null or btrim(p_categoria) = '' then o.total
        else ln.venta
      end as venta,
      coalesce(ln.unidades, 0) as unidades
    from ordenes o
    join public.pos_sesiones s on s.id = o.sesion_id
    left join lineas ln on ln.orden_id = o.id
    where s.turno in ('am', 'pm')
      and (
        p_categoria is null
        or btrim(p_categoria) = ''
        or ln.orden_id is not null
      )
  )
  select
    b.turno,
    count(distinct b.orden_id)::int,
    round(coalesce(sum(b.venta), 0), 2),
    round(coalesce(sum(b.unidades), 0), 3),
    count(distinct b.sesion_id)::int,
    min(b.start_at),
    max(b.start_at),
    min(b.stop_at),
    max(b.stop_at)
  from base b
  group by b.turno;
$$;

grant execute on function public.consumo_horas_fecha(text, date, date, text, text, integer, integer) to service_role;
grant execute on function public.consumo_productos_franja(text, date, date, text, text, integer, integer, integer) to service_role;
grant execute on function public.consumo_turnos_periodo(text, date, date, text, text) to service_role;
