-- Solicitudes de productos que el cliente no encontró en el catálogo.

create table if not exists public.product_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers (id) on delete set null,
  phone_number text not null,
  producto_solicitado text not null,
  nota text,
  nota_admin text,
  estado text not null default 'pendiente',
  created_at timestamptz not null default now(),
  constraint product_requests_estado_check check (estado in ('pendiente', 'agregado', 'no_disponible')),
  constraint product_requests_producto_check check (char_length(btrim(producto_solicitado)) >= 2)
);

create index if not exists idx_product_requests_estado_created
  on public.product_requests (estado, created_at desc);

create index if not exists idx_product_requests_customer_id
  on public.product_requests (customer_id);

revoke all on table public.product_requests from anon, authenticated, public;
grant all on table public.product_requests to service_role;

alter table public.product_requests enable row level security;
alter table public.product_requests force row level security;

drop policy if exists "service_role_product_requests_all" on public.product_requests;
create policy "service_role_product_requests_all"
  on public.product_requests
  for all
  to service_role
  using (true)
  with check (true);
