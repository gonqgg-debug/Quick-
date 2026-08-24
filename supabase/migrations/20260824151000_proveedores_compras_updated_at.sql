-- The proveedores/compras tables already existed without updated_at.
-- Triggers from 20260824150000 call set_updated_at, so the column must exist.

alter table public.proveedores
  add column if not exists updated_at timestamptz not null default now();

alter table public.compras
  add column if not exists updated_at timestamptz not null default now();
