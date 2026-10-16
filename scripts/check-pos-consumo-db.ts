import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migration = join(root, "supabase/migrations/20261016120000_pos_ingesta.sql");
const migrationCosto = join(root, "supabase/migrations/20261016190000_costo_con_itbis.sql");
const migrationMiles = join(root, "supabase/migrations/20261016200000_miles_consumo.sql");
const migrationVuelto = join(root, "supabase/migrations/20261016210000_pagos_con_vuelto.sql");
const migrationVisual = join(root, "supabase/migrations/20261016220000_miles_visual.sql");
const DB = "quick_pos_test";

function quote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function run(bin: string[], args: string[], input?: string) {
  return execFileSync(bin[0], [...bin.slice(1), ...args], {
    input,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
}

function psqlBin(): string[] {
  const probe = ["-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", "select 1"];
  const host = process.env.PGHOST;
  if (host) {
    const prefix = ["psql", "-h", host, "-p", process.env.PGPORT ?? "5432", "-U", process.env.PGUSER ?? "postgres"];
    run(prefix, probe);
    return prefix;
  }
  try {
    run(["psql"], probe);
    return ["psql"];
  } catch {
    run(["sudo", "-n", "-u", "postgres", "psql"], probe);
    return ["sudo", "-n", "-u", "postgres", "psql"];
  }
}

const bin = psqlBin();

function sql(database: string, text: string) {
  run(bin, ["-d", database, "-v", "ON_ERROR_STOP=1", "--no-psqlrc"], text);
}

function sqlFile(database: string, file: string) {
  run(bin, ["-d", database, "-v", "ON_ERROR_STOP=1", "--no-psqlrc", "-f", file]);
}

sql(
  "postgres",
  `
select pg_terminate_backend(pid)
from pg_stat_activity
where datname = ${quote(DB)} and pid <> pg_backend_pid();
drop database if exists ${DB};
create database ${DB};
`,
);

sql(
  DB,
  `
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  precio numeric not null default 0,
  categoria text not null default 'General',
  marca text,
  activo boolean not null default true,
  codigo_odoo text unique,
  costo_manual numeric,
  costo_manual_fuente text,
  costo_manual_en timestamptz
);

create table public.facturas (
  id uuid primary key default gen_random_uuid(),
  tipo_documento text not null default 'factura',
  fecha_emision date,
  recibido_en timestamptz not null default now()
);

create table public.factura_lineas (
  id uuid primary key default gen_random_uuid(),
  factura_id uuid not null references public.facturas (id),
  producto_id uuid,
  costo_unitario numeric
);

create table public.ventas_diarias (
  id uuid primary key default gen_random_uuid(),
  fecha date not null unique,
  dia_semana text,
  venta_real numeric(12, 2) not null
);

insert into public.ventas_diarias (fecha, dia_semana, venta_real)
values ('2026-10-14', 'miércoles', 90000);
`,
);

sqlFile(DB, migration);
sqlFile(DB, migrationCosto);
sqlFile(DB, migrationMiles);
sqlFile(DB, migrationVuelto);
sqlFile(DB, migrationVisual);

sql(
  DB,
  `
do $test$
#variable_conflict use_column
declare
  venta numeric;
  venta_pos numeric;
  override boolean;
  alerta boolean;
  n int;
  neta numeric;
  margen numeric;
  hora smallint;
  fecha date;
  match text;
  proc jsonb;
begin
  select override_manual into override from public.ventas_diarias where fecha = '2026-10-14';
  if override is not true then
    raise exception 'la fila que ya existia no quedo con override_manual';
  end if;

  insert into public.products (nombre, categoria, precio, codigo_odoo, costo_manual, costo_manual_fuente, costo_manual_en, tasa_itbis)
  values
    ('Agua', 'Bebidas', 25, 'cod-18', 12, 'admin', now(), 18),
    ('Leche', 'Lacteos', 116, 'cod-16', 100, 'admin', now(), 16),
    ('Pan', 'Pan', 25, 'cod-0', 12, 'admin', now(), 0),
    ('Linea', 'Bebidas', 100, 'cod-linea', 12, 'admin', now(), 18);

  perform public.ingestar_pos_sesion($json$
{
    "tienda":"quick","modo":"completo",
    "sesion":{"odooId":839,"nombre":"POS/00839","estado":"closed","startAt":"2026-10-15T14:00:00Z","totalPagos":15310},
    "ordenes":[{"odooId":839001,"fecha":"2026-10-15T15:00:00Z","total":15310,"estado":"done","pagos":[{"odooId":1839001,"metodo":"Efectivo","monto":15310,"esCambio":false}]}]
  }$json$::jsonb);

  perform public.ingestar_pos_sesion($json$
{
    "tienda":"quick","modo":"completo",
    "sesion":{"odooId":840,"nombre":"POS/00840","estado":"closed","startAt":"2026-10-15T18:00:00Z","totalPagos":69765},
    "ordenes":[
      {"odooId":840001,"fecha":"2026-10-16T04:30:00Z","total":69765,"estado":"done","pagos":[{"odooId":1840001,"metodo":"Efectivo","monto":69765,"esCambio":false}]},
      {"odooId":840002,"fecha":"2026-10-15T20:00:00Z","total":1000,"estado":"cancel","pagos":[]}
    ]
  }$json$::jsonb);

  select venta_real into venta from public.ventas_diarias where fecha = '2026-10-15';
  if venta is distinct from 85075 then
    raise exception '15 oct deberia ser 85075, fue %', venta;
  end if;
  select venta into venta from public.resumen_dia where fecha = '2026-10-15';
  if venta is distinct from 85075 then
    raise exception 'el resumen del 15 oct deberia ser 85075, fue %', venta;
  end if;

  select hora_local, fecha_operativa into hora, fecha from public.pos_ordenes where odoo_id = 840001;
  if hora is distinct from 0 or fecha is distinct from date '2026-10-15' then
    raise exception 'la orden de las 00:30 quedo en hora % fecha %', hora, fecha;
  end if;

  perform public.ingestar_pos_sesion($json$
{
    "tienda":"quick","modo":"completo",
    "sesion":{"odooId":840,"nombre":"POS/00840","estado":"closed","startAt":"2026-10-15T18:00:00Z","totalPagos":69765},
    "ordenes":[
      {"odooId":840001,"fecha":"2026-10-16T04:30:00Z","total":69765,"estado":"done","pagos":[{"odooId":1840001,"metodo":"Efectivo","monto":69765,"esCambio":false}]},
      {"odooId":840002,"fecha":"2026-10-15T20:00:00Z","total":1000,"estado":"cancel","pagos":[]}
    ]
  }$json$::jsonb);
  select count(*) into n from public.pos_ordenes o
  join public.pos_sesiones s on s.id = o.sesion_id
  where s.odoo_id = 840;
  if n is distinct from 2 then
    raise exception 'reimportar duplico la sesion PM, hay % ordenes', n;
  end if;
  if not exists (select 1 from public.pos_ordenes where odoo_id = 840002 and estado = 'cancel') then
    raise exception 'la orden cancelada no se guardo';
  end if;

  perform public.ingestar_pos_sesion($json$
{
    "tienda":"quick","modo":"completo",
    "sesion":{"odooId":838,"nombre":"POS/00838","estado":"closed","startAt":"2026-10-14T18:00:00Z","totalPagos":63795},
    "ordenes":[{"odooId":838001,"fecha":"2026-10-14T20:00:00Z","total":63795,"estado":"paid","pagos":[{"odooId":1838001,"metodo":"Efectivo","monto":63795,"esCambio":false}]}]
  }$json$::jsonb);
  select venta_real, venta_pos, override_manual, alerta_pos
    into venta, venta_pos, override, alerta
  from public.ventas_diarias where fecha = '2026-10-14';
  if venta is distinct from 90000 or override is not true then
    raise exception 'el override se piso: venta % override %', venta, override;
  end if;
  if venta_pos is distinct from 63795 or alerta is not true then
    raise exception 'la diferencia de mas de 500 no quedo visible: pos % alerta %', venta_pos, alerta;
  end if;

  perform public.ingestar_pos_sesion($json$
{
    "tienda":"quick","modo":"completo",
    "sesion":{"odooId":830,"nombre":"POS/00830","estado":"closed","startAt":"2026-10-10T14:00:00Z","totalPagos":170},
    "ordenes":[
      {"odooId":830001,"fecha":"2026-10-10T15:00:00Z","total":200,"estado":"invoiced","pagos":[]},
      {"odooId":830002,"fecha":"2026-10-10T16:00:00Z","total":-30,"estado":"done","pagos":[]},
      {"odooId":830003,"fecha":"2026-10-10T17:00:00Z","total":500,"estado":"draft","pagos":[]}
    ]
  }$json$::jsonb);
  select venta_real into venta from public.ventas_diarias where fecha = '2026-10-10';
  if venta is distinct from 170 then
    raise exception 'la devolucion no resto o el draft conto, fue %', venta;
  end if;

  perform public.ingestar_pos_sesion($json$
{
    "tienda":"quick","modo":"completo",
    "sesion":{"odooId":901,"nombre":"POS/00901","estado":"closed","startAt":"2026-10-12T14:00:00Z","totalPagos":999},
    "ordenes":[{"odooId":9010,"fecha":"2026-10-12T15:00:00Z","total":999,"estado":"done","pagos":[]}]
  }$json$::jsonb);
  perform public.ingestar_pos_sesion($json$
{
    "tienda":"quick","modo":"parcial","loteId":"lote-1",
    "sesion":{"odooId":901,"nombre":"POS/00901","estado":"closed","startAt":"2026-10-12T14:00:00Z","totalPagos":99999},
    "ordenes":[{"odooId":9011,"fecha":"2026-10-12T16:00:00Z","total":10000,"estado":"paid","pagos":[]}]
  }$json$::jsonb);
  select venta_real into venta from public.ventas_diarias where fecha = '2026-10-12';
  if venta is distinct from 999 then
    raise exception 'el parcial recalculo la venta, fue %', venta;
  end if;
  if not exists (
    select 1 from public.pos_sesiones
    where odoo_id = 901 and ingesta = 'parcial' and lote_abierto = 'lote-1'
  ) then
    raise exception 'el parcial no quedo abierto';
  end if;
  perform public.ingestar_pos_sesion($json$
{
    "tienda":"quick","modo":"parcial","loteId":"lote-1",
    "sesion":{"odooId":901,"nombre":"POS/00901","estado":"closed","startAt":"2026-10-12T14:00:00Z","totalPagos":99999},
    "ordenes":[{"odooId":9012,"fecha":"2026-10-12T17:00:00Z","total":5000,"estado":"done","pagos":[]}]
  }$json$::jsonb);
  perform public.ingestar_pos_sesion($json$
{
    "tienda":"quick","modo":"parcial","loteId":"otro",
    "sesion":{"odooId":901,"nombre":"POS/00901","estado":"closed","startAt":"2026-10-12T14:00:00Z","totalPagos":99999},
    "ordenes":[{"odooId":9014,"fecha":"2026-10-12T17:30:00Z","total":1,"estado":"done","pagos":[]}]
  }$json$::jsonb);
  perform public.ingestar_pos_sesion($json$
{
    "tienda":"quick","modo":"final","loteId":"lote-1",
    "sesion":{"odooId":901,"nombre":"POS/00901","estado":"closed","startAt":"2026-10-12T14:00:00Z","totalPagos":15310},
    "ordenes":[{"odooId":9013,"fecha":"2026-10-12T18:00:00Z","total":310,"estado":"done","pagos":[]}]
  }$json$::jsonb);
  if exists (select 1 from public.pos_ordenes where odoo_id in (9010, 9014)) then
    raise exception 'el final dejo ordenes de otro lote';
  end if;
  select count(*) into n from public.pos_ordenes where odoo_id in (9011, 9012, 9013);
  if n is distinct from 3 then
    raise exception 'el final no conservo las partes, hay %', n;
  end if;
  select venta_real into venta from public.ventas_diarias where fecha = '2026-10-12';
  if venta is distinct from 15310 then
    raise exception 'las partes debian sumar 15310, fue %', venta;
  end if;
  if not exists (
    select 1 from public.pos_sesiones
    where odoo_id = 901 and ingesta = 'cerrada' and lote_abierto is null
  ) then
    raise exception 'el final no cerro la sesion';
  end if;

  perform public.ingestar_pos_sesion($json$
{
    "tienda":"quick","modo":"completo",
    "sesion":{"odooId":811,"nombre":"POS/00811","estado":"closed","startAt":"2026-10-11T14:00:00Z","totalPagos":416},
    "ordenes":[{"odooId":811001,"fecha":"2026-10-11T15:00:00Z","total":416,"estado":"done","lineas":[
      {"odooId":1,"odooProductId":1,"codigoOdoo":"cod-18","nombreOdoo":"Agua","cantidad":4,"subtotalConItbis":100},
      {"odooId":2,"odooProductId":2,"codigoOdoo":"cod-16","nombreOdoo":"Leche","cantidad":1,"subtotalConItbis":116},
      {"odooId":3,"odooProductId":3,"codigoOdoo":"cod-0","nombreOdoo":"Pan","cantidad":4,"subtotalConItbis":100},
      {"odooId":4,"odooProductId":4,"codigoOdoo":"cod-linea","nombreOdoo":"Linea","cantidad":1,"subtotalConItbis":100,"tasaItbis":0}
    ],"pagos":[]}]
  }$json$::jsonb);

  select venta_neta into neta from public.resumen_producto_dia where fecha = '2026-10-11' and codigo_odoo = 'cod-18';
  select round(r.venta_neta - p.costo_manual * r.unidades_sin_itbis, 2) into margen
  from public.resumen_producto_dia r
  join public.products p on p.id = r.product_id
  where r.fecha = '2026-10-11' and r.codigo_odoo = 'cod-18';
  if neta is distinct from 84.75 or margen is distinct from 44.07 then
    raise exception 'tasa 18: neta % margen %', neta, margen;
  end if;

  select venta_neta into neta from public.resumen_producto_dia where fecha = '2026-10-11' and codigo_odoo = 'cod-16';
  select round(r.venta_neta - p.costo_manual * r.unidades_sin_itbis, 2) into margen
  from public.resumen_producto_dia r join public.products p on p.id = r.product_id
  where r.fecha = '2026-10-11' and r.codigo_odoo = 'cod-16';
  if neta is distinct from 100 or margen is distinct from 13.79 then
    raise exception 'tasa 16: neta % margen %', neta, margen;
  end if;

  select venta_neta into neta from public.resumen_producto_dia where fecha = '2026-10-11' and codigo_odoo = 'cod-0';
  select round(r.venta_neta - p.costo_manual * r.unidades_sin_itbis, 2) into margen
  from public.resumen_producto_dia r join public.products p on p.id = r.product_id
  where r.fecha = '2026-10-11' and r.codigo_odoo = 'cod-0';
  if neta is distinct from 100 or margen is distinct from 52 then
    raise exception 'tasa 0: neta % margen %', neta, margen;
  end if;

  select l.tasa_itbis, r.venta_neta into neta, margen
  from public.pos_orden_lineas l
  join public.resumen_producto_dia r on r.codigo_odoo = l.codigo_odoo and r.fecha = '2026-10-11'
  where l.codigo_odoo = 'cod-linea';
  if neta is distinct from 0 then
    raise exception 'la linea no guardo tasa 0, fue %', neta;
  end if;
  select round(r.venta_neta - p.costo_manual * r.unidades_sin_itbis, 2) into margen
  from public.resumen_producto_dia r join public.products p on p.id = r.product_id
  where r.fecha = '2026-10-11' and r.codigo_odoo = 'cod-linea';
  if margen is distinct from 88 then
    raise exception 'la tasa de la linea debio ganar sobre la del producto, margen %', margen;
  end if;

  select t.margen into margen
  from public.consumo_top_productos(
    'quick', '2026-10-11', '2026-10-11', null, null, 'venta', null, null, 20, null, null, null
  ) t
  where t.codigo_odoo = 'cod-18';
  if margen is distinct from 44.07 then
    raise exception 'el listado no quita el ITBIS del costo, margen %', margen;
  end if;
  select m.margen into margen from public.consumo_margen_periodo('quick', '2026-10-11', '2026-10-11') m;
  if margen is distinct from (
    select round(sum(r.venta_neta - p.costo_manual * r.unidades_sin_itbis), 2)
    from public.resumen_producto_dia r
    join public.products p on p.id = r.product_id
    where r.fecha = '2026-10-11' and p.costo_manual is not null
  ) then
    raise exception 'el margen del periodo no quita el ITBIS del costo, fue %', margen;
  end if;

  select match_estado into match from public.pos_orden_lineas where codigo_odoo = 'cod-18';
  if match is distinct from 'match' then
    raise exception 'la linea 18 no cruzo, fue %', match;
  end if;
  update public.products set codigo_odoo = 'cod-18-nuevo' where codigo_odoo = 'cod-18';
  select match_estado into match from public.pos_orden_lineas where codigo_odoo = 'cod-18';
  if match is distinct from 'match' then
    raise exception 'el trigger recalculo en linea';
  end if;
  if not exists (select 1 from public.pos_rematch_cola where codigo_odoo = 'cod-18') then
    raise exception 'el trigger no encolo el codigo';
  end if;
  proc := public.procesar_pos_rematch(500);
  if (proc->>'pendientes')::int is distinct from 0 then
    raise exception 'quedo rematch pendiente: %', proc;
  end if;
  select match_estado into match from public.pos_orden_lineas where codigo_odoo = 'cod-18';
  if match is distinct from 'sin_match' then
    raise exception 'el rematch no actualizo la linea, fue %', match;
  end if;

  begin
    perform public.ingestar_pos_sesion($json$
{
      "modo":"parcial",
      "sesion":{"odooId":1,"estado":"closed","startAt":"2026-10-15T14:00:00Z"},
      "ordenes":[]
    }$json$::jsonb);
    raise exception 'parcial sin loteId debio fallar';
  exception
    when invalid_parameter_value then
      if sqlerrm not like '%loteId%' then
        raise;
      end if;
  end;

  insert into public.products (nombre, categoria, precio, codigo_odoo, costo_manual, costo_manual_fuente, costo_manual_en, tasa_itbis)
  values
    ('Mapa', 'Bebidas', 116, 'cod-map', 10, 'admin', now(), 0),
    ('Sin mapa', 'Bebidas', 118, 'cod-unmap', 10, 'admin', now(), 0),
    ('Explicita', 'Bebidas', 100, 'cod-explicita', 10, 'admin', now(), 18),
    ('Crudo', 'Bebidas', 118, 'cod-crudo', 10, 'admin', now(), 0),
    ('Fechas', 'Bebidas', 118, 'cod-fechas', 10, 'admin', now(), 18);

  perform public.ingestar_pos_sesion($json$
{
    "tienda":"quick","modo":"completo",
    "impuestos":[{"id":5,"tasa":16},{"id":5,"tasa":"no"},{"id":99,"tasa":0}],
    "sesion":{"odooId":812,"nombre":"POS/00812","estado":"closed","startAt":"2026-10-09T14:00:00Z","totalPagos":452},
    "ordenes":[{"odooId":812001,"fecha":"2026-10-09T15:00:00Z","total":452,"estado":"done","lineas":[
      {"odooId":50,"odooProductId":2,"codigoOdoo":"cod-map","nombreOdoo":"Mapa","cantidad":1,"subtotalConItbis":116,"impuestoOdooIds":[5]},
      {"odooId":51,"odooProductId":3,"codigoOdoo":"cod-unmap","nombreOdoo":"Sin mapa","cantidad":1,"subtotalConItbis":118,"impuestoOdooIds":[18]},
      {"odooId":52,"odooProductId":4,"codigoOdoo":"cod-explicita","nombreOdoo":"Explicita","cantidad":1,"subtotalConItbis":100,"tasaItbis":0,"impuestoOdooIds":[5]},
      {"odooId":53,"odooProductId":5,"codigoOdoo":"cod-crudo","nombreOdoo":"Crudo","cantidad":1,"subtotalConItbis":118,"tax_ids":[18]}
    ],"pagos":[]}]
  }$json$::jsonb);

  select l.tasa_itbis, r.venta_neta into neta, margen
  from public.pos_orden_lineas l
  join public.resumen_producto_dia r on r.codigo_odoo = l.codigo_odoo and r.fecha = '2026-10-09'
  where l.codigo_odoo = 'cod-map';
  if neta is distinct from 16 or margen is distinct from 100 then
    raise exception 'el id 5 debio mapear a 16 y la neta a 100, tasa % neta %', neta, margen;
  end if;

  select l.tasa_itbis, r.venta_neta into neta, margen
  from public.pos_orden_lineas l
  join public.resumen_producto_dia r on r.codigo_odoo = l.codigo_odoo and r.fecha = '2026-10-09'
  where l.codigo_odoo = 'cod-unmap';
  if neta is not null or margen is distinct from 118 then
    raise exception 'un id sin mapa no es tasa, tasa % neta %', neta, margen;
  end if;

  select l.tasa_itbis, r.venta_neta into neta, margen
  from public.pos_orden_lineas l
  join public.resumen_producto_dia r on r.codigo_odoo = l.codigo_odoo and r.fecha = '2026-10-09'
  where l.codigo_odoo = 'cod-explicita';
  if neta is distinct from 0 or margen is distinct from 100 then
    raise exception 'tasaItbis 0 debio ganar sobre el mapa, tasa % neta %', neta, margen;
  end if;

  select l.tasa_itbis, r.venta_neta into neta, margen
  from public.pos_orden_lineas l
  join public.resumen_producto_dia r on r.codigo_odoo = l.codigo_odoo and r.fecha = '2026-10-09'
  where l.codigo_odoo = 'cod-crudo';
  if neta is not null or margen is distinct from 118 then
    raise exception 'tax_ids no se lee como tasa, tasa % neta %', neta, margen;
  end if;

  select venta_neta into neta from public.resumen_producto_dia where fecha = '2026-10-11' and codigo_odoo = 'cod-16';
  if neta is distinct from 100 then
    raise exception 'antes del cambio de tasa la neta 16 debio seguir en 100, fue %', neta;
  end if;
  update public.products set tasa_itbis = 0 where codigo_odoo = 'cod-16';
  select venta_neta into neta from public.resumen_producto_dia where fecha = '2026-10-11' and codigo_odoo = 'cod-16';
  if neta is distinct from 100 then
    raise exception 'cambiar la tasa no debe recalcular en el mismo update, neta %', neta;
  end if;
  if not exists (select 1 from public.pos_rematch_cola where codigo_odoo = 'cod-16' and despues_de = 0) then
    raise exception 'cambiar tasa_itbis no encolo el producto';
  end if;
  proc := public.procesar_pos_rematch(500);
  select venta_neta into neta from public.resumen_producto_dia where fecha = '2026-10-11' and codigo_odoo = 'cod-16';
  if neta is distinct from 116 then
    raise exception 'el rematch debio recalcular la neta a 116, fue %', neta;
  end if;
  select venta_neta into neta from public.resumen_producto_dia where fecha = '2026-10-11' and codigo_odoo = 'cod-linea';
  if neta is distinct from 100 then
    raise exception 'la tasa guardada en la linea no debio cambiar, neta %', neta;
  end if;

  perform public.ingestar_pos_sesion($json$
{
    "tienda":"quick","modo":"completo",
    "sesion":{"odooId":820,"nombre":"POS/00820","estado":"closed","startAt":"2026-10-08T14:00:00Z","totalPagos":118},
    "ordenes":[{"odooId":820001,"fecha":"2026-10-08T15:00:00Z","total":118,"estado":"done","lineas":[
      {"odooId":200,"odooProductId":9,"codigoOdoo":"cod-fechas","nombreOdoo":"Fechas","cantidad":1,"subtotalConItbis":118}
    ],"pagos":[]}]
  }$json$::jsonb);
  perform public.ingestar_pos_sesion($json$
{
    "tienda":"quick","modo":"completo",
    "sesion":{"odooId":821,"nombre":"POS/00821","estado":"closed","startAt":"2026-10-07T14:00:00Z","totalPagos":118},
    "ordenes":[{"odooId":821001,"fecha":"2026-10-07T15:00:00Z","total":118,"estado":"done","lineas":[
      {"odooId":201,"odooProductId":9,"codigoOdoo":"cod-fechas","nombreOdoo":"Fechas","cantidad":1,"subtotalConItbis":118}
    ],"pagos":[]}]
  }$json$::jsonb);
  update public.products set tasa_itbis = 0 where codigo_odoo = 'cod-fechas';
  proc := public.procesar_pos_rematch(500, 1);
  if (proc->>'fechas')::int is distinct from 1 or (proc->>'pendientes')::int <= 0 then
    raise exception 'el tope de fechas no dejo pendiente: %', proc;
  end if;
  select count(*) into n from public.resumen_producto_dia where codigo_odoo = 'cod-fechas' and venta_neta = 118;
  if n is distinct from 1 then
    raise exception 'debio recalcular una sola fecha, hay % en 118', n;
  end if;
  select count(*) into n from public.resumen_producto_dia where codigo_odoo = 'cod-fechas' and venta_neta = 100;
  if n is distinct from 1 then
    raise exception 'la otra fecha debio quedar en 100, hay %', n;
  end if;
  proc := public.procesar_pos_rematch(500);
  if (proc->>'pendientes')::int is distinct from 0 then
    raise exception 'la segunda pasada no termino: %', proc;
  end if;
  select count(*) into n from public.resumen_producto_dia where codigo_odoo = 'cod-fechas' and venta_neta = 118;
  if n is distinct from 2 then
    raise exception 'las dos fechas debian quedar en 118, hay %', n;
  end if;

  select public.consumo_venta_alcance('quick', '2026-10-11', '2026-10-11', null, null) into neta;
  if neta is distinct from 416 then
    raise exception 'el alcance de venta del 11 debio ser 416, fue %', neta;
  end if;
  perform public.consumo_mapa_horas('quick', '2026-10-11', '2026-10-11', null, 'real');
  select elegibles into n from public.consumo_canasta_par('quick', '2026-10-11', '2026-10-11', 'cod-18', 'cod-16');
  if n is distinct from 1 then
    raise exception 'el ticket del 11 debio ser elegible para la canasta, fue %', n;
  end if;
  insert into public.miles_hallazgos (
    idempotency_key, payload_hash, tipo, titulo, resumen, observacion, prioridad, prioridad_justificacion,
    periodo_desde, periodo_hasta, metricas, evidencia
  ) values (
    'h-test', 'abc', 'oportunidad', 'Prueba', 'Resumen', 'Observacion de la prueba aislada', 'baja', 'Solo cubre un ticket de prueba',
    '2026-10-11', '2026-10-11', '{"venta":416}'::jsonb, '{"consultas":["consumo_venta_alcance"],"filtros":{},"enlaces":[]}'::jsonb
  );
  begin
    insert into public.miles_hallazgos (
      idempotency_key, payload_hash, tipo, titulo, resumen, observacion, prioridad, prioridad_justificacion,
      periodo_desde, periodo_hasta, metricas, evidencia
    ) values (
      'h-test', 'otro', 'oportunidad', 'Otra', 'Resumen', 'Observacion distinta', 'baja', 'Otra justificacion de prueba',
      '2026-10-11', '2026-10-11', '{}'::jsonb, '{"consultas":["x"],"filtros":{},"enlaces":[]}'::jsonb
    );
    raise exception 'la clave repetida debio chocar';
  exception
    when unique_violation then
      null;
  end;
  update public.miles_hallazgos
  set visual = '{"tipo":"calidad","numerador":1,"denominador":2}'::jsonb,
      resolucion = 'resuelta',
      recomendacion_estado = 'obsoleta'
  where idempotency_key = 'h-test';
  begin
    update public.miles_hallazgos set resolucion = 'inventada' where idempotency_key = 'h-test';
    raise exception 'una resolucion fuera del catalogo debio fallar';
  exception
    when check_violation then
      null;
  end;

  perform public.ingestar_pos_sesion($json$
{
    "tienda":"quick","modo":"completo",
    "sesion":{"odooId":901,"nombre":"POS/00901","estado":"closed","startAt":"2026-09-01T14:00:00Z","stopAt":"2026-09-01T22:00:00Z","totalPagos":100},
    "ordenes":[{
      "odooId":901001,
      "fecha":"2026-09-01T16:00:00Z",
      "total":100,
      "estado":"done",
      "pagos":[
        {"odooId":1901001,"metodo":"Efectivo","monto":80,"esCambio":false},
        {"odooId":1901002,"metodo":"Efectivo","monto":-30,"esCambio":true},
        {"odooId":1901003,"metodo":"Tarjeta","monto":50,"esCambio":false}
      ]
    }]
  }$json$::jsonb);
  select round(sum(pg.monto), 2) into venta
  from public.pos_pagos pg
  join public.pos_ordenes o on o.id = pg.orden_id
  where o.fecha_operativa = '2026-09-01' and public.pos_orden_cuenta(o.estado);
  select round(sum(total), 2) into venta_pos
  from public.pos_ordenes
  where fecha_operativa = '2026-09-01' and public.pos_orden_cuenta(estado);
  if venta is distinct from venta_pos or venta is distinct from 100 then
    raise exception 'la suma de pagos % no iguala el total de las ordenes %', venta, venta_pos;
  end if;
  select efectivo, tarjeta, venta into venta, neta, venta_pos
  from public.resumen_dia where fecha = '2026-09-01';
  if venta is distinct from 50 or neta is distinct from 50 or venta_pos is distinct from 100 then
    raise exception 'el mix del 1 sep debio ser efectivo 50, tarjeta 50 y venta 100; fue % % %', venta, neta, venta_pos;
  end if;
  if (select efectivo + banco + tarjeta + credito + otro from public.resumen_dia where fecha = '2026-09-01')
     is distinct from (select venta from public.resumen_dia where fecha = '2026-09-01') then
    raise exception 'el mix del dia no suma la venta';
  end if;
end
$test$;
`,
);
