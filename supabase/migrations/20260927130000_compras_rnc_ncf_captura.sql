-- RNC, NCF y captura de la factura en cada compra.
-- Las filas viejas quedan sin estos datos. Las nuevas los exigen desde la app.

alter table public.compras
  add column if not exists rnc text,
  add column if not exists ncf text,
  add column if not exists captura_path text;

alter table public.compras drop constraint if exists compras_rnc_check;
alter table public.compras
  add constraint compras_rnc_check
  check (rnc is null or rnc ~ '^[0-9]{9}$' or rnc ~ '^[0-9]{11}$');

alter table public.compras drop constraint if exists compras_ncf_check;
alter table public.compras
  add constraint compras_ncf_check
  check (ncf is null or ncf ~ '^[A-Z][0-9]{10}$' or ncf ~ '^E[0-9]{12}$');

create unique index if not exists idx_compras_rnc_ncf
  on public.compras (rnc, ncf)
  where rnc is not null and ncf is not null;
