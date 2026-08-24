-- Proveedores y compras a crédito (herramienta diaria de admin).

create table if not exists public.proveedores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tiene_credito boolean not null default false,
  dias_credito integer not null default 0,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint proveedores_nombre_check check (char_length(btrim(nombre)) >= 1),
  constraint proveedores_dias_credito_check check (dias_credito >= 0)
);

create unique index if not exists idx_proveedores_nombre_lower
  on public.proveedores (lower(btrim(nombre)));

create trigger proveedores_set_updated_at
before update on public.proveedores
for each row
execute function public.set_updated_at();

create table if not exists public.compras (
  id uuid primary key default gen_random_uuid(),
  proveedor_id uuid not null references public.proveedores (id) on delete restrict,
  monto numeric not null,
  fecha date not null,
  due_date date not null,
  pagado boolean not null default false,
  pagado_en date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint compras_monto_check check (monto > 0)
);

create index if not exists idx_compras_pagado_due_date
  on public.compras (pagado, due_date);

create index if not exists idx_compras_fecha
  on public.compras (fecha desc);

create index if not exists idx_compras_proveedor_id
  on public.compras (proveedor_id);

create trigger compras_set_updated_at
before update on public.compras
for each row
execute function public.set_updated_at();

revoke all on table public.proveedores from anon, authenticated, public;
revoke all on table public.compras from anon, authenticated, public;
grant all on table public.proveedores to service_role;
grant all on table public.compras to service_role;

alter table public.proveedores enable row level security;
alter table public.proveedores force row level security;
alter table public.compras enable row level security;
alter table public.compras force row level security;

drop policy if exists "service_role_proveedores_all" on public.proveedores;
create policy "service_role_proveedores_all"
  on public.proveedores
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "service_role_compras_all" on public.compras;
create policy "service_role_compras_all"
  on public.compras
  for all
  to service_role
  using (true)
  with check (true);
