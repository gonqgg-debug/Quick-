/* CRM de expansión: contactos, sitios y el seguimiento del pipeline. */

create table if not exists public.expansion_contactos (
  id uuid primary key default gen_random_uuid(),
  clave text,
  nombre text not null,
  empresa text,
  telefono text,
  whatsapp text,
  email text,
  cargo text,
  zona text,
  especialidad text,
  web text,
  instagram text,
  linkedin text,
  fuente text,
  tipo text not null default 'otro',
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expansion_contactos_nombre_check check (char_length(btrim(nombre)) >= 1),
  constraint expansion_contactos_tipo_check check (tipo in ('broker', 'desarrollador', 'administracion', 'propietario', 'otro')),
  constraint expansion_contactos_fuente_check check (fuente is null or fuente in ('google', 'maps', 'instagram', 'linkedin', 'hunter', 'website', 'portal', 'prensa', 'gmail', 'otro'))
);

create unique index if not exists idx_expansion_contactos_clave
  on public.expansion_contactos (clave)
  where clave is not null;

create table if not exists public.expansion_sitios (
  id uuid primary key default gen_random_uuid(),
  clave text,
  nombre text not null,
  zona text,
  direccion text,
  lat double precision,
  lng double precision,
  desarrollador text,
  unidades integer,
  entrega text,
  por_que text,
  web text,
  fuente text,
  trato text not null default 'alquiler',
  etapa text not null default 'identificado',
  etapa_desde date not null default (now() at time zone 'America/Santo_Domingo')::date,
  detalle text,
  proxima_accion text,
  proxima_fecha date,
  contacto_id uuid references public.expansion_contactos (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expansion_sitios_nombre_check check (char_length(btrim(nombre)) >= 1),
  constraint expansion_sitios_trato_check check (trato in ('alquiler', 'compra', 'alianza')),
  constraint expansion_sitios_etapa_check check (etapa in ('identificado', 'contacto_encontrado', 'contactado', 'presentacion_enviada', 'respondio', 'conversacion', 'oportunidad', 'negociacion', 'pausa', 'descartado')),
  constraint expansion_sitios_fuente_check check (fuente is null or fuente in ('google', 'maps', 'instagram', 'linkedin', 'hunter', 'website', 'portal', 'prensa', 'gmail', 'otro')),
  constraint expansion_sitios_unidades_check check (unidades is null or unidades >= 0),
  constraint expansion_sitios_ubicacion_check check ((lat is null and lng is null) or (lat between -90 and 90 and lng between -180 and 180))
);

create unique index if not exists idx_expansion_sitios_clave
  on public.expansion_sitios (clave)
  where clave is not null;

create index if not exists idx_expansion_sitios_etapa
  on public.expansion_sitios (etapa, proxima_fecha);

create table if not exists public.expansion_actividades (
  id uuid primary key default gen_random_uuid(),
  sitio_id uuid not null references public.expansion_sitios (id) on delete cascade,
  contacto_id uuid references public.expansion_contactos (id) on delete set null,
  tipo text not null default 'nota',
  texto text not null,
  fecha date not null,
  created_at timestamptz not null default now(),
  constraint expansion_actividades_tipo_check check (tipo in ('nota', 'investigacion', 'llamada', 'whatsapp', 'email', 'visita', 'presentacion', 'propuesta')),
  constraint expansion_actividades_texto_check check (char_length(btrim(texto)) >= 1)
);

create index if not exists idx_expansion_actividades_sitio
  on public.expansion_actividades (sitio_id, fecha desc);

create table if not exists public.expansion_metas (
  id text primary key,
  etiqueta text not null,
  meta integer not null default 0,
  constraint expansion_metas_meta_check check (meta >= 0)
);

insert into public.expansion_metas (id, etiqueta, meta)
values
  ('conversaciones', 'Conversaciones activas', 0),
  ('negociacion', 'En negociación', 0),
  ('oportunidades', 'Oportunidades', 0)
on conflict (id) do nothing;

drop trigger if exists expansion_contactos_set_updated_at on public.expansion_contactos;
create trigger expansion_contactos_set_updated_at
before update on public.expansion_contactos
for each row
execute function public.set_updated_at();

drop trigger if exists expansion_sitios_set_updated_at on public.expansion_sitios;
create trigger expansion_sitios_set_updated_at
before update on public.expansion_sitios
for each row
execute function public.set_updated_at();

revoke all on table public.expansion_contactos from anon, authenticated, public;
revoke all on table public.expansion_sitios from anon, authenticated, public;
revoke all on table public.expansion_actividades from anon, authenticated, public;
revoke all on table public.expansion_metas from anon, authenticated, public;
grant all on table public.expansion_contactos to service_role;
grant all on table public.expansion_sitios to service_role;
grant all on table public.expansion_actividades to service_role;
grant all on table public.expansion_metas to service_role;

alter table public.expansion_contactos enable row level security;
alter table public.expansion_contactos force row level security;
alter table public.expansion_sitios enable row level security;
alter table public.expansion_sitios force row level security;
alter table public.expansion_actividades enable row level security;
alter table public.expansion_actividades force row level security;
alter table public.expansion_metas enable row level security;
alter table public.expansion_metas force row level security;

drop policy if exists "service_role_expansion_contactos_all" on public.expansion_contactos;
create policy "service_role_expansion_contactos_all"
  on public.expansion_contactos
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "service_role_expansion_sitios_all" on public.expansion_sitios;
create policy "service_role_expansion_sitios_all"
  on public.expansion_sitios
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "service_role_expansion_actividades_all" on public.expansion_actividades;
create policy "service_role_expansion_actividades_all"
  on public.expansion_actividades
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "service_role_expansion_metas_all" on public.expansion_metas;
create policy "service_role_expansion_metas_all"
  on public.expansion_metas
  for all
  to service_role
  using (true)
  with check (true);

/* Si el script anterior ya se corrió, estas columnas y etapas se agregan sin borrar datos. */

alter table public.expansion_contactos add column if not exists whatsapp text;
alter table public.expansion_contactos add column if not exists cargo text;
alter table public.expansion_contactos add column if not exists zona text;
alter table public.expansion_contactos add column if not exists especialidad text;
alter table public.expansion_contactos add column if not exists web text;
alter table public.expansion_contactos add column if not exists instagram text;
alter table public.expansion_contactos add column if not exists linkedin text;
alter table public.expansion_contactos add column if not exists fuente text;

alter table public.expansion_sitios add column if not exists direccion text;
alter table public.expansion_sitios add column if not exists lat double precision;
alter table public.expansion_sitios add column if not exists lng double precision;
alter table public.expansion_sitios add column if not exists desarrollador text;
alter table public.expansion_sitios add column if not exists unidades integer;
alter table public.expansion_sitios add column if not exists entrega text;
alter table public.expansion_sitios add column if not exists por_que text;
alter table public.expansion_sitios add column if not exists web text;
alter table public.expansion_sitios add column if not exists fuente text;

alter table public.expansion_sitios drop constraint if exists expansion_sitios_etapa_check;

update public.expansion_sitios
set etapa = case etapa
  when 'contacto' then 'identificado'
  when 'visita' then 'contactado'
  when 'propuesta' then 'presentacion_enviada'
  when 'acuerdo' then 'oportunidad'
  when 'apertura' then 'oportunidad'
  else etapa
end
where etapa in ('contacto', 'visita', 'propuesta', 'acuerdo', 'apertura');

alter table public.expansion_sitios alter column etapa set default 'identificado';

alter table public.expansion_contactos drop constraint if exists expansion_contactos_fuente_check;
alter table public.expansion_contactos
  add constraint expansion_contactos_fuente_check
  check (fuente is null or fuente in ('google', 'maps', 'instagram', 'linkedin', 'hunter', 'website', 'portal', 'prensa', 'gmail', 'otro'));

alter table public.expansion_sitios
  add constraint expansion_sitios_etapa_check
  check (etapa in ('identificado', 'contacto_encontrado', 'contactado', 'presentacion_enviada', 'respondio', 'conversacion', 'oportunidad', 'negociacion', 'pausa', 'descartado'));

alter table public.expansion_sitios drop constraint if exists expansion_sitios_fuente_check;
alter table public.expansion_sitios
  add constraint expansion_sitios_fuente_check
  check (fuente is null or fuente in ('google', 'maps', 'instagram', 'linkedin', 'hunter', 'website', 'portal', 'prensa', 'gmail', 'otro'));

alter table public.expansion_sitios drop constraint if exists expansion_sitios_unidades_check;
alter table public.expansion_sitios
  add constraint expansion_sitios_unidades_check
  check (unidades is null or unidades >= 0);

alter table public.expansion_sitios drop constraint if exists expansion_sitios_ubicacion_check;
alter table public.expansion_sitios
  add constraint expansion_sitios_ubicacion_check
  check ((lat is null and lng is null) or (lat between -90 and 90 and lng between -180 and 180));

alter table public.expansion_actividades drop constraint if exists expansion_actividades_tipo_check;
alter table public.expansion_actividades
  add constraint expansion_actividades_tipo_check
  check (tipo in ('nota', 'investigacion', 'llamada', 'whatsapp', 'email', 'visita', 'presentacion', 'propuesta'));

insert into public.expansion_metas (id, etiqueta, meta)
values ('oportunidades', 'Oportunidades', 0)
on conflict (id) do nothing;

delete from public.expansion_metas where id = 'aperturas';
