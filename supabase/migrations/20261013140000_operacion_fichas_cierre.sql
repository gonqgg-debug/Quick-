/* Ficha compartida, bandeja de decisiones y cierre versionado.
   La versión aprobada no se edita: una corrección abre otra versión. */

alter table public.facturas
  add column if not exists es_compra_personal boolean not null default false,
  add column if not exists socio text,
  add column if not exists confirmacion_texto text,
  add column if not exists confirmacion_por text,
  add column if not exists confirmacion_en timestamptz,
  add column if not exists problema boolean not null default false,
  add column if not exists problema_dueno text,
  add column if not exists problema_desde timestamptz,
  add column if not exists problema_falta text,
  add column if not exists ledger_id uuid,
  add column if not exists compra_id uuid;

alter table public.facturas
  drop constraint if exists facturas_estado_check;

update public.facturas
set
  problema = true,
  problema_desde = updated_at,
  problema_falta = estado
where estado in (
  'pendiente_informacion',
  'incompleta',
  'posible_duplicado',
  'documento_no_valido',
  'escalada'
);

update public.facturas
set estado = case estado
  when 'en_analisis' then 'recibida'
  when 'pendiente_informacion' then 'recibida'
  when 'respuesta_recibida' then 'recibida'
  when 'completa' then 'registrada'
  when 'incompleta' then 'recibida'
  when 'posible_duplicado' then 'recibida'
  when 'documento_no_valido' then 'recibida'
  when 'escalada' then 'recibida'
  else estado
end
where estado in (
  'en_analisis',
  'pendiente_informacion',
  'respuesta_recibida',
  'completa',
  'incompleta',
  'posible_duplicado',
  'documento_no_valido',
  'escalada'
);

alter table public.facturas
  add constraint facturas_estado_check
  check (estado in ('falta_factura', 'recibida', 'registrada', 'verificada', 'conciliada'));

alter table public.facturas
  drop constraint if exists facturas_problema_dueno_check;

alter table public.facturas
  add constraint facturas_problema_dueno_check
  check (
    problema_dueno is null
    or problema_dueno in ('rodrigo', 'phillip', 'boris', 'fred', 'hans', 'matt', 'troy', 'robert')
  );

alter table public.facturas
  drop constraint if exists facturas_compra_id_fkey;

alter table public.facturas
  add constraint facturas_compra_id_fkey
  foreign key (compra_id) references public.compras (id) on delete set null;

create index if not exists idx_facturas_problema
  on public.facturas (problema, updated_at desc);

create index if not exists idx_facturas_compra
  on public.facturas (compra_id);

create table if not exists public.factura_verificaciones (
  id uuid primary key default gen_random_uuid(),
  factura_id uuid not null references public.facturas (id) on delete cascade,
  resultado text not null,
  rnc text,
  ncf text,
  monto_factura numeric(14,2),
  monto_sistema numeric(14,2),
  monto_caja numeric(14,2),
  monto_dgii numeric(14,2),
  nota text,
  creado_en timestamptz not null default now(),
  constraint factura_verificaciones_resultado_check check (resultado in ('cuadra', 'falta', 'diferencia'))
);

create index if not exists idx_factura_verificaciones_factura
  on public.factura_verificaciones (factura_id, creado_en desc);

create table if not exists public.factura_conciliaciones (
  id uuid primary key default gen_random_uuid(),
  factura_id uuid not null references public.facturas (id) on delete cascade,
  resultado text not null,
  medio text,
  fecha date,
  referencia text,
  monto numeric(14,2),
  nota text,
  creado_en timestamptz not null default now(),
  constraint factura_conciliaciones_resultado_check check (resultado in ('pagada', 'vencida_sin_pagar', 'pagada_sin_movimiento', 'falta_factura')),
  constraint factura_conciliaciones_medio_check check (medio is null or medio in ('banco', 'caja', 'cardnet'))
);

