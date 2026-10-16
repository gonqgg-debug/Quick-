-- Propuestas de combos y promos. No activa precios ni descuentos en caja.
-- No reescribe hallazgos ni pruebas existentes.

create table if not exists public.miles_propuestas (
  id uuid primary key default gen_random_uuid(),
  ejecucion_id uuid references public.miles_ejecuciones (id),
  investigacion_id uuid references public.miles_investigaciones (id),
  autor text not null default 'miles',
  idempotency_key text not null unique,
  payload_hash text not null,
  tienda text not null default 'quick',
  nombre text not null,
  objetivo text not null,
  comportamiento text not null,
  tipo text not null,
  estado text not null default 'por_revisar',
  descarte_motivo text,
  periodo_desde date not null,
  periodo_hasta date not null,
  mecanica jsonb not null default '{}'::jsonb,
  metricas jsonb not null default '{}'::jsonb,
  limitaciones text,
  evidencia jsonb not null,
  costos jsonb,
  supuestos jsonb not null default '{}'::jsonb,
  escenarios jsonb not null default '[]'::jsonb,
  modelo jsonb,
  probabilidad jsonb,
  visual jsonb,
  corte text,
  publicado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  version integer not null default 1,
  constraint miles_propuestas_tipo_check check (tipo in ('combo', 'acompanamiento', 'compra_minima', 'horario', 'salida_inventario')),
  constraint miles_propuestas_estado_check check (estado in ('borrador', 'por_revisar', 'requiere_ampliacion', 'lista_para_probar', 'descartada', 'archivada'))
);

create table if not exists public.miles_propuesta_productos (
  id uuid primary key default gen_random_uuid(),
  propuesta_id uuid not null references public.miles_propuestas (id) on delete cascade,
  product_id uuid not null references public.products (id),
  funcion text not null,
  cantidad numeric(12, 3) not null,
  precio_habitual numeric(14, 4),
  precio_promo numeric(14, 4),
  precio_observado_en date,
  presentacion text,
  orden integer not null default 0,
  constraint miles_propuesta_productos_funcion_check check (funcion in ('principal', 'complemento', 'beneficio')),
  constraint miles_propuesta_productos_cantidad_check check (cantidad > 0)
);

create table if not exists public.miles_propuesta_hallazgos (
  propuesta_id uuid not null references public.miles_propuestas (id) on delete cascade,
  hallazgo_id uuid not null references public.miles_hallazgos (id),
  primary key (propuesta_id, hallazgo_id)
);

create table if not exists public.miles_propuesta_variantes (
  id uuid primary key default gen_random_uuid(),
  propuesta_id uuid not null references public.miles_propuestas (id) on delete cascade,
  autor text not null,
  nombre text not null,
  mecanica jsonb not null,
  supuestos jsonb not null,
  lineas jsonb not null,
  resultado jsonb not null,
  formula text not null,
  creada_en timestamptz not null default now()
);

alter table public.miles_pruebas
  add column if not exists propuesta_id uuid references public.miles_propuestas (id),
  add column if not exists variante_id uuid references public.miles_propuesta_variantes (id),
  add column if not exists snapshot jsonb;

alter table public.miles_comentarios drop constraint if exists miles_comentarios_tipo_check;
alter table public.miles_comentarios
  add constraint miles_comentarios_tipo_check
  check (recurso_tipo in ('hallazgo', 'prueba', 'investigacion', 'propuesta'));

create index if not exists idx_miles_propuestas_estado on public.miles_propuestas (tienda, estado, publicado_en desc);
create index if not exists idx_miles_propuesta_productos_producto on public.miles_propuesta_productos (product_id);
create index if not exists idx_miles_pruebas_propuesta on public.miles_pruebas (propuesta_id);

comment on table public.miles_propuestas is
  'Propuesta comercial de Miles. Su estado no enciende una promoción en caja.';
comment on column public.miles_pruebas.snapshot is
  'Condiciones, costos y supuestos congelados al crear la prueba. No se recalcula.';

do $$
declare
  tabla text;
begin
  foreach tabla in array array[
    'miles_propuestas',
    'miles_propuesta_productos',
    'miles_propuesta_hallazgos',
    'miles_propuesta_variantes'
  ]
  loop
    execute format('grant all on table public.%I to service_role', tabla);
    execute format('alter table public.%I enable row level security', tabla);
  end loop;
end $$;
