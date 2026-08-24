import { parsePrice } from "@/lib/catalog-import";
import { calendarDayKey, isDayKey, todayDayKey } from "@/lib/local-day";
import { toMoney } from "@/lib/money";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { getCajaParametros, getVarianzas } from "@/lib/caja";
import {
  defaultTurnoPeriodo,
  isCaja,
  isCajaLedgerTipo,
  isCajaMoneda,
  isCajaTurnoPeriodo,
  type Caja,
  type CajaLedgerItem,
  type CajaLedgerTipo,
  type CajaMoneda,
  type CajaTurnoListItem,
} from "@/lib/admin-caja-shared";

const LIST_MAX = 500;
const TEXT_MAX = 500;
const TURNO_SELECT =
  "id, fecha, turno, sistema_tarjeta, sistema_efectivo, reportado_tarjeta, reportado_efectivo, reportado_usd, verificado, notas";
const LEDGER_SELECT = "id, fecha, caja, moneda, tipo, monto, concepto, referencia";

type TurnoRow = Record<string, unknown>;
type LedgerRow = Record<string, unknown>;

function trimText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function parseAmount(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return toMoney(value);
  }
  if (typeof value === "string") {
    const parsed = parsePrice(value);
    if (parsed != null) {
      return parsed;
    }
    if (value.trim() === "") {
      return fallback;
    }
  }
  if (value == null || value === "") {
    return fallback;
  }
  throw new Error("El monto no es válido");
}

function mapTurno(row: TurnoRow): CajaTurnoListItem | null {
  const id = String(row.id ?? "");
  const fecha = calendarDayKey(row.fecha);
  const turno = row.turno;
  if (!id || !isDayKey(fecha) || !isCajaTurnoPeriodo(turno)) {
    return null;
  }
  const amounts = {
    reportadoEfectivo: toMoney(row.reportado_efectivo),
    reportadoUsd: toMoney(row.reportado_usd),
    tasaUsdDop: toMoney(row.tasa_usd_dop ?? row.tasaUsdDop),
    reportadoTarjeta: toMoney(row.reportado_tarjeta),
    sistemaTarjeta: toMoney(row.sistema_tarjeta),
    sistemaEfectivo: toMoney(row.sistema_efectivo),
    verificado: Boolean(row.verificado),
  };
  const varianzas = getVarianzas(amounts);
  const notas = trimText(row.notas, TEXT_MAX);
  return {
    id,
    fecha,
    turno,
    ...amounts,
    notas: notas || null,
    ...varianzas,
  };
}

function mapLedger(row: LedgerRow): CajaLedgerItem | null {
  const id = String(row.id ?? "");
  const fecha = calendarDayKey(row.fecha);
  if (!id || !isDayKey(fecha) || !isCaja(row.caja) || !isCajaMoneda(row.moneda) || !isCajaLedgerTipo(row.tipo)) {
    return null;
  }
  const concepto = trimText(row.concepto, TEXT_MAX);
  const referencia = trimText(row.referencia, TEXT_MAX);
  return {
    id,
    fecha,
    caja: row.caja,
    moneda: row.moneda,
    tipo: row.tipo,
    monto: toMoney(row.monto),
    concepto: concepto || null,
    referencia: referencia || null,
  };
}

export async function listCajaTurnos(fecha?: string | null): Promise<CajaTurnoListItem[]> {
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("caja_turnos")
    .select(TURNO_SELECT)
    .order("fecha", { ascending: false })
    .order("turno", { ascending: false })
    .limit(LIST_MAX);
  if (fecha && isDayKey(fecha)) {
    query = query.eq("fecha", fecha);
  }
  const { data, error } = await query;
  if (error) {
    throw error;
  }
  const parametros = await getCajaParametros();
  return (data ?? [])
    .map((row) => mapTurno({ ...(row as TurnoRow), tasaUsdDop: parametros.tasaUsdDop }))
    .filter((row): row is CajaTurnoListItem => Boolean(row));
}

