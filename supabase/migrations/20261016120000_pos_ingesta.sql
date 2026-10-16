-- POS de Odoo como detalle de venta. La plataforma no escribe en Odoo.
-- Categoría y costo salen del catálogo y de las facturas de compra, nunca del POS.
-- El costo (costo_manual y factura_lineas.costo_unitario) se guarda SIN ITBIS.
-- El precio de venta ya incluye ITBIS. La tasa es la de la línea, si vino, y si no la de products.tasa_itbis.

create table if not exists public.pos_sesiones (
  id bigserial primary key,
  tienda text not null default 'quick',
  odoo_id int not null,
  nombre text not null,
  odoo_config_id int,
  estado text not null,
  start_at timestamptz not null,
  stop_at timestamptz,
  fecha_operativa date not null,
  turno text not null,
  total_pagos numeric(12, 2),
  efectivo_inicial numeric(12, 2),
  efectivo_final numeric(12, 2),
  suma_ordenes numeric(12, 2),
  suma_pagos numeric(12, 2),
  descuadrada boolean not null default false,
  odoo_write_date timestamptz,
  ingested_at timestamptz not null default now(),
  unique (tienda, odoo_id),
  constraint pos_sesiones_estado_check check (estado = 'closed'),
  constraint pos_sesiones_turno_check check (turno in ('am', 'pm'))
);

create table if not exists public.pos_ordenes (
  id bigserial primary key,
  tienda text not null default 'quick',
  odoo_id int not null,
  sesion_id bigint not null references public.pos_sesiones (id) on delete cascade,
  nombre text,
  pos_reference text,
  fecha timestamptz not null,
  fecha_operativa date not null,
  hora_local smallint not null,
  dow smallint not null,
  total numeric(12, 2) not null,
  impuesto numeric(12, 2),
  pagado numeric(12, 2),
  cambio numeric(12, 2),
  estado text,
  ncf text,
  cliente_odoo_id int,
  empleado_odoo_id int,
  n_lineas int,
  es_devolucion boolean not null default false,
  lote_id text,
  unique (tienda, odoo_id),
  constraint pos_ordenes_hora_check check (hora_local between 0 and 23),
  constraint pos_ordenes_dow_check check (dow between 1 and 7)
);