create index if not exists idx_factura_conciliaciones_factura
  on public.factura_conciliaciones (factura_id, creado_en desc);

create table if not exists public.decisiones (
  id uuid primary key default gen_random_uuid(),
  factura_id uuid references public.facturas (id) on delete set null,
  autor text not null,
  pregunta text not null,
  monto numeric(14,2),
  vence_en date,
  si_no_contesta text not null default 'queda en espera',
  estado text not null default 'pendiente',
  resuelta_en timestamptz,
  creada_en timestamptz not null default now(),
  constraint decisiones_autor_check check (autor in ('rodrigo', 'phillip', 'boris', 'fred', 'hans', 'matt', 'troy', 'robert')),
  constraint decisiones_estado_check check (estado in ('pendiente', 'si', 'no')),
  constraint decisiones_pregunta_check check (char_length(btrim(pregunta)) >= 1),
  constraint decisiones_consecuencia_check check (char_length(btrim(si_no_contesta)) >= 1)
);

create index if not exists idx_decisiones_orden
  on public.decisiones (estado, monto desc nulls last, vence_en asc nulls last);

create table if not exists public.excepciones (
  id uuid primary key default gen_random_uuid(),
  factura_id uuid references public.facturas (id) on delete set null,
  autor text not null,
  dueno text not null default 'matt',
  que_falta text not null,
  estado text not null default 'abierta',
  resolucion text,
  abierta_en timestamptz not null default now(),
  resuelta_en timestamptz,
  constraint excepciones_autor_check check (autor in ('rodrigo', 'phillip', 'boris', 'fred', 'hans', 'matt', 'troy', 'robert')),
  constraint excepciones_dueno_check check (dueno in ('rodrigo', 'phillip', 'boris', 'fred', 'hans', 'matt', 'troy', 'robert')),
  constraint excepciones_estado_check check (estado in ('abierta', 'resuelta')),
  constraint excepciones_falta_check check (char_length(btrim(que_falta)) >= 1)
);

create index if not exists idx_excepciones_abiertas
  on public.excepciones (estado, abierta_en desc);

create table if not exists public.cierre_versiones (
  id uuid primary key default gen_random_uuid(),
  mes text not null,
  numero integer not null,
  estado text not null default 'preliminar',
  nota text,
  corrige_numero integer,
  aprobada_en timestamptz,
  creada_en timestamptz not null default now(),
  constraint cierre_versiones_mes_check check (mes ~ '^[0-9]{4}-[0-9]{2}$'),
  constraint cierre_versiones_numero_check check (numero >= 1),
  constraint cierre_versiones_estado_check check (estado in ('preliminar', 'aprobada')),
  constraint cierre_versiones_corrige_check check (corrige_numero is null or corrige_numero >= 1),
  unique (mes, numero)
);

create index if not exists idx_cierre_versiones_mes
  on public.cierre_versiones (mes, numero desc);

create table if not exists public.cierre_entregas (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.cierre_versiones (id) on delete cascade,
  bot text not null,
  estado text not null default 'pendiente',
  resumen text,
  entregado_en timestamptz,
  constraint cierre_entregas_bot_check check (bot in ('hans', 'fred', 'robert')),
  constraint cierre_entregas_estado_check check (estado in ('pendiente', 'entregado')),
  unique (version_id, bot)
);

create table if not exists public.asientos (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.cierre_versiones (id) on delete cascade,
  numero integer not null,
  fecha date,
  cuenta text not null,
  debe numeric(14,2) not null default 0,
  haber numeric(14,2) not null default 0,
  factura_id uuid references public.facturas (id) on delete set null,
  ledger_id uuid,
  nota text,
  constraint asientos_numero_check check (numero >= 1),
  constraint asientos_cuenta_check check (char_length(btrim(cuenta)) >= 1),
  constraint asientos_debe_check check (debe >= 0),
  constraint asientos_haber_check check (haber >= 0),
  unique (version_id, numero)
);

create index if not exists idx_asientos_version
  on public.asientos (version_id, numero);

