import { addDaysToDayKey, isDayKey, todayDayKey } from "@/lib/local-day";
import { toMoney } from "@/lib/money";
import { getSupabaseAdminClient } from "@/lib/supabase";

export type MesActivo = {
  year: number;
  month: number;
  diasEnMes: number;
};

export type DiaSemanaISO = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type PromediosPonderados = Record<DiaSemanaISO, number>;

export type FacturaPendiente = {
  id: string;
  proveedorId: string;
  proveedorNombre: string;
  monto: number;
  fecha: string;
  dueDate: string;
};

type Parametros = {
  mesActivo: string;
  pesoReciente: number;
  pesoIntermedio: number;
  pesoAntiguo: number;
  ratioRecompra: number;
  umbralCuidado: number;
  umbralStop: number;
};

type ProveedorEmbed = { id?: unknown; nombre?: unknown } | { id?: unknown; nombre?: unknown }[] | null;

type VentaDiaria = {
  fecha: string;
  ventaReal: number;
};

const DIAS_SEMANA: DiaSemanaISO[] = [0, 1, 2, 3, 4, 5, 6];
const QUERY_LIMIT = 2000;
const VENTA_SELECT = "fecha, venta_real";
const FACTURA_SELECT = "id, proveedor_id, monto, fecha, due_date, proveedores ( id, nombre )";
const DEFAULT_UMBRAL_CUIDADO = 0.2;
const DEFAULT_UMBRAL_STOP = 0;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function diasEnMes(year: number, month: number): number {
  if (month === 2) {
    const bisiesto = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return bisiesto ? 29 : 28;
  }
  return [31, 0, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
}

function parseYearMonth(value: unknown): { year: number; month: number } {
  const raw = typeof value === "string" ? value : value instanceof Date ? value.toISOString() : String(value ?? "");
  const match = /^(\d{4})-(\d{2})/.exec(raw);
  if (!match) {
    throw new Error("El mes activo no es válido");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || month < 1 || month > 12) {
    throw new Error("El mes activo no es válido");
  }
  return { year, month };
}

function monthStartKey(year: number, month: number): string {
  return `${year}-${pad2(month)}-01`;
}

function monthEndKey(year: number, month: number): string {
  return `${year}-${pad2(month)}-${pad2(diasEnMes(year, month))}`;
}

function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const shifted = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1 };
}

function yearMonthKey(year: number, month: number): string {
  return `${year}-${pad2(month)}`;
}

function utcDateToDayKey(date: Date): string {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).toISOString().slice(0, 10);
}

function dayKeyToUtcDate(dayKey: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!match) {
    return new Date(NaN);
  }
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

function isoWeekdayIndex(dayKey: string): DiaSemanaISO {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!match) {
    return 0;
  }
  const jsDay = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).getUTCDay();
  return ((jsDay + 6) % 7) as DiaSemanaISO;
}

function asRatio(value: unknown, fallback: number): number {
  if (value == null || value === "") {
    return fallback;
  }
  const amount = toMoney(value);
  if (!Number.isFinite(amount) || amount < 0) {
    return fallback;
  }
  return amount > 1 ? amount / 100 : amount;
}

function proveedorNombre(embed: ProveedorEmbed | undefined, fallbackId: string): string {
  const row = Array.isArray(embed) ? embed[0] : embed;
  const nombre = String(row?.nombre ?? "").trim();
  return nombre || fallbackId;
}

function emptyPromedios(): PromediosPonderados {
  return { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
}

function sumaPromedios(promedios: PromediosPonderados): number {
  return DIAS_SEMANA.reduce((sum, dia) => sum + promedios[dia], 0);
}

function promedioPorDiaSemana(ventas: VentaDiaria[]): PromediosPonderados {
  const sumas = emptyPromedios();
  const counts: Record<DiaSemanaISO, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  for (const venta of ventas) {
    const dia = isoWeekdayIndex(venta.fecha);
    sumas[dia] += venta.ventaReal;
    counts[dia] += 1;
  }
  const promedios = emptyPromedios();
  for (const dia of DIAS_SEMANA) {
    promedios[dia] = counts[dia] > 0 ? sumas[dia] / counts[dia] : 0;
  }
  return promedios;
}

async function getParametros(): Promise<Parametros> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("parametros").select("*").limit(1).maybeSingle();
  if (error) {
    throw error;
  }
  return mapParametros(data as Record<string, unknown> | null);
}

