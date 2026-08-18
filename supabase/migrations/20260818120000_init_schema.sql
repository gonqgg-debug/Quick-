-- Quick Orders: esquema inicial
-- Acceso directo desde anon/authenticated queda bloqueado.
-- El service role (API routes del servidor) bypassa RLS.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table public.chats (
  id uuid primary key default gen_random_uuid(),
  phone_number text not null,
  nombre text,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  precio numeric not null,
  foto_url text,
  categoria text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.order_sessions (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats (id) on delete cascade,
  created_at timestamptz not null default now(),
  expira_en timestamptz not null,
  estado text not null default 'activa',
  constraint order_sessions_estado_check
    check (estado in ('activa', 'usada', 'expirada'))
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats (id) on delete cascade,
  session_id uuid not null references public.order_sessions (id) on delete restrict,
  direccion text not null,
  metodo_pago text not null,
  estado text not null default 'nueva',
  total_estimado numeric not null default 0,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_metodo_pago_check
    check (metodo_pago in ('efectivo', 'tarjeta')),
  constraint orders_estado_check
    check (estado in (
      'nueva',
      'en_proceso',
      'faltante_reportado',
      'confirmada',
      'completada',
      'cancelada'
    ))
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  cantidad integer not null,
  precio_unitario numeric not null,
  estado text not null default 'ok',
  producto_reemplazo_id uuid references public.products (id) on delete set null,
  constraint order_items_cantidad_check check (cantidad > 0),
  constraint order_items_estado_check
    check (estado in ('ok', 'faltante', 'reemplazado', 'eliminado'))
);

create table public.whatsapp_log (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats (id) on delete cascade,
  direccion text not null,
  contenido text not null,
  created_at timestamptz not null default now(),
  constraint whatsapp_log_direccion_check
    check (direccion in ('entrante', 'saliente'))
);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger orders_set_updated_at
before update on public.orders
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------------

create unique index idx_chats_phone_number on public.chats (phone_number);
create index idx_order_sessions_session_id on public.order_sessions (id);
create index idx_orders_chat_id on public.orders (chat_id);

create index idx_order_sessions_chat_id on public.order_sessions (chat_id);
create index idx_orders_session_id on public.orders (session_id);
create index idx_order_items_order_id on public.order_items (order_id);
create index idx_whatsapp_log_chat_id on public.whatsapp_log (chat_id);

-- ---------------------------------------------------------------------------
-- Privilegios: el cliente (anon/authenticated) no toca estas tablas.
-- Todo el acceso pasa por API routes con SUPABASE_SERVICE_ROLE_KEY.
-- ---------------------------------------------------------------------------

revoke all on table public.chats from anon, authenticated, public;
revoke all on table public.products from anon, authenticated, public;
revoke all on table public.order_sessions from anon, authenticated, public;
revoke all on table public.orders from anon, authenticated, public;
revoke all on table public.order_items from anon, authenticated, public;
revoke all on table public.whatsapp_log from anon, authenticated, public;

grant all on table public.chats to service_role;
grant all on table public.products to service_role;
grant all on table public.order_sessions to service_role;
grant all on table public.orders to service_role;
grant all on table public.order_items to service_role;
grant all on table public.whatsapp_log to service_role;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- Sin políticas para anon/authenticated = denegado.
-- Políticas de service_role son explícitas; el rol service_role además
-- tiene BYPASSRLS, así que las API routes del servidor siempre pasan.
-- ---------------------------------------------------------------------------

alter table public.chats enable row level security;
alter table public.products enable row level security;
alter table public.order_sessions enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.whatsapp_log enable row level security;

alter table public.chats force row level security;
alter table public.products force row level security;
alter table public.order_sessions force row level security;
alter table public.orders force row level security;
alter table public.order_items force row level security;
alter table public.whatsapp_log force row level security;

create policy "service_role_chats_all"
  on public.chats
  for all
  to service_role
  using (true)
  with check (true);

create policy "service_role_products_all"
  on public.products
  for all
  to service_role
  using (true)
  with check (true);

create policy "service_role_order_sessions_all"
  on public.order_sessions
  for all
  to service_role
  using (true)
  with check (true);

create policy "service_role_orders_all"
  on public.orders
  for all
  to service_role
  using (true)
  with check (true);

create policy "service_role_order_items_all"
  on public.order_items
  for all
  to service_role
  using (true)
  with check (true);

create policy "service_role_whatsapp_log_all"
  on public.whatsapp_log
  for all
  to service_role
  using (true)
  with check (true);
