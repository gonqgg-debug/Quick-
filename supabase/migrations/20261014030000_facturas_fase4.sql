-- Fase 4 de facturas: movimientos del estado de cuenta del banco, pagos ligados al banco y
-- umbrales configurables para las alertas de precio y cantidad.

create table if not exists public.banco_movimientos (
  id uuid primary key default gen_random_uuid(),
  banco text not null,
  cuenta text,
  fecha date not null,
  descripcion text,
  referencia text,
  tipo text not null,
  monto numeric(14, 2) not null,
  moneda text not null default 'DOP',
  -- Identifica la fila del estado de cuenta: reimportar el mismo archivo no duplica.
  huella text not null,
  archivo text,
  importado_por text not null,
  importado_en timestamptz not null default now(),
  constraint banco_movimientos_tipo_check check (tipo in ('debito', 'credito')),
  constraint banco_movimientos_monto_check check (monto > 0),
  constraint banco_movimientos_moneda_check check (moneda in ('DOP', 'USD'))
);

create unique index if not exists idx_banco_movimientos_huella on public.banco_movimientos (huella);
create index if not exists idx_banco_movimientos_fecha on public.banco_movimientos (fecha desc);
create index if not exists idx_banco_movimientos_debitos on public.banco_movimientos (moneda, fecha, monto) where tipo = 'debito';

alter table public.factura_pagos alter column ledger_id drop not null;
alter table public.factura_pagos
  add column if not exists movimiento_id uuid references public.banco_movimientos (id) on delete cascade;

alter table public.factura_pagos drop constraint if exists factura_pagos_origen_check;
alter table public.factura_pagos
  add constraint factura_pagos_origen_check
  check ((ledger_id is null) <> (movimiento_id is null));

-- Un movimiento del banco paga una sola factura, igual que uno de caja.
create unique index if not exists idx_factura_pagos_movimiento on public.factura_pagos (movimiento_id) where movimiento_id is not null;

alter table public.parametros add column if not exists alerta_precio numeric(6, 4) not null default 0.15;
alter table public.parametros add column if not exists alerta_cantidad numeric(6, 4) not null default 0.5;

alter table public.parametros drop constraint if exists parametros_alerta_precio_check;
alter table public.parametros
  add constraint parametros_alerta_precio_check
  check (alerta_precio > 0 and alerta_precio <= 5);

alter table public.parametros drop constraint if exists parametros_alerta_cantidad_check;
alter table public.parametros
  add constraint parametros_alerta_cantidad_check
  check (alerta_cantidad > 0 and alerta_cantidad <= 10);

revoke all on table public.banco_movimientos from anon, authenticated, public;
grant all on table public.banco_movimientos to service_role;
alter table public.banco_movimientos enable row level security;
alter table public.banco_movimientos force row level security;
