-- Pedidos de prueba generados desde /admin (no cuentan en métricas ni exportaciones por defecto).

alter table public.order_sessions
  add column if not exists es_prueba boolean not null default false;

alter table public.orders
  add column if not exists es_prueba boolean not null default false;

create index if not exists idx_orders_es_prueba
  on public.orders (es_prueba)
  where es_prueba = true;
