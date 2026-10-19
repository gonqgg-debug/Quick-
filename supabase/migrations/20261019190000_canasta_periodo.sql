-- Censo de pares en un periodo. Misma población que consumo_canasta_par:
-- ticket que cuenta, presencia una vez, devoluciones fuera, sin_codigo fuera.
-- No resume las semanas ya filtradas: un par de 3 y 3 en dos semanas sí entra si el periodo suma 6.

create or replace function public.consumo_canasta_periodo(
  p_tienda text,
  p_desde date,
  p_hasta date,
  p_min_juntos integer,
  p_limit integer,
  p_cursor_juntos integer,
  p_cursor_a text,
  p_cursor_b text,
  p_categoria text
)
returns table (
  producto_a text,
  nombre_a text,
  categoria_a text,
  producto_b text,
  nombre_b text,
  categoria_b text,
  elegibles integer,
  n_a integer,
  n_b integer,
  n_ab integer,
  pares integer
)
language plpgsql
stable
set search_path = public
as $$
begin
  return query
  with elegibles as (
    select o.id
    from public.pos_ordenes o
    where o.tienda = p_tienda
      and public.pos_orden_cuenta(o.estado)
      and o.fecha_operativa between p_desde and p_hasta
  ),
  presencia as (
    select l.orden_id, l.codigo_odoo
    from public.pos_orden_lineas l
    join elegibles e on e.id = l.orden_id
    where coalesce(l.es_devolucion, false) = false
      and l.codigo_odoo not like 'sin_codigo:%'
    group by l.orden_id, l.codigo_odoo
    having sum(l.cantidad) > 0
  ),
  soporte as (
    select codigo_odoo, count(*)::int as n
    from presencia
    group by codigo_odoo
  ),
  pares as (
    select a.codigo_odoo as producto_a, b.codigo_odoo as producto_b, count(*)::int as n_ab
    from presencia a
    join presencia b on a.orden_id = b.orden_id and a.codigo_odoo < b.codigo_odoo
    group by 1, 2
    having count(*) >= greatest(coalesce(p_min_juntos, 5), 2)
  ),
  nombrados as (
    select
      p.producto_a,
      pa.nombre as nombre_a,
      pa.categoria as categoria_a,
      p.producto_b,
      pb.nombre as nombre_b,
      pb.categoria as categoria_b,
      (select count(*)::int from elegibles) as elegibles,
      sa.n as n_a,
      sb.n as n_b,
      p.n_ab
    from pares p
    join soporte sa on sa.codigo_odoo = p.producto_a
    join soporte sb on sb.codigo_odoo = p.producto_b
    left join lateral (
      select pr.nombre, pr.categoria
      from public.products pr
      where pr.codigo_odoo = p.producto_a
      order by pr.id
      limit 1
    ) pa on true
    left join lateral (
      select pr.nombre, pr.categoria
      from public.products pr
      where pr.codigo_odoo = p.producto_b
      order by pr.id
      limit 1
    ) pb on true
    where p_categoria is null
      or btrim(p_categoria) = ''
      or pa.categoria = p_categoria
      or pb.categoria = p_categoria
  ),
  contado as (
    select n.*, count(*) over ()::int as pares
    from nombrados n
  )
  select
    c.producto_a,
    c.nombre_a,
    c.categoria_a,
    c.producto_b,
    c.nombre_b,
    c.categoria_b,
    c.elegibles,
    c.n_a,
    c.n_b,
    c.n_ab,
    c.pares
  from contado c
  where p_cursor_a is null
    or c.n_ab < p_cursor_juntos
    or (c.n_ab = p_cursor_juntos and c.producto_a > p_cursor_a)
    or (c.n_ab = p_cursor_juntos and c.producto_a = p_cursor_a and c.producto_b > p_cursor_b)
  order by c.n_ab desc, c.producto_a, c.producto_b
  limit least(501, greatest(coalesce(p_limit, 50), 1));

  if found or p_cursor_a is not null then
    return;
  end if;

  return query
  select
    null::text,
    null::text,
    null::text,
    null::text,
    null::text,
    null::text,
    (
      select count(*)::int
      from public.pos_ordenes o
      where o.tienda = p_tienda
        and public.pos_orden_cuenta(o.estado)
        and o.fecha_operativa between p_desde and p_hasta
    ),
    null::int,
    null::int,
    null::int,
    0;
end;
$$;

revoke all on function public.consumo_canasta_periodo(text, date, date, integer, integer, integer, text, text, text) from public, anon, authenticated;
grant execute on function public.consumo_canasta_periodo(text, date, date, integer, integer, integer, text, text, text) to service_role;