function mapParametros(data: Record<string, unknown> | null): Parametros {
  if (!data) {
    throw new Error("No hay parámetros configurados");
  }
  const mesActivo = String(data.mes_activo ?? "");
  if (!mesActivo) {
    throw new Error("El mes activo no es válido");
  }
  const ratioRecompra = toMoney(data.ratio_recompra);
  if (!(ratioRecompra > 0)) {
    throw new Error("El ratio de recompra no es válido");
  }
  return {
    mesActivo,
    pesoReciente: toMoney(data.peso_reciente),
    pesoIntermedio: toMoney(data.peso_intermedio),
    pesoAntiguo: toMoney(data.peso_antiguo),
    ratioRecompra,
    umbralCuidado: asRatio(data.umbral_cuidado, DEFAULT_UMBRAL_CUIDADO),
    umbralStop: asRatio(data.umbral_stop, DEFAULT_UMBRAL_STOP),
  };
}

function mapVenta(row: { fecha?: unknown; venta_real?: unknown }): VentaDiaria | null {
  const fecha = String(row.fecha ?? "");
  if (!isDayKey(fecha)) {
    return null;
  }
  return { fecha, ventaReal: toMoney(row.venta_real) };
}

async function listVentasDiarias(from: string, to: string): Promise<VentaDiaria[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("ventas_diarias")
    .select(VENTA_SELECT)
    .gte("fecha", from)
    .lte("fecha", to)
    .limit(QUERY_LIMIT);
  if (error) {
    throw error;
  }
  return (data ?? []).map((row) => mapVenta(row)).filter((row): row is VentaDiaria => Boolean(row));
}

async function sumVentasDiarias(from: string, to: string, exclusiveEnd = false): Promise<number> {
  const supabase = getSupabaseAdminClient();
  let query = supabase.from("ventas_diarias").select("venta_real").gte("fecha", from).limit(QUERY_LIMIT);
  query = exclusiveEnd ? query.lt("fecha", to) : query.lte("fecha", to);
  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return (data ?? []).reduce((sum, row) => sum + toMoney(row.venta_real), 0);
}

async function sumCompras(from: string, to: string, exclusiveEnd = false): Promise<number> {
  const supabase = getSupabaseAdminClient();
  let query = supabase.from("compras").select("monto").gte("fecha", from).limit(QUERY_LIMIT);
  query = exclusiveEnd ? query.lt("fecha", to) : query.lte("fecha", to);
  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return (data ?? []).reduce((sum, row) => sum + toMoney(row.monto), 0);
}

function mapFactura(row: {
  id?: unknown;
  proveedor_id?: unknown;
  monto?: unknown;
  fecha?: unknown;
  due_date?: unknown;
  proveedores?: ProveedorEmbed;
}): FacturaPendiente | null {
  const id = String(row.id ?? "");
  const proveedorId = String(row.proveedor_id ?? "");
  const fecha = String(row.fecha ?? "");
  const dueDate = String(row.due_date ?? "");
  if (!id || !proveedorId || !isDayKey(fecha) || !isDayKey(dueDate)) {
    return null;
  }
  return {
    id,
    proveedorId,
    proveedorNombre: proveedorNombre(row.proveedores, proveedorId),
    monto: toMoney(row.monto),
    fecha,
    dueDate,
  };
}

async function listFacturasPendientes(filter: { dueBefore?: string; dueFrom?: string; dueTo?: string }): Promise<FacturaPendiente[]> {
  const supabase = getSupabaseAdminClient();
  let query = supabase.from("compras").select(FACTURA_SELECT).eq("pagado", false).order("due_date", { ascending: true }).limit(QUERY_LIMIT);
  if (filter.dueBefore) {
    query = query.lt("due_date", filter.dueBefore);
  }
  if (filter.dueFrom) {
    query = query.gte("due_date", filter.dueFrom);
  }
  if (filter.dueTo) {
    query = query.lte("due_date", filter.dueTo);
  }
  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return (data ?? []).map((row) => mapFactura(row)).filter((row): row is FacturaPendiente => Boolean(row));
}

