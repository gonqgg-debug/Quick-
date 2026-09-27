/* Facturas de Phillip: documento, productos, validaciones, preguntas y la foto original. */

create table if not exists public.facturas (
  id uuid primary key default gen_random_uuid(),
  clave text,
  recibido_en timestamptz not null default now(),
  enviado_por text,
  tienda text,
  tipo_documento text not null default 'factura',
  proveedor text,
  rnc text,
  ncf text,
  numero_factura text,
  fecha_emision date,
  fecha_vencimiento date,
  condicion text,
  metodo_pago text,
  moneda text not null default 'DOP',
  subtotal numeric(14,2),
  descuento_total numeric(14,2),
  itbis_total numeric(14,2),
  otros_cargos numeric(14,2),
  total numeric(14,2),
  numero_productos integer not null default 0,
  numero_documentos integer not null default 0,
  estado text not null default 'recibida',
  observaciones text,
  posible_duplicado boolean not null default false,
  duplicado_de uuid,
  preguntas_abiertas integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint facturas_tipo_check check (tipo_documento in ('factura', 'nota_credito', 'conduce', 'recibo', 'cotizacion')),
  constraint facturas_condicion_check check (condicion is null or condicion in ('contado', 'credito')),
  constraint facturas_moneda_check check (moneda in ('DOP', 'USD', 'EUR')),
  constraint facturas_estado_check check (estado in ('recibida', 'en_analisis', 'pendiente_informacion', 'respuesta_recibida', 'completa', 'incompleta', 'posible_duplicado', 'documento_no_valido', 'escalada')),
  constraint facturas_numero_productos_check check (numero_productos >= 0),
  constraint facturas_numero_documentos_check check (numero_documentos >= 0),
  constraint facturas_preguntas_check check (preguntas_abiertas >= 0)
);

alter table public.facturas
  drop constraint if exists facturas_duplicado_de_fkey;

alter table public.facturas
  add constraint facturas_duplicado_de_fkey
  foreign key (duplicado_de) references public.facturas (id) on delete set null;

create unique index if not exists idx_facturas_clave
  on public.facturas (clave)
  where clave is not null;

create index if not exists idx_facturas_estado
  on public.facturas (estado, updated_at desc);

create index if not exists idx_facturas_ncf
  on public.facturas (ncf)
  where ncf is not null;

create index if not exists idx_facturas_numero
  on public.facturas (numero_factura, fecha_emision);

