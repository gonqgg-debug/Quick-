-- Pago de una compra (medio, fecha y movimiento) y quién cambió cada campo.
-- El descarte de una ficha guarda el motivo aunque la factura ya no exista.

alter table public.compras
  add column if not exists medio_pago text,
  add column if not exists ledger_id uuid,
  add column if not exists movimiento_id uuid;

alter table public.compras drop constraint if exists compras_medio_pago_check;
alter table public.compras
  add constraint compras_medio_pago_check
  check (medio_pago is null or medio_pago in ('caja_chica', 'caja_fuerte', 'transferencia'));

alter table public.compras drop constraint if exists compras_ledger_id_fkey;
alter table public.compras
  add constraint compras_ledger_id_fkey
  foreign key (ledger_id) references public.caja_ledger (id) on delete set null;

alter table public.compras drop constraint if exists compras_movimiento_id_fkey;
alter table public.compras
  add constraint compras_movimiento_id_fkey
  foreign key (movimiento_id) references public.banco_movimientos (id) on delete set null;

alter table public.compras drop constraint if exists compras_pago_un_origen_check;
alter table public.compras
  add constraint compras_pago_un_origen_check
  check (ledger_id is null or movimiento_id is null);

create index if not exists idx_compras_ledger on public.compras (ledger_id) where ledger_id is not null;
create index if not exists idx_compras_movimiento on public.compras (movimiento_id) where movimiento_id is not null;

create table if not exists public.compra_cambios (
  id uuid primary key default gen_random_uuid(),
  compra_id uuid not null references public.compras (id) on delete cascade,
  actor text not null,
  campo text not null,
  antes text,
  despues text,
  creado_en timestamptz not null default now(),
  constraint compra_cambios_actor_check check (char_length(btrim(actor)) >= 1),
  constraint compra_cambios_campo_check check (char_length(btrim(campo)) >= 1)
);

create index if not exists idx_compra_cambios_compra on public.compra_cambios (compra_id, creado_en desc);

create table if not exists public.factura_descartes (
  id uuid primary key default gen_random_uuid(),
  factura_id uuid not null,
  referencia text,
  proveedor text,
  ncf text,
  numero_factura text,
  total numeric(14, 2),
  motivo text not null,
  por text not null,
  creado_en timestamptz not null default now(),
  constraint factura_descartes_motivo_check check (char_length(btrim(motivo)) >= 3),
  constraint factura_descartes_por_check check (char_length(btrim(por)) >= 1)
);

create index if not exists idx_factura_descartes_factura on public.factura_descartes (factura_id);

revoke all on table public.compra_cambios from anon, authenticated, public;
revoke all on table public.factura_descartes from anon, authenticated, public;
grant all on table public.compra_cambios to service_role;
grant all on table public.factura_descartes to service_role;

alter table public.compra_cambios enable row level security;
alter table public.compra_cambios force row level security;
alter table public.factura_descartes enable row level security;
alter table public.factura_descartes force row level security;

drop policy if exists "service_role_compra_cambios_all" on public.compra_cambios;
create policy "service_role_compra_cambios_all"
  on public.compra_cambios
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "service_role_factura_descartes_all" on public.factura_descartes;
create policy "service_role_factura_descartes_all"
  on public.factura_descartes
  for all
  to service_role
  using (true)
  with check (true);
