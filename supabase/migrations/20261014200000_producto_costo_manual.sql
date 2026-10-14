-- Costo escrito a mano o traído de Odoo. No reemplaza el costo de las facturas:
-- el admin muestra el más reciente de los dos.

alter table public.products
  add column if not exists costo_manual numeric(14, 4),
  add column if not exists costo_manual_fuente text,
  add column if not exists costo_manual_en timestamptz;

alter table public.products drop constraint if exists products_costo_manual_check;
alter table public.products
  add constraint products_costo_manual_check
  check (
    (costo_manual is null and costo_manual_fuente is null and costo_manual_en is null)
    or (
      costo_manual is not null
      and costo_manual >= 0
      and costo_manual_fuente in ('odoo', 'admin')
      and costo_manual_en is not null
    )
  );
