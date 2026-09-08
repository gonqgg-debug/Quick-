-- Colecciones curadas del home del catálogo.
-- Las filas de contenido se cargan en el dashboard; esta migración solo define el esquema.

create table if not exists public.home_colecciones (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nombre text not null,
  descripcion text,
  activa boolean not null default true,
  orden integer not null default 0
);

create table if not exists public.home_coleccion_productos (
  id uuid primary key default gen_random_uuid(),
  coleccion_id uuid not null references public.home_colecciones (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  orden integer not null default 0,
  constraint home_coleccion_productos_unique unique (coleccion_id, product_id)
);

create index if not exists idx_home_colecciones_activa_orden
  on public.home_colecciones (activa, orden);

create index if not exists idx_home_coleccion_productos_coleccion_orden
  on public.home_coleccion_productos (coleccion_id, orden);

alter table public.home_colecciones enable row level security;
alter table public.home_coleccion_productos enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'home_colecciones' and policyname = 'home_colecciones_public_read'
  ) then
    create policy home_colecciones_public_read
      on public.home_colecciones
      for select
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'home_coleccion_productos' and policyname = 'home_coleccion_productos_public_read'
  ) then
    create policy home_coleccion_productos_public_read
      on public.home_coleccion_productos
      for select
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'home_colecciones' and policyname = 'service_role_home_colecciones_all'
  ) then
    create policy service_role_home_colecciones_all
      on public.home_colecciones
      for all
      to service_role
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'home_coleccion_productos' and policyname = 'service_role_home_coleccion_productos_all'
  ) then
    create policy service_role_home_coleccion_productos_all
      on public.home_coleccion_productos
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end
$$;

grant select on table public.home_colecciones to anon, authenticated;
grant select on table public.home_coleccion_productos to anon, authenticated;
grant all on table public.home_colecciones to service_role;
grant all on table public.home_coleccion_productos to service_role;
