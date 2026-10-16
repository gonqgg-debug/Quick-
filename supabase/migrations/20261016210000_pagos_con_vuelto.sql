-- El vuelto de Odoo (pos.payment is_change, es_cambio) es un pago en efectivo con monto negativo.
-- El desglose suma todos los pagos con su signo. Excluirlo inflaba el efectivo por encima de la venta.

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


-- Recalcula el mix ya guardado. No reimporta órdenes ni toca ventas, costos ni líneas.
update public.resumen_dia r
set
  efectivo = coalesce(m.efectivo, 0),
  banco = coalesce(m.banco, 0),
  tarjeta = coalesce(m.tarjeta, 0),
  credito = coalesce(m.credito, 0),
  otro = coalesce(m.otro, 0)
from (
  select
    s.tienda,
    s.fecha_operativa as fecha,
    round(coalesce(sum(pg.monto) filter (where pg.metodo = 'efectivo'), 0), 2) as efectivo,
    round(coalesce(sum(pg.monto) filter (where pg.metodo = 'banco'), 0), 2) as banco,
    round(coalesce(sum(pg.monto) filter (where pg.metodo = 'tarjeta'), 0), 2) as tarjeta,
    round(coalesce(sum(pg.monto) filter (where pg.metodo = 'credito'), 0), 2) as credito,
    round(coalesce(sum(pg.monto) filter (where pg.metodo = 'otro'), 0), 2) as otro
  from public.pos_pagos pg
  join public.pos_ordenes op on op.id = pg.orden_id and public.pos_orden_cuenta(op.estado)
  join public.pos_sesiones s on s.id = pg.sesion_id
  group by s.tienda, s.fecha_operativa
) m
where r.tienda = m.tienda
  and r.fecha = m.fecha;
