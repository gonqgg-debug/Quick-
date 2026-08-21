-- Canal de origen del pedido (quick | pharmaquick más adelante).
-- Default 'quick' para no romper sesiones y pedidos actuales.
-- customers permanece compartido por phone_number, sin columna de tienda.

alter table public.order_sessions
  add column if not exists tienda text not null default 'quick';

alter table public.orders
  add column if not exists tienda text not null default 'quick';

create index if not exists idx_order_sessions_tienda
  on public.order_sessions (tienda);

create index if not exists idx_orders_tienda
  on public.orders (tienda);