export async function createCajaTurno(body: {
  fecha?: unknown;
  turno?: unknown;
  sistemaTarjeta?: unknown;
  sistemaEfectivo?: unknown;
  reportadoTarjeta?: unknown;
  reportadoEfectivo?: unknown;
  reportadoUsd?: unknown;
  verificado?: unknown;
  notas?: unknown;
}): Promise<CajaTurnoListItem> {
  const fechaRaw = typeof body.fecha === "string" ? body.fecha.trim() : "";
  const fecha = isDayKey(fechaRaw) ? fechaRaw : todayDayKey();
  if (!isDayKey(fecha)) {
    throw new Error("La fecha no es válida");
  }
  const turno = isCajaTurnoPeriodo(body.turno) ? body.turno : defaultTurnoPeriodo();
  const payload = {
    fecha,
    turno,
    sistema_tarjeta: parseAmount(body.sistemaTarjeta, 0),
    sistema_efectivo: parseAmount(body.sistemaEfectivo, 0),
    reportado_tarjeta: parseAmount(body.reportadoTarjeta, 0),
    reportado_efectivo: parseAmount(body.reportadoEfectivo, 0),
    reportado_usd: parseAmount(body.reportadoUsd, 0),
    verificado: Boolean(body.verificado),
    notas: trimText(body.notas, TEXT_MAX) || null,
  };

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("caja_turnos").insert(payload).select(TURNO_SELECT).single();
  if (error) {
    throw error;
  }
  const mapped = mapTurno({ ...(data as TurnoRow), tasaUsdDop: (await getCajaParametros()).tasaUsdDop });
  if (!mapped) {
    throw new Error("No pudimos guardar el turno");
  }
  return mapped;
}

export async function listCajaLedger(filters: {
  caja?: Caja | null;
  moneda?: CajaMoneda | null;
}): Promise<CajaLedgerItem[]> {
  const supabase = getSupabaseAdminClient();
  let query = supabase.from("caja_ledger").select(LEDGER_SELECT).order("fecha", { ascending: false }).limit(LIST_MAX);
  if (filters.caja) {
    query = query.eq("caja", filters.caja);
  }
  if (filters.moneda) {
    query = query.eq("moneda", filters.moneda);
  }
  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return (data ?? []).map((row) => mapLedger(row as LedgerRow)).filter((row): row is CajaLedgerItem => Boolean(row));
}

export async function createCajaLedger(body: {
  fecha?: unknown;
  caja?: unknown;
  moneda?: unknown;
  tipo?: unknown;
  monto?: unknown;
  concepto?: unknown;
  referencia?: unknown;
}): Promise<CajaLedgerItem> {
  const fechaRaw = typeof body.fecha === "string" ? body.fecha.trim() : "";
  const fecha = isDayKey(fechaRaw) ? fechaRaw : todayDayKey();
  if (!isDayKey(fecha)) {
    throw new Error("La fecha no es válida");
  }
  const caja: Caja = isCaja(body.caja) ? body.caja : "Chica";
  const moneda: CajaMoneda = isCajaMoneda(body.moneda) ? body.moneda : "DOP";
  const tipo: CajaLedgerTipo = isCajaLedgerTipo(body.tipo) ? body.tipo : "Entrada";
  if (caja === "Chica" && moneda === "USD") {
    throw new Error("Los USD nunca se mueven a caja chica");
  }
  const monto = parseAmount(body.monto);
  if (!(monto > 0)) {
    throw new Error("El monto tiene que ser mayor que 0");
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("caja_ledger")
    .insert({
      fecha,
      caja,
      moneda,
      tipo,
      monto,
      concepto: trimText(body.concepto, TEXT_MAX) || null,
      referencia: trimText(body.referencia, TEXT_MAX) || null,
    })
    .select(LEDGER_SELECT)
    .single();
  if (error) {
    throw error;
  }
  const mapped = mapLedger(data as LedgerRow);
  if (!mapped) {
    throw new Error("No pudimos guardar el movimiento");
  }
  return mapped;
}