export async function getMesActivo(): Promise<MesActivo> {
  const parametros = await getParametros();
  const { year, month } = parseYearMonth(parametros.mesActivo);
  return { year, month, diasEnMes: diasEnMes(year, month) };
}

export async function getPromediosPonderadosPorDiaSemana(mesActivo: MesActivo): Promise<PromediosPonderados> {
  const m1 = addMonths(mesActivo.year, mesActivo.month, -1);
  const m2 = addMonths(mesActivo.year, mesActivo.month, -2);
  const m3 = addMonths(mesActivo.year, mesActivo.month, -3);
  const [parametros, ventas] = await Promise.all([
    getParametros(),
    listVentasDiarias(monthStartKey(m3.year, m3.month), monthEndKey(m1.year, m1.month)),
  ]);

  const porMes: Record<string, VentaDiaria[]> = {
    [yearMonthKey(m1.year, m1.month)]: [],
    [yearMonthKey(m2.year, m2.month)]: [],
    [yearMonthKey(m3.year, m3.month)]: [],
  };
  for (const venta of ventas) {
    const key = venta.fecha.slice(0, 7);
    porMes[key]?.push(venta);
  }

  const avgM1 = promedioPorDiaSemana(porMes[yearMonthKey(m1.year, m1.month)] ?? []);
  const avgM2 = promedioPorDiaSemana(porMes[yearMonthKey(m2.year, m2.month)] ?? []);
  const avgM3 = promedioPorDiaSemana(porMes[yearMonthKey(m3.year, m3.month)] ?? []);

  const ponderados = emptyPromedios();
  for (const dia of DIAS_SEMANA) {
    ponderados[dia] =
      parametros.pesoReciente * avgM1[dia] + parametros.pesoIntermedio * avgM2[dia] + parametros.pesoAntiguo * avgM3[dia];
  }
  return ponderados;
}

export async function getMetaMensual(mesActivo: MesActivo): Promise<number> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("metas_mensuales")
    .select("meta_mensual")
    .eq("anio", mesActivo.year)
    .eq("mes", mesActivo.month)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return toMoney((data as { meta_mensual?: unknown } | null)?.meta_mensual);
}

export async function getUmbralesSemaforo(): Promise<{ umbralCuidado: number; umbralStop: number }> {
  const parametros = await getParametros();
  return { umbralCuidado: parametros.umbralCuidado, umbralStop: parametros.umbralStop };
}

export async function getMetaDelDia(diaSemanaISO: DiaSemanaISO, mesActivo: MesActivo): Promise<number> {
  const [metaMensual, promedios] = await Promise.all([
    getMetaMensual(mesActivo),
    getPromediosPonderadosPorDiaSemana(mesActivo),
  ]);
  if (!(mesActivo.diasEnMes > 0)) {
    return 0;
  }
  const sumaTotalPonderados = sumaPromedios(promedios);
  if (sumaTotalPonderados === 0) {
    return metaMensual / mesActivo.diasEnMes;
  }
  return metaMensual * (promedios[diaSemanaISO] / sumaTotalPonderados) * 7 / mesActivo.diasEnMes;
}

export async function getVentasAcumuladasMes(mesActivo: MesActivo): Promise<number> {
  return sumVentasDiarias(monthStartKey(mesActivo.year, mesActivo.month), monthEndKey(mesActivo.year, mesActivo.month));
}

export async function getDiasTranscurridos(mesActivo: MesActivo): Promise<number> {
  const supabase = getSupabaseAdminClient();
  const from = monthStartKey(mesActivo.year, mesActivo.month);
  const to = monthEndKey(mesActivo.year, mesActivo.month);
  const { count, error } = await supabase
    .from("ventas_diarias")
    .select("fecha", { count: "exact", head: true })
    .gte("fecha", from)
    .lte("fecha", to);
  if (error) {
    throw error;
  }
  return count ?? 0;
}

