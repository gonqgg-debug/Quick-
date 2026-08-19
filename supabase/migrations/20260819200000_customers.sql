-- Clientes registrados: ficha, direcciones guardadas y vínculo con chats/pedidos.

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  phone_number text not null,
  nombre text not null,
  apellido text not null,
  created_at timestamptz not null default now(),
  constraint customers_phone_number_key unique (phone_number)
);

create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  direccion text not null,
  etiqueta text,
  es_predeterminada boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.orders
  add column if not exists customer_id uuid references public.customers (id) on delete set null;

alter table public.chats
  add column if not exists customer_id uuid references public.customers (id) on delete set null;

create index if not exists idx_customer_addresses_customer_id
  on public.customer_addresses (customer_id);

create unique index if not exists idx_customer_addresses_one_default
  on public.customer_addresses (customer_id)
  where es_predeterminada;

create index if not exists idx_orders_customer_id
  on public.orders (customer_id);

create index if not exists idx_chats_customer_id
  on public.chats (customer_id);

revoke all on table public.customers from anon, authenticated, public;
revoke all on table public.customer_addresses from anon, authenticated, public;

grant all on table public.customers to service_role;
grant all on table public.customer_addresses to service_role;

alter table public.customers enable row level security;
alter table public.customer_addresses enable row level security;

alter table public.customers force row level security;
alter table public.customer_addresses force row level security;

drop policy if exists "service_role_customers_all" on public.customers;
create policy "service_role_customers_all"
  on public.customers
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "service_role_customer_addresses_all" on public.customer_addresses;
create policy "service_role_customer_addresses_all"
  on public.customer_addresses
  for all
  to service_role
  using (true)
  with check (true);
