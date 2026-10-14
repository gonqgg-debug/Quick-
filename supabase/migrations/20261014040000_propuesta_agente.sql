-- Phillip propone el producto de cada línea con su confianza y su razón; la plataforma deja de proponer por nombre
-- y solo da candidatos. Fred deja la confianza y la razón de cada pago que liga.

alter table public.factura_lineas
  add column if not exists propuesta_razon text,
  add column if not exists propuesta_por text,
  add column if not exists propuesta_en timestamptz;

alter table public.factura_lineas drop constraint if exists factura_lineas_propuesta_check;
alter table public.factura_lineas
  add constraint factura_lineas_propuesta_check
  check (
    (propuesta_producto_id is null and propuesta_confianza is null and propuesta_origen is null)
    or (
      propuesta_producto_id is not null
      and propuesta_confianza between 0 and 100
      and propuesta_origen in ('alias', 'barras', 'odoo', 'texto', 'agente')
      and (propuesta_origen <> 'agente' or char_length(btrim(coalesce(propuesta_razon, ''))) >= 3)
    )
  );

-- Las propuestas por nombre parecido de facturas abiertas se quitan: ahora las hace Phillip.
update public.factura_lineas l
set propuesta_producto_id = null,
    propuesta_confianza = null,
    propuesta_origen = null
from public.facturas f
where f.id = l.factura_id
  and f.estado <> 'conciliada'
  and l.producto_id is null
  and l.propuesta_origen = 'texto';

alter table public.factura_pagos
  add column if not exists confianza integer,
  add column if not exists razon text;

alter table public.factura_pagos drop constraint if exists factura_pagos_confianza_check;
alter table public.factura_pagos
  add constraint factura_pagos_confianza_check
  check (confianza is null or confianza between 0 and 100);
