alter table public.products
  add column if not exists codigo_odoo text;

alter table public.products
  drop constraint if exists products_codigo_odoo_key;

alter table public.products
  add constraint products_codigo_odoo_key unique (codigo_odoo);
