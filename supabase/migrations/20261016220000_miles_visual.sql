-- Representación visual declarativa y resolución estructurada.
-- No cambia estados buscando palabras en el texto. Los hallazgos viejos siguen como estaban.

alter table public.miles_hallazgos
  add column if not exists visual jsonb,
  add column if not exists resolucion text,
  add column if not exists recomendacion_estado text;

alter table public.miles_hallazgos
  drop constraint if exists miles_hallazgos_resolucion_check;
alter table public.miles_hallazgos
  add constraint miles_hallazgos_resolucion_check
  check (resolucion is null or resolucion in ('pendiente', 'resuelta'));

alter table public.miles_hallazgos
  drop constraint if exists miles_hallazgos_recomendacion_estado_check;
alter table public.miles_hallazgos
  add constraint miles_hallazgos_recomendacion_estado_check
  check (recomendacion_estado is null or recomendacion_estado in ('vigente', 'obsoleta'));

comment on column public.miles_hallazgos.visual is
  'Objeto declarativo: tipo, métrica, serie y filtros. No contiene HTML ni código.';
comment on column public.miles_hallazgos.resolucion is
  'Resolución humana estructurada. Null significa que nadie la registró.';
comment on column public.miles_hallazgos.recomendacion_estado is
  'vigente u obsoleta. La recomendación anterior se conserva en el texto.';