export async function getForecastCierreMes(mesActivo: MesActivo): Promise<number> {
  const [ventasAcumuladas, diasTranscurridos, promedios] = await Promise.all([
    getVentasAcumuladasMes(mesActivo),
    getDiasTranscurridos(mesActivo),
    getPromediosPonderadosPorDiaSemana(mesActivo),
  ]);
  const diasRestantes = Math.max(0, mesActivo.diasEnMes - diasTranscurridos);
  return ventasAcumuladas + diasRestantes * (sumaPromedios(promedios) / 7);
}

export async function getComprasDelMes(mesActivo: MesActivo): Promise<number> {
  return sumCompras(monthStartKey(mesActivo.year, mesActivo.month), monthEndKey(mesActivo.year, mesActivo.month));
}

export async function getPresupuestoMaximoMes(mesActivo: MesActivo): Promise<number> {
  const [forecast, parametros] = await Promise.all([getForecastCierreMes(mesActivo), getParametros()]);
  return forecast / parametros.ratioRecompra;
}

export async function getDisponibleMes(mesActivo: MesActivo): Promise<number> {
  const [presupuesto, compras] = await Promise.all([getPresupuestoMaximoMes(mesActivo), getComprasDelMes(mesActivo)]);
  return presupuesto - compras;
}

export function getSemanaActual(): { inicio: Date; fin: Date } {
  const hoy = todayDayKey();
  const lunes = addDaysToDayKey(hoy, -isoWeekdayIndex(hoy));
  const domingo = addDaysToDayKey(lunes, 6);
  return { inicio: dayKeyToUtcDate(lunes), fin: dayKeyToUtcDate(domingo) };
}

export async function getForecastSemanaActual(mesActivo: MesActivo): Promise<number> {
  const { inicio, fin } = getSemanaActual();
  const from = utcDateToDayKey(inicio);
  const to = utcDateToDayKey(fin);
  const [ventas, promedios] = await Promise.all([
    listVentasDiarias(from, to),
    getPromediosPonderadosPorDiaSemana(mesActivo),
  ]);
  const porFecha = new Map(ventas.map((venta) => [venta.fecha, venta.ventaReal]));
  let total = 0;
  for (let offset = 0; offset < 7; offset += 1) {
    const fecha = addDaysToDayKey(from, offset);
    const real = porFecha.get(fecha);
    total += real === undefined ? promedios[isoWeekdayIndex(fecha)] : real;
  }
  return total;
}

export async function getPresupuestoSemanaActual(mesActivo: MesActivo): Promise<number> {
  const [forecast, parametros] = await Promise.all([getForecastSemanaActual(mesActivo), getParametros()]);
  return forecast / parametros.ratioRecompra;
}

export async function getSobregastoAcumuladoAntesDeEstaSemana(mesActivo: MesActivo): Promise<number> {
  const { inicio } = getSemanaActual();
  const from = monthStartKey(mesActivo.year, mesActivo.month);
  const lunes = utcDateToDayKey(inicio);
  const [comprasAntes, ventasAntes, parametros] = await Promise.all([
    sumCompras(from, lunes, true),
    sumVentasDiarias(from, lunes, true),
    getParametros(),
  ]);
  const pptoAntes = ventasAntes / parametros.ratioRecompra;
  return Math.max(0, comprasAntes - pptoAntes);
}

export async function getComprasSemanaActual(): Promise<number> {
  const { inicio, fin } = getSemanaActual();
  return sumCompras(utcDateToDayKey(inicio), utcDateToDayKey(fin));
}

export async function getDisponibleSemanaActual(mesActivo: MesActivo): Promise<number> {
  const [presupuesto, sobregasto, compras] = await Promise.all([
    getPresupuestoSemanaActual(mesActivo),
    getSobregastoAcumuladoAntesDeEstaSemana(mesActivo),
    getComprasSemanaActual(),
  ]);
  return presupuesto - sobregasto - compras;
}

export async function getFacturasVencidas(): Promise<FacturaPendiente[]> {
  return listFacturasPendientes({ dueBefore: todayDayKey() });
}

export async function getFacturasPorVencerEn3Dias(): Promise<FacturaPendiente[]> {
  const hoy = todayDayKey();
  return listFacturasPendientes({ dueFrom: hoy, dueTo: addDaysToDayKey(hoy, 3) });
}
