-- Informe diario, asociaciones publicadas y tareas de la rutina.
-- No reescribe hallazgos viejos ni activa precios.

alter table public.miles_hallazgos
  add column if not exists hipotesis text,
  add column if not exists proximo_paso text,
  add column if not exists validado_en timestamptz,
  add column if not exists grafica jsonb;

alter table public.miles_hallazgos drop constraint if exists miles_hallazgos_tipo_check;
alter table public.miles_hallazgos
  add constraint miles_hallazgos_tipo_check
  check (tipo in ('oportunidad', 'deterioro', 'patron', 'anomalia', 'calidad', 'cambio'));

alter table public.miles_ejecuciones drop constraint if exists miles_ejecuciones_estado_check;
alter table public.miles_ejecuciones
  add constraint miles_ejecuciones_estado_check
  check (estado in ('en_curso', 'completada', 'fallida', 'parcial'));

alter table public.miles_propuestas drop constraint if exists miles_propuestas_estado_check;
alter table public.miles_propuestas
  add constraint miles_propuestas_estado_check
  check (estado in (
    'borrador', 'por_revisar', 'requiere_ampliacion', 'lista_para_probar',
    'bloqueada', 'aprobada', 'implementada', 'evaluada', 'descartada', 'archivada'
  ));

create table if not exists public.miles_informes (
  id uuid primary key default gen_random_uuid(),
  tienda text not null default 'quick',
  fecha date not null,
  ejecucion_id uuid references public.miles_ejecuciones (id),
  estado text not null,
  conclusion text not null,
  novedades text,
  actualizaciones text,
  bloqueos text,
  trabajo jsonb not null default '{}'::jsonb,
  datos_hasta date,
  idempotency_key text not null unique,
  payload_hash text not null,
  publicado_en timestamptz not null default now(),
  version integer not null default 1,
  constraint miles_informes_estado_check check (estado in ('publicado', 'parcial'))
);

create index if not exists idx_miles_informes_fecha
  on public.miles_informes (tienda, fecha desc, publicado_en desc);

create table if not exists public.miles_informe_casos (
  informe_id uuid not null references public.miles_informes (id) on delete cascade,
  hallazgo_id uuid not null references public.miles_hallazgos (id),
  orden integer not null default 0,
  titulo text not null,
  conclusion text not null,
  estado_en_publicacion text not null,
  tipo text,
  prioridad text,
  grafica jsonb,
  primary key (informe_id, hallazgo_id)
);

create table if not exists public.miles_asociaciones (
  id uuid primary key default gen_random_uuid(),
  tienda text not null default 'quick',
  codigo_a text not null,
  codigo_b text not null,
  nombre_a text,
  nombre_b text,
  periodo_desde date not null,
  periodo_hasta date not null,
  n integer,
  n_a integer,
  n_b integer,
  n_ab integer,
  observacion text,
  cambio text,
  solidez text,
  limitaciones text,
  oportunidad text,
  proximo_paso text,
  estado text not null default 'vigente',
  ejecucion_id uuid references public.miles_ejecuciones (id),
  idempotency_key text not null unique,
  payload_hash text not null,
  publicado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  version integer not null default 1,
  constraint miles_asociaciones_estado_check check (estado in ('vigente', 'historica', 'insuficiente')),
  constraint miles_asociaciones_orden_check check (codigo_a < codigo_b),
  constraint miles_asociaciones_conteos_check check (
    n is null or n_a is null or n_b is null or n_ab is null
    or (n_ab <= n_a and n_ab <= n_b and n_a <= n and n_b <= n and n >= 0)
  )
);

create unique index if not exists idx_miles_asociaciones_par
  on public.miles_asociaciones (tienda, codigo_a, codigo_b, periodo_desde, periodo_hasta);

create table if not exists public.miles_tareas (
  id uuid primary key default gen_random_uuid(),
  ejecucion_id uuid not null references public.miles_ejecuciones (id) on delete cascade,
  area text not null,
  estado text not null,
  iniciada_en timestamptz,
  terminada_en timestamptz,
  datos_revisados text,
  entregable text,
  error text,
  proximo_paso text,
  orden integer not null default 0,
  constraint miles_tareas_estado_check check (estado in ('ejecutada', 'sin_novedades', 'publicada', 'limitada', 'fallida', 'no_ejecutada')),
  constraint miles_tareas_area_unica unique (ejecucion_id, area)
);

do $$
declare
  tabla text;
begin
  foreach tabla in array array['miles_informes', 'miles_informe_casos', 'miles_asociaciones', 'miles_tareas']
  loop
    execute format('grant all on table public.%I to service_role', tabla);
    execute format('alter table public.%I enable row level security', tabla);
  end loop;
end $$;
