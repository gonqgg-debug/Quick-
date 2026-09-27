/* Enlaza cada línea de factura con un producto del catálogo. */

alter table public.factura_lineas
  add column if not exists producto_id uuid references public.products (id) on delete set null;

create index if not exists idx_factura_lineas_producto
  on public.factura_lineas (producto_id);