create table if not exists public.factura_documentos (
  id uuid primary key default gen_random_uuid(),
  factura_id uuid not null references public.facturas (id) on delete cascade,
  storage_path text not null,
  mime text not null,
  nombre text,
  pagina integer,
  sha256 text not null,
  created_at timestamptz not null default now(),
  constraint factura_documentos_pagina_check check (pagina is null or pagina >= 1),
  constraint factura_documentos_mime_check check (mime in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf'))
);

create unique index if not exists idx_factura_documentos_sha
  on public.factura_documentos (factura_id, sha256);

create index if not exists idx_factura_documentos_factura
  on public.factura_documentos (factura_id, pagina);

create table if not exists public.factura_lineas (
  id uuid primary key default gen_random_uuid(),
  factura_id uuid not null references public.facturas (id) on delete cascade,
  numero_linea integer not null,
  codigo_sku text,
  codigo_barras text,
  descripcion_original text,
  producto_normalizado text,
  marca text,
  variante text,
  tamano text,
  presentacion text,
  cantidad_comprada numeric(14,3),
  unidades_por_presentacion numeric(14,3),
  unidades_totales numeric(14,3),
  costo_por_presentacion numeric(14,2),
  costo_unitario numeric(14,4),
  descuento_linea numeric(14,2),
  itbis_linea numeric(14,2),
  precio_incluye_itbis text not null default 'no_determinado',
  subtotal_linea numeric(14,2),
  total_linea numeric(14,2),
  estado text not null default 'pendiente',
  observacion text,
  constraint factura_lineas_numero_check check (numero_linea >= 1),
  constraint factura_lineas_presentacion_check check (presentacion is null or presentacion in ('unidad', 'paquete', 'caja', 'fardo', 'otro')),
  constraint factura_lineas_itbis_check check (precio_incluye_itbis in ('si', 'no', 'no_determinado')),
  constraint factura_lineas_estado_check check (estado in ('completa', 'ambigua', 'ilegible', 'pendiente')),
  constraint factura_lineas_cantidad_check check (cantidad_comprada is null or cantidad_comprada >= 0),
  constraint factura_lineas_unidades_check check (unidades_por_presentacion is null or unidades_por_presentacion > 0),
  unique (factura_id, numero_linea)
);

create table if not exists public.factura_validaciones (
  id uuid primary key default gen_random_uuid(),
  factura_id uuid not null references public.facturas (id) on delete cascade,
  codigo text not null,
  resultado text not null default 'pendiente',
  explicacion text,
  revisado_en timestamptz,
  constraint factura_validaciones_codigo_check check (codigo in ('suma_lineas', 'itbis', 'total', 'ncf_legible', 'numero_legible', 'posible_duplicado', 'paginas', 'cantidades', 'diferencia_matematica', 'documento_completo')),
  constraint factura_validaciones_resultado_check check (resultado in ('correcto', 'diferencia', 'pendiente', 'no_aplica')),
  unique (factura_id, codigo)
);

create table if not exists public.factura_preguntas (
  id uuid primary key default gen_random_uuid(),
  factura_id uuid not null references public.facturas (id) on delete cascade,
  linea_numero integer,
  campo text,
  pregunta text not null,
  consultado_a text,
  respuesta text,
  respondido_por text,
  respondido_en timestamptz,
  evidencia text,
  estado text not null default 'abierta',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint factura_preguntas_texto_check check (char_length(btrim(pregunta)) >= 1),
  constraint factura_preguntas_estado_check check (estado in ('abierta', 'resuelta')),
  constraint factura_preguntas_linea_check check (linea_numero is null or linea_numero >= 1)
);

create index if not exists idx_factura_preguntas_factura
  on public.factura_preguntas (factura_id, estado);

drop trigger if exists facturas_set_updated_at on public.facturas;
create trigger facturas_set_updated_at
before update on public.facturas
for each row
execute function public.set_updated_at();

drop trigger if exists factura_preguntas_set_updated_at on public.factura_preguntas;
create trigger factura_preguntas_set_updated_at
before update on public.factura_preguntas
for each row
execute function public.set_updated_at();

revoke all on table public.facturas from anon, authenticated, public;
revoke all on table public.factura_documentos from anon, authenticated, public;
revoke all on table public.factura_lineas from anon, authenticated, public;
revoke all on table public.factura_validaciones from anon, authenticated, public;
revoke all on table public.factura_preguntas from anon, authenticated, public;

grant all on table public.facturas to service_role;
grant all on table public.factura_documentos to service_role;
grant all on table public.factura_lineas to service_role;
grant all on table public.factura_validaciones to service_role;
grant all on table public.factura_preguntas to service_role;

alter table public.facturas enable row level security;
alter table public.facturas force row level security;
alter table public.factura_documentos enable row level security;
alter table public.factura_documentos force row level security;
alter table public.factura_lineas enable row level security;
alter table public.factura_lineas force row level security;
alter table public.factura_validaciones enable row level security;
alter table public.factura_validaciones force row level security;
alter table public.factura_preguntas enable row level security;
alter table public.factura_preguntas force row level security;

drop policy if exists "service_role_facturas_all" on public.facturas;
create policy "service_role_facturas_all"
  on public.facturas
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "service_role_factura_documentos_all" on public.factura_documentos;
create policy "service_role_factura_documentos_all"
  on public.factura_documentos
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "service_role_factura_lineas_all" on public.factura_lineas;
create policy "service_role_factura_lineas_all"
  on public.factura_lineas
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "service_role_factura_validaciones_all" on public.factura_validaciones;
create policy "service_role_factura_validaciones_all"
  on public.factura_validaciones
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "service_role_factura_preguntas_all" on public.factura_preguntas;
create policy "service_role_factura_preguntas_all"
  on public.factura_preguntas
  for all
  to service_role
  using (true)
  with check (true);
