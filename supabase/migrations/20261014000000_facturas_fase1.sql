-- Fase 1 de facturas: ficha de proveedor con RNC y forma de pago, factura ligada al proveedor,
-- validaciones automáticas de NCF y RNC, y tipo de documento (página o ticket).

alter table public.proveedores
  add column if not exists rnc text,
  add column if not exists forma_pago text;

alter table public.proveedores drop constraint if exists proveedores_rnc_check;
alter table public.proveedores
  add constraint proveedores_rnc_check
  check (rnc is null or rnc ~ '^[0-9]{9}$' or rnc ~ '^[0-9]{11}$');

alter table public.proveedores drop constraint if exists proveedores_forma_pago_check;
alter table public.proveedores
  add constraint proveedores_forma_pago_check
  check (forma_pago is null or forma_pago in ('efectivo', 'transferencia', 'mixto'));

create unique index if not exists idx_proveedores_rnc
  on public.proveedores (rnc)
  where rnc is not null;

-- Un proveedor recibe el RNC de sus compras solo si todas usan el mismo y ningún otro proveedor lo usa.
with unico as (
  select proveedor_id, min(rnc) as rnc
  from public.compras
  where rnc is not null
  group by proveedor_id
  having count(distinct rnc) = 1
),
sin_choque as (
  select u.proveedor_id, u.rnc
  from unico u
  where (select count(*) from unico o where o.rnc = u.rnc) = 1
)
update public.proveedores p
set rnc = s.rnc
from sin_choque s
where p.id = s.proveedor_id
  and p.rnc is null
  and not exists (select 1 from public.proveedores x where x.rnc = s.rnc);

alter table public.facturas
  add column if not exists proveedor_id uuid references public.proveedores (id) on delete set null;

create index if not exists idx_facturas_proveedor on public.facturas (proveedor_id);
create index if not exists idx_facturas_rnc_ncf on public.facturas (rnc, ncf) where ncf is not null;

update public.facturas f
set proveedor_id = p.id
from public.proveedores p
where f.proveedor_id is null
  and f.rnc is not null
  and p.rnc = f.rnc;

update public.facturas f
set proveedor_id = p.id
from public.proveedores p
where f.proveedor_id is null
  and f.proveedor is not null
  and lower(btrim(p.nombre)) = lower(btrim(f.proveedor));

alter table public.factura_documentos
  add column if not exists tipo text not null default 'pagina';

alter table public.factura_documentos drop constraint if exists factura_documentos_tipo_check;
alter table public.factura_documentos
  add constraint factura_documentos_tipo_check
  check (tipo in ('pagina', 'ticket'));

alter table public.factura_validaciones drop constraint if exists factura_validaciones_codigo_check;
alter table public.factura_validaciones
  add constraint factura_validaciones_codigo_check
  check (codigo in (
    'suma_lineas', 'itbis', 'total', 'ncf_legible', 'numero_legible', 'posible_duplicado', 'paginas',
    'cantidades', 'diferencia_matematica', 'documento_completo', 'ncf_formato', 'ncf_unico', 'rnc_proveedor'
  ));
