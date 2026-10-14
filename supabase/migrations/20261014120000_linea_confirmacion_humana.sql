-- Confirmación humana del producto y de las unidades de una línea.
-- origen_ligue distingue un ligue de persona (humano) de uno automático (propuesta_auto o alias).

alter table public.factura_lineas
  add column if not exists producto_confirmado_por text,
  add column if not exists producto_confirmado_en timestamptz,
  add column if not exists origen_ligue text,
  add column if not exists unidades_confirmado_por text,
  add column if not exists unidades_confirmado_en timestamptz;

alter table public.factura_lineas drop constraint if exists factura_lineas_origen_ligue_check;
alter table public.factura_lineas
  add constraint factura_lineas_origen_ligue_check
  check (origen_ligue is null or origen_ligue in ('humano', 'propuesta_auto', 'alias'));
