-- Miles, comparaciones de consumo y mapa de horas.
-- No modifica ventas, costos ni pedidos. El costo sigue siendo el último disponible.

create or replace function public.consumo_venta_alcance(
  p_tienda text,
  p_desde date,
  p_hasta date,
  p_categoria text,
  p_q text
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
  );
$$;

-- Reloj real: fecha timestamptz convertida una vez a America/Santo_Domingo.
-- Reloj caja: fecha_operativa y hora_local, ya grabadas en esa zona al ingerir.
-- ocurrencias = horas dentro de una sesión cerrada, incluida la hora sin ventas.
-- No existe un calendario de “cerrado”. Una sesión sin stop_at no se cuenta como abierta.
create or replace function public.consumo_mapa_horas(
  p_tienda text,
  p_desde date,
  p_hasta date,
  p_categoria text,
  p_reloj text
)
returns table (
  dow smallint,
  hora smallint,
  n_ordenes integer,
  venta numeric,
  unidades numeric,
  ocurrencias integer,
  incompletas integer
)
language sql
stable
set search_path = public
as $$
  with sesiones as (
    select
      s.fecha_operativa,
      s.start_at,
      s.stop_at,
      s.ingesta
    from public.pos_sesiones s
    where s.tienda = p_tienda
      and s.fecha_operativa between p_desde and p_hasta
  ),
  abiertas as (
    select
      gs::date as fecha,
      extract(isodow from gs)::int as dow,
      extract(hour from gs)::int as hora
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
    union all
    select
      s.fecha_operativa as fecha,
      extract(isodow from s.fecha_operativa)::int as dow,
      h.hora
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
        when p_reloj = 'real' then extract(isodow from (s.start_at at time zone 'America/Santo_Domingo'))::int
        else extract(isodow from s.fecha_operativa)::int
      end as dow,
      case
        when p_reloj = 'real' then extract(hour from (s.start_at at time zone 'America/Santo_Domingo'))::int
        else extract(hour from s.start_at at time zone 'America/Santo_Domingo')::int
      end as hora
    from sesiones s
    where s.stop_at is null or s.ingesta = 'parcial'
  ),
  ventas as (
    select
      extract(isodow from (o.fecha at time zone 'America/Santo_Domingo'))::int as dow,
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
      o.dow::int,
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
      extract(isodow from (o.fecha at time zone 'America/Santo_Domingo'))::int,
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
      o.dow::int,
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
    select dow, hora from abiertas
    union
    select dow, hora from incompletas
    union
    select dow, hora from ventas
  )
  select
    c.dow::smallint,
    c.hora::smallint,
    coalesce(v.n_ordenes, 0)::int,
    coalesce(v.venta, 0),
    coalesce(v.unidades, 0),
    (select count(distinct a.fecha)::int from abiertas a where a.dow = c.dow and a.hora = c.hora),
    (select count(*)::int from incompletas i where i.dow = c.dow and i.hora = c.hora)
  from claves c
  left join ventas v on v.dow = c.dow and v.hora = c.hora;
$$;

-- Un ticket contiene el producto si la suma de cantidades, sin líneas de devolución, es > 0.
-- El producto repetido en el ticket cuenta una vez. draft y cancel no entran.
create or replace function public.consumo_canasta_par(
  p_tienda text,
  p_desde date,
  p_hasta date,
  p_a text,
  p_b text
)
returns table (
  elegibles integer,
  con_a integer,
  con_b integer,
  con_ambos integer
)
language sql
stable
set search_path = public
as $$
  with elegibles as (
    select o.id
    from public.pos_ordenes o
    where o.tienda = p_tienda
      and public.pos_orden_cuenta(o.estado)
      and o.fecha_operativa between p_desde and p_hasta
  ),
  contiene as (
    select l.orden_id, l.codigo_odoo
    from public.pos_orden_lineas l
    join elegibles e on e.id = l.orden_id
    where l.codigo_odoo in (p_a, p_b)
      and coalesce(l.es_devolucion, false) = false
    group by l.orden_id, l.codigo_odoo
    having sum(l.cantidad) > 0
  )
  select
    (select count(*)::int from elegibles),
    (select count(distinct orden_id)::int from contiene where codigo_odoo = p_a),
    (select count(distinct orden_id)::int from contiene where codigo_odoo = p_b),
    (
      select count(*)::int from (
        select orden_id
        from contiene
        group by orden_id
        having count(distinct codigo_odoo) = 2
      ) ambos
    );
$$;

create table if not exists public.agent_credenciales (
  id uuid primary key default gen_random_uuid(),
  rol text not null,
  nombre text not null,
  token_hash text not null unique,
  prefijo text not null,
  creado_en timestamptz not null default now(),
  revocado_en timestamptz,
  reemplaza_id uuid references public.agent_credenciales (id),
  constraint agent_credenciales_rol_check check (rol in ('miles'))
);

create index if not exists idx_agent_credenciales_activas
  on public.agent_credenciales (rol)
  where revocado_en is null;

create table if not exists public.miles_ejecuciones (
  id uuid primary key default gen_random_uuid(),
  estado text not null default 'en_curso',
  iniciada_en timestamptz not null default now(),
  terminada_en timestamptz,
  datos_hasta date,
  corte text,
  error text,
  idempotency_key text not null unique,
  payload_hash text not null,
  version integer not null default 1,
  constraint miles_ejecuciones_estado_check check (estado in ('en_curso', 'completada', 'fallida'))
);