create table if not exists public.pos_orden_lineas (
  id bigserial primary key,
  tienda text not null default 'quick',
  odoo_id int not null,
  orden_id bigint not null references public.pos_ordenes (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  odoo_product_id int not null,
  odoo_tmpl_id int,
  codigo_odoo text not null,
  nombre_odoo text,
  match_estado text not null default 'sin_match',
  cantidad numeric(12, 3) not null,
  precio_unit numeric(12, 2),
  descuento numeric(6, 2),
  subtotal numeric(12, 2),
  subtotal_con_itbis numeric(12, 2),
  es_devolucion boolean not null default false,
  odoo_refunded_line_id int,
  tasa_itbis numeric(4, 2),
  unique (tienda, odoo_id),
  constraint pos_orden_lineas_tasa_check check (tasa_itbis is null or tasa_itbis in (0, 16, 18)),
  constraint pos_orden_lineas_match_check check (match_estado in ('match', 'sin_match'))
);

create table if not exists public.pos_pagos (
  id bigserial primary key,
  tienda text not null default 'quick',
  odoo_id int not null,
  orden_id bigint references public.pos_ordenes (id) on delete cascade,
  sesion_id bigint references public.pos_sesiones (id) on delete cascade,
  metodo_odoo_id int,
  metodo text not null,
  metodo_original text,
  monto numeric(12, 2) not null,
  fecha timestamptz,
  es_cambio boolean not null default false,
  tipo_tarjeta text,
  unique (tienda, odoo_id),
  constraint pos_pagos_metodo_check check (metodo in ('efectivo', 'banco', 'credito', 'tarjeta', 'otro'))
);

create table if not exists public.resumen_producto_dia (
  tienda text not null default 'quick',
  fecha date not null,
  codigo_odoo text not null,
  product_id uuid,
  nombre text,
  unidades numeric(12, 3) not null,
  venta numeric(12, 2) not null,
  venta_neta numeric(12, 2) not null default 0,
  n_ordenes int not null,
  primary key (tienda, fecha, codigo_odoo)
);

create table if not exists public.resumen_hora_dia (
  tienda text not null default 'quick',
  fecha date not null,
  hora smallint not null,
  dow smallint not null,
  n_ordenes int not null,
  venta numeric(12, 2) not null,
  unidades numeric(12, 3) not null,
  primary key (tienda, fecha, hora),
  constraint resumen_hora_dia_hora_check check (hora between 0 and 23),
  constraint resumen_hora_dia_dow_check check (dow between 1 and 7)
);

create table if not exists public.resumen_hora_categoria_dia (
  tienda text not null default 'quick',
  fecha date not null,
  hora smallint not null,
  dow smallint not null,
  categoria text not null,
  n_ordenes int not null,
  venta numeric(12, 2) not null,
  unidades numeric(12, 3) not null,
  primary key (tienda, fecha, hora, categoria),
  constraint resumen_hora_categoria_hora_check check (hora between 0 and 23),
  constraint resumen_hora_categoria_dow_check check (dow between 1 and 7)
);

create table if not exists public.resumen_categoria_dia (
  tienda text not null default 'quick',
  fecha date not null,
  categoria text not null,
  unidades numeric(12, 3) not null,
  venta numeric(12, 2) not null,
  primary key (tienda, fecha, categoria)
);

create table if not exists public.resumen_dia (
  tienda text not null default 'quick',
  fecha date not null,
  n_ordenes int not null,
  venta numeric(12, 2) not null,
  ticket_promedio numeric(12, 2),
  unidades_por_ticket numeric(12, 3),
  unidades numeric(12, 3) not null,
  efectivo numeric(12, 2) not null default 0,
  banco numeric(12, 2) not null default 0,
  tarjeta numeric(12, 2) not null default 0,
  credito numeric(12, 2) not null default 0,
  otro numeric(12, 2) not null default 0,
  primary key (tienda, fecha)
);

create table if not exists public.resumen_turno_dia (
  tienda text not null default 'quick',
  fecha date not null,
  turno text not null,
  n_ordenes int not null,
  venta numeric(12, 2) not null,
  ticket_promedio numeric(12, 2),
  unidades_por_ticket numeric(12, 3),
  unidades numeric(12, 3) not null,
  primary key (tienda, fecha, turno),
  constraint resumen_turno_dia_turno_check check (turno in ('am', 'pm'))
);

create table if not exists public.resumen_canasta_semana (
  tienda text not null default 'quick',
  semana date not null,
  producto_a text not null,
  producto_b text not null,
  n_ordenes_juntos int not null,
  soporte numeric(12, 6) not null,
  lift numeric(12, 4),
  n_ordenes_semana int not null,
  primary key (tienda, semana, producto_a, producto_b),
  constraint resumen_canasta_par_check check (producto_a < producto_b)
);

create index if not exists idx_pos_ordenes_tienda_fecha on public.pos_ordenes (tienda, fecha_operativa);
create index if not exists idx_pos_ordenes_sesion on public.pos_ordenes (sesion_id);
create index if not exists idx_pos_ordenes_fecha_hora on public.pos_ordenes (tienda, fecha_operativa, hora_local);
create index if not exists idx_pos_orden_lineas_orden on public.pos_orden_lineas (orden_id);
create index if not exists idx_pos_orden_lineas_codigo on public.pos_orden_lineas (tienda, codigo_odoo);
create index if not exists idx_pos_orden_lineas_producto on public.pos_orden_lineas (product_id);
create index if not exists idx_pos_orden_lineas_sin_match
  on public.pos_orden_lineas (tienda, codigo_odoo)
  where match_estado = 'sin_match';
create index if not exists idx_pos_pagos_sesion on public.pos_pagos (sesion_id);
create index if not exists idx_pos_pagos_orden on public.pos_pagos (orden_id);
create index if not exists idx_pos_sesiones_tienda_fecha on public.pos_sesiones (tienda, fecha_operativa);
create index if not exists idx_pos_sesiones_fecha_turno on public.pos_sesiones (tienda, fecha_operativa, turno);
create index if not exists idx_pos_sesiones_descuadrada
  on public.pos_sesiones (tienda, fecha_operativa)
  where descuadrada;
create index if not exists idx_resumen_producto_dia_producto on public.resumen_producto_dia (product_id, fecha);
create index if not exists idx_resumen_canasta_lift on public.resumen_canasta_semana (tienda, semana, lift desc);

do $$
begin
  if to_regclass('public.ventas_diarias') is not null then
    alter table public.ventas_diarias
      add column if not exists origen text,
      add column if not exists override_manual boolean not null default false,
      add column if not exists venta_pos numeric(12, 2),
      add column if not exists pos_actualizada_en timestamptz,
      add column if not exists alerta_pos boolean not null default false;
    update public.ventas_diarias
      set override_manual = true
      where override_manual is distinct from true;
    alter table public.ventas_diarias drop constraint if exists ventas_diarias_origen_check;
    alter table public.ventas_diarias
      add constraint ventas_diarias_origen_check
      check (origen is null or origen in ('manual', 'pos'));
  end if;
end $$;

alter table public.products
  add column if not exists tasa_itbis numeric(4, 2) not null default 18;

alter table public.products drop constraint if exists products_tasa_itbis_check;
alter table public.products
  add constraint products_tasa_itbis_check
  check (tasa_itbis in (0, 16, 18));

comment on column public.products.tasa_itbis is
  'ITBIS incluido en el precio de venta: 0, 16 o 18. El costo_manual no lo incluye.';

comment on column public.products.costo_manual is
  'Costo por unidad de venta, sin ITBIS.';

do $$
begin
  if to_regclass('public.factura_lineas') is not null then
    execute $c$comment on column public.factura_lineas.costo_unitario is
      'Costo por unidad de venta, sin ITBIS. No es el precio de la caja.'$c$;
  end if;
end $$;

create table if not exists public.pos_rematch_cola (
  codigo_odoo text primary key,
  despues_de bigint not null default 0,
  encolado_en timestamptz not null default now()
);

create or replace function public.pos_orden_cuenta(p_estado text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select lower(btrim(coalesce(p_estado, ''))) in ('paid', 'done', 'invoiced')
$$;

create or replace function public.pos_dia_semana(p_fecha date)
returns text
language sql
immutable
set search_path = public
as $$
  select case extract(isodow from p_fecha)::int
    when 1 then 'lunes'
    when 2 then 'martes'
    when 3 then 'miércoles'
    when 4 then 'jueves'
    when 5 then 'viernes'
    when 6 then 'sábado'
    when 7 then 'domingo'
  end
$$;

create or replace function public.pos_metodo_canon(p_nombre text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when lower(btrim(coalesce(p_nombre, ''))) in ('efectivo', 'banco', 'credito', 'tarjeta', 'otro') then lower(btrim(p_nombre))
    when lower(coalesce(p_nombre, '')) like '%cardnet%' or lower(coalesce(p_nombre, '')) like '%tarjeta%' then 'tarjeta'
    when lower(coalesce(p_nombre, '')) like '%cuenta%'
      or lower(coalesce(p_nombre, '')) like '%credit%'
      or lower(coalesce(p_nombre, '')) like '%crédit%' then 'credito'
    when lower(coalesce(p_nombre, '')) like '%efectivo%' then 'efectivo'
    when lower(coalesce(p_nombre, '')) like '%banco%' then 'banco'
    else 'otro'
  end
$$;

create or replace view public.costo_producto_vigente
with (security_invoker = true) as
with manual as (
  select
    p.id as product_id,
    p.costo_manual as costo_unit,
    'manual'::text as origen,
    p.costo_manual_en as fecha,
    p.costo_manual_fuente as ref
  from public.products p
  where p.costo_manual is not null
),
factura as (
  select distinct on (l.producto_id)
    l.producto_id as product_id,
    l.costo_unitario as costo_unit,
    'factura'::text as origen,
    coalesce(f.fecha_emision::timestamptz, f.recibido_en) as fecha,
    f.id::text as ref
  from public.factura_lineas l
  join public.facturas f on f.id = l.factura_id
  where l.producto_id is not null
    and l.costo_unitario is not null
    and f.tipo_documento <> 'nota_credito'
  order by l.producto_id, f.fecha_emision desc nulls last, f.recibido_en desc nulls last, l.id desc
)
select * from manual
union all
select factura.*
from factura
where not exists (
  select 1 from manual where manual.product_id = factura.product_id
);

create or replace function public.refrescar_canasta(p_tienda text, p_semana date)
returns void
language plpgsql
set search_path = public
as $$
begin
  delete from public.resumen_canasta_semana
  where tienda = p_tienda and semana = p_semana;

  insert into public.resumen_canasta_semana (
    tienda, semana, producto_a, producto_b, n_ordenes_juntos, soporte, lift, n_ordenes_semana
  )
  with orden_prod as (
    select distinct o.id as orden_id, l.codigo_odoo
    from public.pos_ordenes o
    join public.pos_orden_lineas l on l.orden_id = o.id
    where o.tienda = p_tienda
      and public.pos_orden_cuenta(o.estado)
      and o.fecha_operativa >= p_semana
      and o.fecha_operativa < p_semana + 7
      and l.cantidad > 0
      and l.codigo_odoo not like 'sin_codigo:%'
  ),
  n as (
    select count(distinct orden_id)::numeric as n_ordenes from orden_prod
  ),
  soporte_prod as (
    select codigo_odoo, count(distinct orden_id)::numeric as n
    from orden_prod
    group by codigo_odoo
  ),
  pares as (
    select a.codigo_odoo as producto_a, b.codigo_odoo as producto_b, count(*)::int as n_juntos
    from orden_prod a
    join orden_prod b on a.orden_id = b.orden_id and a.codigo_odoo < b.codigo_odoo
    group by a.codigo_odoo, b.codigo_odoo
    having count(*) >= 5
  )
  select
    p_tienda,
    p_semana,
    pares.producto_a,
    pares.producto_b,
    pares.n_juntos,
    round(pares.n_juntos / n.n_ordenes, 6),
    round((pares.n_juntos * n.n_ordenes) / nullif(sa.n * sb.n, 0), 4),
    n.n_ordenes::int
  from pares
  cross join n
  join soporte_prod sa on sa.codigo_odoo = pares.producto_a
  join soporte_prod sb on sb.codigo_odoo = pares.producto_b
  where n.n_ordenes > 0;
end;
$$;

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
  insert into public.resumen_producto_dia (tienda, fecha, codigo_odoo, product_id, nombre, unidades, venta, venta_neta, n_ordenes)
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

create or replace function public.refrescar_resumenes(p_tienda text, p_fecha date)
returns void
language plpgsql
set search_path = public
as $$
begin
  perform public.refrescar_resumenes_fechas(p_tienda, array[p_fecha]);
end;
$$;

create or replace function public.rematch_lineas(p_codigo text)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_codigo text := nullif(btrim(p_codigo), '');
  v_n integer := 0;
  v_tienda text;
  v_fechas date[];
begin
  if v_codigo is null then
    return 0;
  end if;

  with upd as (
    update public.pos_orden_lineas l
    set
      product_id = p.id,
      match_estado = case when p.id is null then 'sin_match' else 'match' end
    from public.pos_orden_lineas src
    left join public.products p on p.codigo_odoo = src.codigo_odoo
    where l.id = src.id
      and src.codigo_odoo = v_codigo
      and (
        l.product_id is distinct from p.id
        or l.match_estado is distinct from case when p.id is null then 'sin_match' else 'match' end
      )
    returning l.id
  )
  select count(*)::int into v_n from upd;

  for v_tienda in
    select distinct o.tienda
    from public.pos_orden_lineas l
    join public.pos_ordenes o on o.id = l.orden_id
    where l.codigo_odoo = v_codigo
  loop
    select array_agg(distinct o.fecha_operativa)
    into v_fechas
    from public.pos_orden_lineas l
    join public.pos_ordenes o on o.id = l.orden_id
    where l.codigo_odoo = v_codigo
      and o.tienda = v_tienda;
    perform public.refrescar_resumenes_fechas(v_tienda, v_fechas);
  end loop;

  return v_n;
end;
$$;

create or replace function public.trg_products_rematch_codigo()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.codigo_odoo is not null then
      insert into public.pos_rematch_cola (codigo_odoo)
      values (old.codigo_odoo)
      on conflict (codigo_odoo) do update
      set despues_de = 0, encolado_en = now();
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' and old.codigo_odoo is distinct from new.codigo_odoo and old.codigo_odoo is not null then
    insert into public.pos_rematch_cola (codigo_odoo)
    values (old.codigo_odoo)
    on conflict (codigo_odoo) do update
    set despues_de = 0, encolado_en = now();
  end if;
  if new.codigo_odoo is not null and (tg_op = 'INSERT' or old.codigo_odoo is distinct from new.codigo_odoo) then
    insert into public.pos_rematch_cola (codigo_odoo)
    values (new.codigo_odoo)
    on conflict (codigo_odoo) do update
    set despues_de = 0, encolado_en = now();
  end if;
  return new;
end;
$$;

create or replace function public.procesar_pos_rematch(p_limite integer)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_limite integer := least(500, greatest(coalesce(p_limite, 500), 1));
  v_n integer := 0;
  v_queda integer := 0;
  v_tienda text;
  v_fechas date[];
begin
  drop table if exists tmp_pos_rematch;
  create temp table tmp_pos_rematch (
    id bigint primary key,
    codigo text not null,
    orden_id bigint not null
  ) on commit drop;

  insert into tmp_pos_rematch (id, codigo, orden_id)
  select l.id, l.codigo_odoo, l.orden_id
  from public.pos_orden_lineas l
  join public.pos_rematch_cola c on c.codigo_odoo = l.codigo_odoo
  where l.id > c.despues_de
  order by l.id
  limit v_limite;

  select count(*)::int into v_n from tmp_pos_rematch;

  update public.pos_orden_lineas l
  set
    product_id = p.id,
    match_estado = case when p.id is null then 'sin_match' else 'match' end
  from tmp_pos_rematch t
  left join public.products p on p.codigo_odoo = t.codigo
  where l.id = t.id
    and (
      l.product_id is distinct from p.id
      or l.match_estado is distinct from case when p.id is null then 'sin_match' else 'match' end
    );

  update public.pos_rematch_cola c
  set despues_de = m.max_id
  from (
    select codigo, max(id) as max_id
    from tmp_pos_rematch
    group by codigo
  ) m
  where c.codigo_odoo = m.codigo;

  delete from public.pos_rematch_cola c
  where not exists (
    select 1
    from public.pos_orden_lineas l
    where l.codigo_odoo = c.codigo_odoo
      and l.id > c.despues_de
  );

  for v_tienda in
    select distinct o.tienda
    from tmp_pos_rematch t
    join public.pos_ordenes o on o.id = t.orden_id
  loop
    select array_agg(distinct o.fecha_operativa)
    into v_fechas
    from tmp_pos_rematch t
    join public.pos_ordenes o on o.id = t.orden_id
    where o.tienda = v_tienda;
    perform public.refrescar_resumenes_fechas(v_tienda, v_fechas);
  end loop;

  select count(*)::int into v_queda
  from public.pos_orden_lineas l
  join public.pos_rematch_cola c on c.codigo_odoo = l.codigo_odoo
  where l.id > c.despues_de;

  return jsonb_build_object('procesadas', v_n, 'pendientes', v_queda);
end;
$$;

drop trigger if exists products_rematch_codigo on public.products;
create trigger products_rematch_codigo
after insert or update of codigo_odoo or delete on public.products
for each row
execute function public.trg_products_rematch_codigo();

create or replace function public.ingestar_pos_sesion(p_payload jsonb)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_tienda text := coalesce(nullif(btrim(p_payload->>'tienda'), ''), 'quick');
  v_estado text := lower(btrim(coalesce(p_payload#>>'{sesion,estado}', '')));
  v_odoo_id int := (p_payload#>>'{sesion,odooId}')::int;
  v_start timestamptz := (p_payload#>>'{sesion,startAt}')::timestamptz;
  v_fecha date;
  v_fecha_anterior date;
  v_turno text;
  v_sesion_id bigint;
  v_existia boolean := false;
  v_ordenes_ins int := 0;
  v_ordenes_upd int := 0;
  v_lineas_ins int := 0;
  v_lineas_upd int := 0;
  v_pagos_ins int := 0;
  v_pagos_upd int := 0;
  v_ordenes_borradas int := 0;
  v_lineas_borradas int := 0;
  v_pagos_borrados int := 0;
  v_suma_ordenes numeric(12, 2) := 0;
  v_suma_pagos numeric(12, 2) := 0;
  v_total numeric(12, 2);
  v_alerta boolean := false;
  v_sin_match int := 0;
  v_venta_dia numeric(12, 2) := 0;
  v_venta_real numeric(12, 2);
  v_origen text;
  v_override boolean := false;
  v_hora int;
  v_modo text := lower(btrim(coalesce(p_payload->>'modo', 'completo')));
  v_lote text := nullif(btrim(p_payload->>'loteId'), '');
begin
  if v_modo not in ('completo', 'parcial', 'final') then
    raise exception using errcode = '22023', message = 'modo tiene que ser completo, parcial o final', hint = 'modo';
  end if;
  if v_modo in ('parcial', 'final') and v_lote is null then
    raise exception using errcode = '22023', message = 'Una sesión en partes necesita loteId', hint = 'loteId';
  end if;
  if v_odoo_id is null or v_start is null then
    raise exception using errcode = '22023', message = 'La sesión necesita odooId y startAt', hint = 'sesion';
  end if;

  if v_estado is distinct from 'closed' then
    return jsonb_build_object(
      'tienda', v_tienda,
      'ignoradas', jsonb_build_array(jsonb_build_object('odooId', v_odoo_id, 'estado', v_estado)),
      'sesion', null,
      'insertados', jsonb_build_object('sesiones', 0, 'ordenes', 0, 'lineas', 0, 'pagos', 0),
      'actualizados', jsonb_build_object('sesiones', 0, 'ordenes', 0, 'lineas', 0, 'pagos', 0),
      'borrados', jsonb_build_object('ordenes', 0, 'lineas', 0, 'pagos', 0),
      'sinMatch', 0,
      'totalSesion', null,
      'sumaOrdenes', 0,
      'sumaPagos', 0,
      'alerta', false,
      'ventaDia', null
    );
  end if;

  v_fecha := (v_start at time zone 'America/Santo_Domingo')::date;
  v_hora := extract(hour from v_start at time zone 'America/Santo_Domingo')::int;
  v_turno := case when v_hora < 14 then 'am' else 'pm' end;

  select id, fecha_operativa into v_sesion_id, v_fecha_anterior
  from public.pos_sesiones
  where tienda = v_tienda and odoo_id = v_odoo_id;
  v_existia := v_sesion_id is not null;

  insert into public.pos_sesiones (
    tienda, odoo_id, nombre, odoo_config_id, estado, start_at, stop_at, fecha_operativa, turno,
    total_pagos, efectivo_inicial, efectivo_final, odoo_write_date, ingested_at
  )
  values (
    v_tienda,
    v_odoo_id,
    coalesce(nullif(btrim(p_payload#>>'{sesion,nombre}'), ''), 'POS/' || v_odoo_id::text),
    nullif(p_payload#>>'{sesion,odooConfigId}', '')::int,
    'closed',
    v_start,
    nullif(p_payload#>>'{sesion,stopAt}', '')::timestamptz,
    v_fecha,
    v_turno,
    round(nullif(p_payload#>>'{sesion,totalPagos}', '')::numeric, 2),
    round(nullif(p_payload#>>'{sesion,efectivoInicial}', '')::numeric, 2),
    round(nullif(p_payload#>>'{sesion,efectivoFinal}', '')::numeric, 2),
    nullif(p_payload#>>'{sesion,odooWriteDate}', '')::timestamptz,
    now()
  )
  on conflict (tienda, odoo_id) do update set
    nombre = excluded.nombre,
    odoo_config_id = excluded.odoo_config_id,
    estado = excluded.estado,
    start_at = excluded.start_at,
    stop_at = excluded.stop_at,
    fecha_operativa = excluded.fecha_operativa,
    turno = excluded.turno,
    total_pagos = excluded.total_pagos,
    efectivo_inicial = excluded.efectivo_inicial,
    efectivo_final = excluded.efectivo_final,
    odoo_write_date = excluded.odoo_write_date,
    ingested_at = now()
  returning id into v_sesion_id;

  drop table if exists tmp_pos_ordenes;
  create temp table tmp_pos_ordenes (
    odoo_id int primary key,
    nombre text,
    pos_reference text,
    fecha timestamptz not null,
    total numeric(12, 2) not null,
    impuesto numeric(12, 2),
    pagado numeric(12, 2),
    cambio numeric(12, 2),
    estado text,
    ncf text,
    cliente_odoo_id int,
    empleado_odoo_id int,
    n_lineas int not null,
    lineas jsonb not null,
    pagos jsonb not null
  ) on commit drop;

  insert into tmp_pos_ordenes
  select
    (o->>'odooId')::int,
    nullif(btrim(o->>'nombre'), ''),
    nullif(btrim(o->>'posReference'), ''),
    (o->>'fecha')::timestamptz,
    round((o->>'total')::numeric, 2),
    round(nullif(o->>'impuesto', '')::numeric, 2),
    round(nullif(o->>'pagado', '')::numeric, 2),
    round(nullif(o->>'cambio', '')::numeric, 2),
    nullif(btrim(o->>'estado'), ''),
    nullif(btrim(o->>'ncf'), ''),
    nullif(o->>'clienteOdooId', '')::int,
    nullif(o->>'empleadoOdooId', '')::int,
    coalesce(jsonb_array_length(o->'lineas'), 0),
    coalesce(o->'lineas', '[]'::jsonb),
    coalesce(o->'pagos', '[]'::jsonb)
  from jsonb_array_elements(coalesce(p_payload->'ordenes', '[]'::jsonb)) o;

  if v_modo = 'parcial' then
    v_ordenes_borradas := 0;
  elsif v_modo = 'final' then
    with borradas as (
      delete from public.pos_ordenes
      where sesion_id = v_sesion_id
        and lote_id is distinct from v_lote
      returning id
    )
    select count(*)::int into v_ordenes_borradas from borradas;
  else
    with borradas as (
      delete from public.pos_ordenes
      where sesion_id = v_sesion_id
        and odoo_id not in (select odoo_id from tmp_pos_ordenes)
      returning id
    )
    select count(*)::int into v_ordenes_borradas from borradas;
  end if;

  with upserted as (
    insert into public.pos_ordenes (
      tienda, odoo_id, sesion_id, nombre, pos_reference, fecha, fecha_operativa, hora_local, dow,
      total, impuesto, pagado, cambio, estado, ncf, cliente_odoo_id, empleado_odoo_id, n_lineas, es_devolucion, lote_id
    )
    select
      v_tienda,
      t.odoo_id,
      v_sesion_id,
      t.nombre,
      t.pos_reference,
      t.fecha,
      v_fecha,
      extract(hour from t.fecha at time zone 'America/Santo_Domingo')::smallint,
      extract(isodow from v_fecha)::smallint,
      t.total,
      t.impuesto,
      t.pagado,
      t.cambio,
      t.estado,
      t.ncf,
      t.cliente_odoo_id,
      t.empleado_odoo_id,
      t.n_lineas,
      t.total < 0,
      v_lote
    from tmp_pos_ordenes t
    on conflict (tienda, odoo_id) do update set
      sesion_id = excluded.sesion_id,
      nombre = excluded.nombre,
      pos_reference = excluded.pos_reference,
      fecha = excluded.fecha,
      fecha_operativa = excluded.fecha_operativa,
      hora_local = excluded.hora_local,
      dow = excluded.dow,
      total = excluded.total,
      impuesto = excluded.impuesto,
      pagado = excluded.pagado,
      cambio = excluded.cambio,
      estado = excluded.estado,
      ncf = excluded.ncf,
      cliente_odoo_id = excluded.cliente_odoo_id,
      empleado_odoo_id = excluded.empleado_odoo_id,
      n_lineas = excluded.n_lineas,
      es_devolucion = excluded.es_devolucion,
      lote_id = excluded.lote_id
    returning (xmax = 0) as inserted
  )
  select
    count(*) filter (where inserted)::int,
    count(*) filter (where not inserted)::int
  into v_ordenes_ins, v_ordenes_upd
  from upserted;

  drop table if exists tmp_pos_lineas;
  create temp table tmp_pos_lineas (
    odoo_id int primary key,
    orden_odoo_id int not null,
    odoo_product_id int not null,
    odoo_tmpl_id int,
    codigo_odoo text not null,
    nombre_odoo text,
    cantidad numeric(12, 3) not null,
    precio_unit numeric(12, 2),
    descuento numeric(6, 2),
    subtotal numeric(12, 2),
    subtotal_con_itbis numeric(12, 2),
    odoo_refunded_line_id int,
    tasa_itbis numeric(4, 2)
  ) on commit drop;

  insert into tmp_pos_lineas
  select
    (l->>'odooId')::int,
    t.odoo_id,
    (l->>'odooProductId')::int,
    nullif(l->>'odooTmplId', '')::int,
    case
      when nullif(btrim(l->>'codigoOdoo'), '') is not null then btrim(l->>'codigoOdoo')
      else 'sin_codigo:' || (l->>'odooProductId')
    end,
    nullif(btrim(l->>'nombreOdoo'), ''),
    round((l->>'cantidad')::numeric, 3),
    round(nullif(l->>'precioUnit', '')::numeric, 2),
    round(nullif(l->>'descuento', '')::numeric, 2),
    round(nullif(l->>'subtotal', '')::numeric, 2),
    round(nullif(l->>'subtotalConItbis', '')::numeric, 2),
    nullif(l->>'odooRefundedLineId', '')::int,
    nullif(l->>'tasaItbis', '')::numeric
  from tmp_pos_ordenes t
  cross join lateral jsonb_array_elements(t.lineas) l;

  with borradas as (
    delete from public.pos_orden_lineas l
    using public.pos_ordenes o
    where l.orden_id = o.id
      and o.sesion_id = v_sesion_id
      and o.odoo_id in (select odoo_id from tmp_pos_ordenes)
      and not exists (
        select 1 from tmp_pos_lineas t
        where t.odoo_id = l.odoo_id
      )
    returning l.id
  )
  select count(*)::int into v_lineas_borradas from borradas;

  with upserted as (
    insert into public.pos_orden_lineas (
      tienda, odoo_id, orden_id, product_id, odoo_product_id, odoo_tmpl_id, codigo_odoo, nombre_odoo,
      match_estado, cantidad, precio_unit, descuento, subtotal, subtotal_con_itbis, es_devolucion, odoo_refunded_line_id, tasa_itbis
    )
    select
      v_tienda,
      t.odoo_id,
      o.id,
      p.id,
      t.odoo_product_id,
      t.odoo_tmpl_id,
      t.codigo_odoo,
      t.nombre_odoo,
      case when p.id is null then 'sin_match' else 'match' end,
      t.cantidad,
      t.precio_unit,
      t.descuento,
      t.subtotal,
      t.subtotal_con_itbis,
      t.cantidad < 0 or t.odoo_refunded_line_id is not null,
      t.odoo_refunded_line_id,
      t.tasa_itbis
    from tmp_pos_lineas t
    join public.pos_ordenes o on o.tienda = v_tienda and o.odoo_id = t.orden_odoo_id
    left join public.products p on p.codigo_odoo = t.codigo_odoo
    on conflict (tienda, odoo_id) do update set
      orden_id = excluded.orden_id,
      product_id = excluded.product_id,
      odoo_product_id = excluded.odoo_product_id,
      odoo_tmpl_id = excluded.odoo_tmpl_id,
      codigo_odoo = excluded.codigo_odoo,
      nombre_odoo = excluded.nombre_odoo,
      match_estado = excluded.match_estado,
      cantidad = excluded.cantidad,
      precio_unit = excluded.precio_unit,
      descuento = excluded.descuento,
      subtotal = excluded.subtotal,
      subtotal_con_itbis = excluded.subtotal_con_itbis,
      es_devolucion = excluded.es_devolucion,
      odoo_refunded_line_id = excluded.odoo_refunded_line_id,
      tasa_itbis = excluded.tasa_itbis
    returning (xmax = 0) as inserted
  )
  select
    count(*) filter (where inserted)::int,
    count(*) filter (where not inserted)::int
  into v_lineas_ins, v_lineas_upd
  from upserted;

  drop table if exists tmp_pos_pagos;
  create temp table tmp_pos_pagos (
    odoo_id int primary key,
    orden_odoo_id int not null,
    metodo_odoo_id int,
    metodo text not null,
    metodo_original text,
    monto numeric(12, 2) not null,
    fecha timestamptz,
    es_cambio boolean not null,
    tipo_tarjeta text
  ) on commit drop;

  insert into tmp_pos_pagos
  select
    (p->>'odooId')::int,
    t.odoo_id,
    nullif(p->>'metodoOdooId', '')::int,
    public.pos_metodo_canon(p->>'metodo'),
    nullif(btrim(p->>'metodo'), ''),
    round((p->>'monto')::numeric, 2),
    nullif(p->>'fecha', '')::timestamptz,
    coalesce((p->>'esCambio')::boolean, false),
    nullif(btrim(p->>'tipoTarjeta'), '')
  from tmp_pos_ordenes t
  cross join lateral jsonb_array_elements(t.pagos) p;

  with borradas as (
    delete from public.pos_pagos pg
    using public.pos_ordenes o
    where pg.orden_id = o.id
      and o.sesion_id = v_sesion_id
      and o.odoo_id in (select odoo_id from tmp_pos_ordenes)
      and not exists (
        select 1 from tmp_pos_pagos t where t.odoo_id = pg.odoo_id
      )
    returning pg.id
  )
  select count(*)::int into v_pagos_borrados from borradas;

  with upserted as (
    insert into public.pos_pagos (
      tienda, odoo_id, orden_id, sesion_id, metodo_odoo_id, metodo, metodo_original, monto, fecha, es_cambio, tipo_tarjeta
    )
    select
      v_tienda,
      t.odoo_id,
      o.id,
      v_sesion_id,
      t.metodo_odoo_id,
      t.metodo,
      t.metodo_original,
      t.monto,
      t.fecha,
      t.es_cambio,
      t.tipo_tarjeta
    from tmp_pos_pagos t
    join public.pos_ordenes o on o.tienda = v_tienda and o.odoo_id = t.orden_odoo_id
    on conflict (tienda, odoo_id) do update set
      orden_id = excluded.orden_id,
      sesion_id = excluded.sesion_id,
      metodo_odoo_id = excluded.metodo_odoo_id,
      metodo = excluded.metodo,
      metodo_original = excluded.metodo_original,
      monto = excluded.monto,
      fecha = excluded.fecha,
      es_cambio = excluded.es_cambio,
      tipo_tarjeta = excluded.tipo_tarjeta
    returning (xmax = 0) as inserted
  )
  select
    count(*) filter (where inserted)::int,
    count(*) filter (where not inserted)::int
  into v_pagos_ins, v_pagos_upd
  from upserted;

  select round(coalesce(sum(total), 0), 2) into v_suma_ordenes
  from public.pos_ordenes
  where sesion_id = v_sesion_id
    and public.pos_orden_cuenta(estado);

  select round(coalesce(sum(pg.monto), 0), 2) into v_suma_pagos
  from public.pos_pagos pg
  join public.pos_ordenes o on o.id = pg.orden_id
  where pg.sesion_id = v_sesion_id
    and public.pos_orden_cuenta(o.estado);

  select total_pagos into v_total from public.pos_sesiones where id = v_sesion_id;
  v_alerta := v_modo <> 'parcial'
    and v_total is not null
    and (
      abs(v_total - v_suma_ordenes) > 0.01
      or abs(v_total - v_suma_pagos) > 0.01
    );

  update public.pos_sesiones
  set suma_ordenes = v_suma_ordenes,
      suma_pagos = v_suma_pagos,
      descuadrada = v_alerta
  where id = v_sesion_id;

  select count(*)::int into v_sin_match
  from public.pos_orden_lineas l
  join public.pos_ordenes o on o.id = l.orden_id
  where o.sesion_id = v_sesion_id
    and l.match_estado = 'sin_match';

  if v_modo <> 'parcial' then
    perform public.refrescar_resumenes(v_tienda, v_fecha);
    if v_fecha_anterior is not null and v_fecha_anterior is distinct from v_fecha then
      perform public.refrescar_resumenes(v_tienda, v_fecha_anterior);
    end if;
  end if;

  select round(coalesce(sum(total), 0), 2) into v_venta_dia
  from public.pos_ordenes
  where tienda = v_tienda
    and fecha_operativa = v_fecha
    and public.pos_orden_cuenta(estado);

  v_venta_real := v_venta_dia;
  v_origen := 'pos';
  v_override := false;

  if v_modo <> 'parcial' and to_regclass('public.ventas_diarias') is not null then
    update public.ventas_diarias
    set venta_pos = v_venta_dia,
        pos_actualizada_en = now(),
        alerta_pos = override_manual and abs(venta_real - v_venta_dia) > 500,
        venta_real = case when override_manual then venta_real else v_venta_dia end,
        origen = case when override_manual then coalesce(origen, 'manual') else 'pos' end,
        dia_semana = coalesce(dia_semana, public.pos_dia_semana(v_fecha))
    where fecha = v_fecha
    returning venta_real, origen, override_manual
    into v_venta_real, v_origen, v_override;

    if not found then
      insert into public.ventas_diarias (fecha, dia_semana, venta_real, origen, override_manual, venta_pos, pos_actualizada_en, alerta_pos)
      values (v_fecha, public.pos_dia_semana(v_fecha), v_venta_dia, 'pos', false, v_venta_dia, now(), false);
      v_venta_real := v_venta_dia;
      v_origen := 'pos';
      v_override := false;
    end if;

    if v_fecha_anterior is not null and v_fecha_anterior is distinct from v_fecha then
      update public.ventas_diarias
      set venta_pos = src.venta,
          pos_actualizada_en = now(),
          alerta_pos = override_manual and abs(venta_real - src.venta) > 500,
          venta_real = case when override_manual then venta_real else src.venta end,
          origen = case when override_manual then coalesce(origen, 'manual') else 'pos' end
      from (
        select round(coalesce(sum(total), 0), 2) as venta
        from public.pos_ordenes
        where tienda = v_tienda
          and fecha_operativa = v_fecha_anterior
          and public.pos_orden_cuenta(estado)
      ) src
      where fecha = v_fecha_anterior;
    end if;
  end if;

  return jsonb_build_object(
    'tienda', v_tienda,
    'ignoradas', '[]'::jsonb,
    'sesion', jsonb_build_object('odooId', v_odoo_id, 'fechaOperativa', v_fecha),
    'insertados', jsonb_build_object(
      'sesiones', case when v_existia then 0 else 1 end,
      'ordenes', v_ordenes_ins,
      'lineas', v_lineas_ins,
      'pagos', v_pagos_ins
    ),
    'actualizados', jsonb_build_object(
      'sesiones', case when v_existia then 1 else 0 end,
      'ordenes', v_ordenes_upd,
      'lineas', v_lineas_upd,
      'pagos', v_pagos_upd
    ),
    'borrados', jsonb_build_object(
      'ordenes', v_ordenes_borradas,
      'lineas', v_lineas_borradas,
      'pagos', v_pagos_borrados
    ),
    'sinMatch', v_sin_match,
    'totalSesion', v_total,
    'sumaOrdenes', v_suma_ordenes,
    'sumaPagos', v_suma_pagos,
    'alerta', v_alerta,
    'ventaDia', jsonb_build_object(
      'fecha', v_fecha,
      'ventaReal', v_venta_real,
      'ventaPos', v_venta_dia,
      'origen', v_origen,
      'overrideManual', v_override
    )
  );
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
    round(sum(coalesce(a.venta_neta, 0) - a.unidades * c.costo_unit) filter (where c.costo_unit is not null), 2),
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
      case when c.costo_unit is null then null else round(coalesce(a.venta_neta, 0) - a.unidades * c.costo_unit, 2) end as margen,
      case
        when c.costo_unit is null or coalesce(a.venta_neta, 0) = 0 then null
        else round((a.venta_neta - a.unidades * c.costo_unit) / a.venta_neta, 4)
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

create or replace function public.consumo_sin_costo(
  p_tienda text,
  p_desde date,
  p_hasta date,
  p_limit integer,
  p_cursor_venta numeric,
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
  ultima date
)
language sql
stable
set search_path = public
as $$
  with agg as (
    select
      r.codigo_odoo,
      (array_agg(r.product_id) filter (where r.product_id is not null))[1] as product_id,
      max(r.nombre) as nombre_resumen,
      sum(r.unidades) as unidades,
      sum(r.venta) as venta,
      max(r.fecha) as ultima
    from public.resumen_producto_dia r
    where r.tienda = p_tienda
      and r.fecha between p_desde and p_hasta
    group by r.codigo_odoo
  )
  select
    a.codigo_odoo,
    a.product_id,
    coalesce(p.nombre, a.nombre_resumen),
    p.marca,
    coalesce(nullif(btrim(p.categoria), ''), 'Sin categoría'),
    round(a.unidades, 3),
    round(a.venta, 2),
    a.ultima
  from agg a
  join public.products p on p.id = a.product_id
  where not exists (
    select 1 from public.costo_producto_vigente c where c.product_id = a.product_id
  )
  and (
    p_cursor_codigo is null
    or a.venta < p_cursor_venta
    or (a.venta = p_cursor_venta and a.codigo_odoo > p_cursor_codigo)
  )
  order by a.venta desc, a.codigo_odoo
  limit least(501, greatest(coalesce(p_limit, 50), 1));
$$;

create or replace function public.consumo_sin_match(
  p_tienda text,
  p_desde date,
  p_hasta date,
  p_limit integer,
  p_cursor_venta numeric,
  p_cursor_codigo text
)
returns table (
  codigo_odoo text,
  nombre text,
  unidades numeric,
  venta numeric,
  ultima date
)
language sql
stable
set search_path = public
as $$
  with agg as (
    select
      r.codigo_odoo,
      max(r.nombre) as nombre,
      sum(r.unidades) as unidades,
      sum(r.venta) as venta,
      max(r.fecha) as ultima
    from public.resumen_producto_dia r
    where r.tienda = p_tienda
      and r.fecha between p_desde and p_hasta
      and r.product_id is null
    group by r.codigo_odoo
  )
  select
    a.codigo_odoo,
    a.nombre,
    round(a.unidades, 3),
    round(a.venta, 2),
    a.ultima
  from agg a
  where p_cursor_codigo is null
    or a.venta < p_cursor_venta
    or (a.venta = p_cursor_venta and a.codigo_odoo > p_cursor_codigo)
  order by a.venta desc, a.codigo_odoo
  limit least(501, greatest(coalesce(p_limit, 50), 1));
$$;

create or replace function public.consumo_sin_movimiento(
  p_tienda text,
  p_desde date,
  p_hasta date,
  p_limit integer,
  p_cursor_ultima date,
  p_cursor_nombre text,
  p_cursor_id uuid
)
returns table (
  product_id uuid,
  codigo_odoo text,
  nombre text,
  marca text,
  categoria text,
  ultima date
)
language sql
stable
set search_path = public
as $$
  select
    p.id,
    p.codigo_odoo,
    p.nombre,
    p.marca,
    p.categoria,
    u.ultima
  from public.products p
  left join lateral (
    select max(r.fecha) as ultima
    from public.resumen_producto_dia r
    where r.product_id = p.id
      and r.tienda = p_tienda
      and r.unidades <> 0
  ) u on true
  where p.activo
    and not exists (
      select 1
      from public.resumen_producto_dia r
      where r.product_id = p.id
        and r.tienda = p_tienda
        and r.fecha between p_desde and p_hasta
        and r.unidades <> 0
    )
    and (
      p_cursor_id is null
      or (p_cursor_ultima is null and u.ultima is not null)
      or (u.ultima is not distinct from p_cursor_ultima and p.nombre > p_cursor_nombre)
      or (u.ultima is not distinct from p_cursor_ultima and p.nombre = p_cursor_nombre and p.id > p_cursor_id)
      or (u.ultima is not null and p_cursor_ultima is not null and u.ultima > p_cursor_ultima)
    )
  order by u.ultima asc nulls first, p.nombre, p.id
  limit least(501, greatest(coalesce(p_limit, 50), 1));
$$;

create or replace function public.consumo_horarios(
  p_tienda text,
  p_desde date,
  p_hasta date,
  p_categoria text
)
returns table (
  dow smallint,
  hora smallint,
  n_ordenes integer,
  venta numeric,
  unidades numeric
)
language sql
stable
set search_path = public
as $$
  select
    h.dow,
    h.hora,
    sum(h.n_ordenes)::int,
    round(sum(h.venta), 2),
    round(sum(h.unidades), 3)
  from public.resumen_hora_dia h
  where (p_categoria is null or btrim(p_categoria) = '')
    and h.tienda = p_tienda
    and h.fecha between p_desde and p_hasta
  group by h.dow, h.hora
  union all
  select
    h.dow,
    h.hora,
    sum(h.n_ordenes)::int,
    round(sum(h.venta), 2),
    round(sum(h.unidades), 3)
  from public.resumen_hora_categoria_dia h
  where p_categoria is not null
    and btrim(p_categoria) <> ''
    and h.tienda = p_tienda
    and h.fecha between p_desde and p_hasta
    and h.categoria = p_categoria
  group by h.dow, h.hora;
$$;

create or replace function public.consumo_producto_horas(
  p_tienda text,
  p_codigo text,
  p_desde date,
  p_hasta date
)
returns table (
  hora smallint,
  n_ordenes integer,
  venta numeric,
  unidades numeric
)
language sql
stable
set search_path = public
as $$
  select
    o.hora_local,
    count(distinct o.id)::int,
    round(sum(coalesce(l.subtotal_con_itbis, l.subtotal, 0)), 2),
    round(sum(l.cantidad), 3)
  from public.pos_orden_lineas l
  join public.pos_ordenes o on o.id = l.orden_id
  where o.tienda = p_tienda
    and public.pos_orden_cuenta(o.estado)
    and l.codigo_odoo = p_codigo
    and o.fecha_operativa between p_desde and p_hasta
  group by o.hora_local
  order by o.hora_local;
$$;

create or replace function public.consumo_categorias(p_tienda text, p_desde date, p_hasta date)
returns table (categoria text, venta numeric)
language sql
stable
set search_path = public
as $$
  select h.categoria, round(sum(h.venta), 2) as venta
  from public.resumen_categoria_dia h
  where h.tienda = p_tienda
    and h.fecha between p_desde and p_hasta
  group by h.categoria
  order by sum(h.venta) desc, h.categoria
  limit 200;
$$;

create or replace function public.consumo_canasta(
  p_tienda text,
  p_semana date,
  p_limit integer,
  p_cursor_lift numeric,
  p_cursor_a text,
  p_cursor_b text
)
returns table (
  producto_a text,
  producto_b text,
  n_ordenes_juntos integer,
  soporte numeric,
  lift numeric,
  n_ordenes_semana integer
)
language sql
stable
set search_path = public
as $$
  select c.producto_a, c.producto_b, c.n_ordenes_juntos, c.soporte, c.lift, c.n_ordenes_semana
  from public.resumen_canasta_semana c
  where c.tienda = p_tienda
    and c.semana = p_semana
    and (
      p_cursor_a is null
      or (p_cursor_lift is not null and c.lift is null)
      or c.lift < p_cursor_lift
      or (c.lift is not distinct from p_cursor_lift and c.producto_a > p_cursor_a)
      or (c.lift is not distinct from p_cursor_lift and c.producto_a = p_cursor_a and c.producto_b > p_cursor_b)
    )
  order by c.lift desc nulls last, c.producto_a, c.producto_b
  limit least(501, greatest(coalesce(p_limit, 50), 1));
$$;

create or replace function public.consumo_calidad_conteos(p_tienda text, p_desde date, p_hasta date)
returns table (
  sin_match_productos integer,
  sin_match_venta numeric,
  sin_costo_productos integer,
  sin_costo_venta numeric,
  descuadradas integer
)
language sql
stable
set search_path = public
as $$
  with productos as (
    select
      r.codigo_odoo,
      (array_agg(r.product_id) filter (where r.product_id is not null))[1] as product_id,
      sum(r.venta) as venta
    from public.resumen_producto_dia r
    where r.tienda = p_tienda
      and r.fecha between p_desde and p_hasta
    group by r.codigo_odoo
  )
  select
    count(*) filter (where p.product_id is null)::int,
    round(coalesce(sum(p.venta) filter (where p.product_id is null), 0), 2),
    count(*) filter (
      where p.product_id is not null
        and not exists (select 1 from public.costo_producto_vigente c where c.product_id = p.product_id)
    )::int,
    round(coalesce(sum(p.venta) filter (
      where p.product_id is not null
        and not exists (select 1 from public.costo_producto_vigente c where c.product_id = p.product_id)
    ), 0), 2),
    (
      select count(*)::int
      from public.pos_sesiones s
      where s.tienda = p_tienda
        and s.fecha_operativa between p_desde and p_hasta
        and s.descuadrada
    )
  from productos p;
$$;

do $$
declare
  tabla text;
begin
  foreach tabla in array array[
    'pos_sesiones',
    'pos_ordenes',
    'pos_orden_lineas',
    'pos_pagos',
    'resumen_producto_dia',
    'resumen_hora_dia',
    'resumen_hora_categoria_dia',
    'resumen_categoria_dia',
    'resumen_dia',
    'resumen_turno_dia',
    'resumen_canasta_semana',
    'pos_rematch_cola'
  ]
  loop
    execute format('revoke all on table public.%I from anon, authenticated, public', tabla);
    execute format('grant all on table public.%I to service_role', tabla);
    execute format('alter table public.%I enable row level security', tabla);
    execute format('alter table public.%I force row level security', tabla);
    execute format('drop policy if exists %I on public.%I', 'service_role_' || tabla || '_all', tabla);
    execute format(
      'create policy %I on public.%I for all to service_role using (true) with check (true)',
      'service_role_' || tabla || '_all',
      tabla
    );
  end loop;
end $$;

grant usage, select on sequence public.pos_sesiones_id_seq to service_role;
grant usage, select on sequence public.pos_ordenes_id_seq to service_role;
grant usage, select on sequence public.pos_orden_lineas_id_seq to service_role;
grant usage, select on sequence public.pos_pagos_id_seq to service_role;

revoke all on table public.costo_producto_vigente from anon, authenticated, public;
grant select on table public.costo_producto_vigente to service_role;

do $$
declare
  firma text;
begin
  foreach firma in array array[
    'public.pos_orden_cuenta(text)',
    'public.pos_dia_semana(date)',
    'public.pos_metodo_canon(text)',
    'public.refrescar_canasta(text, date)',
    'public.refrescar_resumenes_fechas(text, date[])',
    'public.refrescar_resumenes(text, date)',
    'public.rematch_lineas(text)',
    'public.trg_products_rematch_codigo()',
    'public.ingestar_pos_sesion(jsonb)',
    'public.consumo_margen_periodo(text, date, date)',
    'public.consumo_top_productos(text, date, date, date, date, text, text, text, integer, integer, numeric, text)',
    'public.consumo_sin_costo(text, date, date, integer, numeric, text)',
    'public.consumo_sin_match(text, date, date, integer, numeric, text)',
    'public.consumo_sin_movimiento(text, date, date, integer, date, text, uuid)',
    'public.consumo_horarios(text, date, date, text)',
    'public.consumo_producto_horas(text, text, date, date)',
    'public.consumo_categorias(text, date, date)',
    'public.consumo_canasta(text, date, integer, numeric, text, text)',
    'public.consumo_calidad_conteos(text, date, date)',
    'public.procesar_pos_rematch(integer)'
  ]
  loop
    execute format('revoke all on function %s from public, anon, authenticated', firma);
    execute format('grant execute on function %s to service_role', firma);
  end loop;
end $$;
