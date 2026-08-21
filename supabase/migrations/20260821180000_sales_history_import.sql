-- Histórico de ventas importado (p. ej. desde Odoo) para ranking de "Lo más pedido".
-- cantidad_vendida se acumula por codigo_odoo; periodo permite varios cortes.

create table if not exists public.sales_history_import (
  id uuid primary key default gen_random_uuid(),
  codigo_odoo text not null,
  cantidad_vendida numeric not null,
  periodo text,
  created_at timestamptz not null default now(),
  constraint sales_history_import_cantidad_check check (cantidad_vendida > 0)
);

create index if not exists idx_sales_history_import_codigo_odoo
  on public.sales_history_import (codigo_odoo);

create index if not exists idx_sales_history_import_periodo
  on public.sales_history_import (periodo);

revoke all on table public.sales_history_import from anon, authenticated, public;
grant all on table public.sales_history_import to service_role;

alter table public.sales_history_import enable row level security;
alter table public.sales_history_import force row level security;

drop policy if exists "service_role_sales_history_import_all" on public.sales_history_import;
create policy "service_role_sales_history_import_all"
  on public.sales_history_import
  for all
  to service_role
  using (true)
  with check (true);