create table if not exists public.miles_hallazgos (
  id uuid primary key default gen_random_uuid(),
  ejecucion_id uuid references public.miles_ejecuciones (id),
  autor text not null default 'miles',
  idempotency_key text not null unique,
  payload_hash text not null,
  patron_clave text,
  hallazgo_previo_id uuid references public.miles_hallazgos (id),
  tipo text not null,
  titulo text not null,
  resumen text not null,
  observacion text not null,
  interpretacion text,
  recomendacion text,
  prioridad text not null,
  prioridad_justificacion text not null,
  tienda text not null default 'quick',
  alcance jsonb not null default '{}'::jsonb,
  periodo_desde date not null,
  periodo_hasta date not null,
  comparacion_desde date,
  comparacion_hasta date,
  comparacion_modo text,
  metricas jsonb not null,
  muestras jsonb not null default '{}'::jsonb,
  limitaciones text,
  evidencia jsonb not null,
  corte text,
  estado text not null default 'vigente',
  descarte_motivo text,
  publicado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  version integer not null default 1,
  constraint miles_hallazgos_tipo_check check (tipo in ('oportunidad', 'deterioro', 'patron', 'anomalia', 'calidad')),
  constraint miles_hallazgos_prioridad_check check (prioridad in ('alta', 'media', 'baja')),
  constraint miles_hallazgos_estado_check check (estado in ('vigente', 'descartado', 'archivado'))
);

create index if not exists idx_miles_hallazgos_lista
  on public.miles_hallazgos (tienda, estado, publicado_en desc);
create index if not exists idx_miles_hallazgos_patron
  on public.miles_hallazgos (patron_clave, periodo_desde);

create table if not exists public.miles_investigaciones (
  id uuid primary key default gen_random_uuid(),
  hallazgo_id uuid references public.miles_hallazgos (id),
  tipo text not null,
  pregunta text not null,
  alcance jsonb not null default '{}'::jsonb,
  solicitante text not null,
  estado text not null default 'pendiente',
  respuesta text,
  tomada_en timestamptz,
  creada_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  version integer not null default 1,
  constraint miles_investigaciones_tipo_check check (tipo in ('investigacion', 'ampliacion')),
  constraint miles_investigaciones_estado_check check (estado in ('pendiente', 'en_analisis', 'requiere_informacion', 'completada', 'cancelada'))
);

create index if not exists idx_miles_investigaciones_estado
  on public.miles_investigaciones (estado, creada_en);

create table if not exists public.miles_pruebas (
  id uuid primary key default gen_random_uuid(),
  hallazgo_id uuid references public.miles_hallazgos (id),
  hipotesis text not null,
  accion text not null,
  tienda text not null default 'quick',
  productos jsonb not null default '[]'::jsonb,
  responsable text,
  inicio_previsto date,
  fin_previsto date,
  inicio_real date,
  fin_real date,
  presupuesto numeric(12, 2),
  metrica_principal text not null,
  metricas_control jsonb not null default '[]'::jsonb,
  linea_base jsonb not null default '{}'::jsonb,
  resultado_esperado text,
  limitaciones text,
  decision text,
  decision_en timestamptz,
  estado text not null default 'propuesta',
  creada_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  version integer not null default 1,
  constraint miles_pruebas_estado_check check (estado in ('propuesta', 'aprobada', 'en_curso', 'pendiente_evaluacion', 'finalizada', 'cancelada'))
);

create table if not exists public.miles_evaluaciones (
  id uuid primary key default gen_random_uuid(),
  prueba_id uuid not null references public.miles_pruebas (id),
  ejecucion_id uuid references public.miles_ejecuciones (id),
  autor text not null default 'miles',
  observacion text not null,
  atribucion text,
  metricas jsonb not null default '{}'::jsonb,
  limitaciones text,
  idempotency_key text not null unique,
  payload_hash text not null,
  creado_en timestamptz not null default now()
);

create table if not exists public.miles_comentarios (
  id uuid primary key default gen_random_uuid(),
  recurso_tipo text not null,
  recurso_id uuid not null,
  autor text not null,
  autor_rol text not null,
  cuerpo text not null,
  creado_en timestamptz not null default now(),
  constraint miles_comentarios_rol_check check (autor_rol in ('humano', 'miles')),
  constraint miles_comentarios_tipo_check check (recurso_tipo in ('hallazgo', 'prueba', 'investigacion'))
);

create table if not exists public.miles_eventos (
  id bigserial primary key,
  recurso_tipo text not null,
  recurso_id uuid not null,
  actor text not null,
  accion text not null,
  detalle jsonb not null default '{}'::jsonb,
  en timestamptz not null default now()
);

create index if not exists idx_miles_eventos_recurso
  on public.miles_eventos (recurso_tipo, recurso_id, en);

do $$
declare
  tabla text;
begin
  foreach tabla in array array[
    'agent_credenciales',
    'miles_ejecuciones',
    'miles_hallazgos',
    'miles_investigaciones',
    'miles_pruebas',
    'miles_evaluaciones',
    'miles_comentarios',
    'miles_eventos'
  ]
  loop
    execute format('grant all on table public.%I to service_role', tabla);
    execute format('alter table public.%I enable row level security', tabla);
  end loop;
end $$;

grant usage, select on sequence public.miles_eventos_id_seq to service_role;

grant execute on function public.consumo_venta_alcance(text, date, date, text, text) to service_role;
grant execute on function public.consumo_mapa_horas(text, date, date, text, text) to service_role;
grant execute on function public.consumo_canasta_par(text, date, date, text, text) to service_role;