create table if not exists public.reporte_lineas (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.cierre_versiones (id) on delete cascade,
  tipo text not null,
  orden integer not null,
  concepto text not null,
  monto numeric(14,2) not null,
  factura_ids uuid[] not null default '{}',
  asiento_ids uuid[] not null default '{}',
  ledger_ids uuid[] not null default '{}',
  constraint reporte_lineas_tipo_check check (tipo in ('resultados', 'balance', 'flujo')),
  constraint reporte_lineas_orden_check check (orden >= 1),
  constraint reporte_lineas_concepto_check check (char_length(btrim(concepto)) >= 1),
  unique (version_id, tipo, orden)
);

create index if not exists idx_reporte_lineas_version
  on public.reporte_lineas (version_id, tipo, orden);

revoke all on table public.factura_verificaciones from anon, authenticated, public;
revoke all on table public.factura_conciliaciones from anon, authenticated, public;
revoke all on table public.decisiones from anon, authenticated, public;
revoke all on table public.excepciones from anon, authenticated, public;
revoke all on table public.cierre_versiones from anon, authenticated, public;
revoke all on table public.cierre_entregas from anon, authenticated, public;
revoke all on table public.asientos from anon, authenticated, public;
revoke all on table public.reporte_lineas from anon, authenticated, public;

grant all on table public.factura_verificaciones to service_role;
grant all on table public.factura_conciliaciones to service_role;
grant all on table public.decisiones to service_role;
grant all on table public.excepciones to service_role;
grant all on table public.cierre_versiones to service_role;
grant all on table public.cierre_entregas to service_role;
grant all on table public.asientos to service_role;
grant all on table public.reporte_lineas to service_role;

alter table public.factura_verificaciones enable row level security;
alter table public.factura_verificaciones force row level security;
alter table public.factura_conciliaciones enable row level security;
alter table public.factura_conciliaciones force row level security;
alter table public.decisiones enable row level security;
alter table public.decisiones force row level security;
alter table public.excepciones enable row level security;
alter table public.excepciones force row level security;
alter table public.cierre_versiones enable row level security;
alter table public.cierre_versiones force row level security;
alter table public.cierre_entregas enable row level security;
alter table public.cierre_entregas force row level security;
alter table public.asientos enable row level security;
alter table public.asientos force row level security;
alter table public.reporte_lineas enable row level security;
alter table public.reporte_lineas force row level security;

drop policy if exists "service_role_factura_verificaciones_all" on public.factura_verificaciones;
create policy "service_role_factura_verificaciones_all" on public.factura_verificaciones for all to service_role using (true) with check (true);

drop policy if exists "service_role_factura_conciliaciones_all" on public.factura_conciliaciones;
create policy "service_role_factura_conciliaciones_all" on public.factura_conciliaciones for all to service_role using (true) with check (true);

drop policy if exists "service_role_decisiones_all" on public.decisiones;
create policy "service_role_decisiones_all" on public.decisiones for all to service_role using (true) with check (true);

drop policy if exists "service_role_excepciones_all" on public.excepciones;
create policy "service_role_excepciones_all" on public.excepciones for all to service_role using (true) with check (true);

drop policy if exists "service_role_cierre_versiones_all" on public.cierre_versiones;
create policy "service_role_cierre_versiones_all" on public.cierre_versiones for all to service_role using (true) with check (true);

drop policy if exists "service_role_cierre_entregas_all" on public.cierre_entregas;
create policy "service_role_cierre_entregas_all" on public.cierre_entregas for all to service_role using (true) with check (true);

drop policy if exists "service_role_asientos_all" on public.asientos;
create policy "service_role_asientos_all" on public.asientos for all to service_role using (true) with check (true);

drop policy if exists "service_role_reporte_lineas_all" on public.reporte_lineas;
create policy "service_role_reporte_lineas_all" on public.reporte_lineas for all to service_role using (true) with check (true);
