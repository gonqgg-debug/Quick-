-- Fase 3 de facturas: pagos de caja ligados a la factura, recordatorios sin duplicar y notas de crédito
-- ligadas a la factura original.

create table if not exists public.factura_pagos (
  id uuid primary key default gen_random_uuid(),
  factura_id uuid not null references public.facturas (id) on delete cascade,
  ledger_id uuid not null references public.caja_ledger (id) on delete cascade,
  monto numeric(14, 2) not null,
  confirmado_por text not null,
  confirmado_en timestamptz not null default now(),
  constraint factura_pagos_monto_check check (monto > 0)
);

-- Un movimiento de caja paga una sola factura.
create unique index if not exists idx_factura_pagos_ledger on public.factura_pagos (ledger_id);
create index if not exists idx_factura_pagos_factura on public.factura_pagos (factura_id);

insert into public.factura_pagos (factura_id, ledger_id, monto, confirmado_por)
select f.id, f.ledger_id, l.monto, 'migración'
from public.facturas f
join public.caja_ledger l on l.id = f.ledger_id
where f.ledger_id is not null
  and l.monto > 0
on conflict do nothing;

alter table public.excepciones add column if not exists caso text;

-- El mismo caso de la misma factura no se abre dos veces mientras siga abierto.
create unique index if not exists idx_excepciones_caso_abierto
  on public.excepciones (factura_id, caso)
  where estado = 'abierta' and caso is not null;

alter table public.facturas
  add column if not exists factura_origen_id uuid references public.facturas (id) on delete set null;

create index if not exists idx_facturas_origen on public.facturas (factura_origen_id) where factura_origen_id is not null;

alter table public.facturas drop constraint if exists facturas_origen_check;
alter table public.facturas
  add constraint facturas_origen_check
  check (factura_origen_id is null or (factura_origen_id <> id and tipo_documento = 'nota_credito'));

alter table public.compras add column if not exists notas_credito numeric(14, 2) not null default 0;

alter table public.compras drop constraint if exists compras_notas_credito_check;
alter table public.compras
  add constraint compras_notas_credito_check
  check (notas_credito >= 0);

revoke all on table public.factura_pagos from anon, authenticated, public;
grant all on table public.factura_pagos to service_role;
alter table public.factura_pagos enable row level security;
alter table public.factura_pagos force row level security;
