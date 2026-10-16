import { diaSemanaFromFecha } from "@/lib/admin-ventas-shared";
import {
  getPromediosPonderadosPorDiaSemana,
  getVentasDiariasMes,
  isoWeekdayIndex,
  sumaPromediosPonderados,
  type DiaSemanaISO,
  type MesActivo,
  type VentaDiaria,
} from "@/lib/finanzas";
import { addDaysToDayKey, isDayKey, todayDayKey } from "@/lib/local-day";
import { toMoney } from "@/lib/money";
import { getSupabaseAdminClient } from "@/lib/supabase";

const WEEKDAYS: DiaSemanaISO[] = [0, 1, 2, 3, 4, 5, 6];

const NOTA =
  "metaDelDia es la misma cifra que Hoy: reparte la meta del mes según el día de la semana, con el promedio ponderado de los tres meses anteriores. Si no hay historial, la reparte en partes iguales. ventaReal es la venta guardada de ese día y aparece en cuanto se guarda; es null si ese día todavía no tiene fila. metaAcumulada suma la meta de cada día desde el 1 hasta la fecha (hoy, si pides el mes). deficit es metaAcumulada menos las ventas hasta esa fecha: positivo si va por debajo. diferencia sigue siendo venta menos meta del día.";

export type AgentMetaDia = {
  fecha: string;
  diaSemana: string;
  metaDelDia: number | null;
  ventaReal: number | null;
  diferencia: number | null;
};

export type AgentMetaAcumulada = {
  metaAcumulada: number | null;
  ventasALaFecha: number;
  deficit: number | null;
};

export type AgentMetaMes = AgentMetaAcumulada & {
  mes: string;
  diasEnMes: number;
  metaMensual: number | null;
  ventasAcumuladas: number;
  diferenciaMeta: number | null;
  nota: string;
  dias: AgentMetaDia[];
};

export type AgentMetaFecha = AgentMetaDia & Omit<AgentMetaMes, "dias">;

export function parseAgentMetaQuery(
  search: URLSearchParams,
  today = todayDayKey()
): { ok: true; kind: "fecha"; fecha: string } | { ok: true; kind: "mes"; mes: string } | { ok: false; error: string } {
  const fecha = search.get("fecha")?.trim() ?? "";
  const mes = search.get("mes")?.trim() ?? "";
  if (fecha && mes) {
    return { ok: false, error: "Usa fecha o mes, no los dos" };
  }
  if (fecha) {
    if (!isCalendarDay(fecha)) {
      return { ok: false, error: "La fecha no es válida" };
    }
    return { ok: true, kind: "fecha", fecha };
  }
  if (mes) {
    if (!mesActivoFromMonthKey(mes)) {
      return { ok: false, error: "El mes no es válido" };
    }
    return { ok: true, kind: "mes", mes };
  }
  return { ok: true, kind: "fecha", fecha: today };
}

export function corteAcumulado(mes: string, diasEnMes: number, today: string): string | null {
  const inicio = `${mes}-01`;
  const fin = `${mes}-${pad2(diasEnMes)}`;
  if (!isDayKey(today) || today < inicio) {
    return null;
  }
  return today > fin ? fin : today;
}

export function acumuladoALaFecha(dias: AgentMetaDia[], hasta: string | null): AgentMetaAcumulada {
  if (!hasta) {
    return { metaAcumulada: null, ventasALaFecha: 0, deficit: null };
  }
  const corte = dias.filter((dia) => dia.fecha <= hasta);
  const metas = corte.map((dia) => dia.metaDelDia).filter((meta): meta is number => meta != null);
  const metaAcumulada = metas.length ? toMoney(metas.reduce((sum, meta) => sum + meta, 0)) : null;
  const ventasALaFecha = toMoney(corte.reduce((sum, dia) => sum + (dia.ventaReal ?? 0), 0));
  return {
    metaAcumulada,
    ventasALaFecha,
    deficit: metaAcumulada == null ? null : toMoney(metaAcumulada - ventasALaFecha),
  };
}

export function agentMetaDia(fecha: string, metasPorSemana: number[] | null, ventaReal: number | null): AgentMetaDia {
  const weekday = isoWeekdayIndex(fecha);
  const metaDelDia = metasPorSemana == null || weekday == null ? null : metasPorSemana[weekday] ?? null;
  return {
    fecha,
    diaSemana: diaSemanaFromFecha(fecha),
    metaDelDia,
    ventaReal,
    diferencia: ventaReal == null || metaDelDia == null ? null : ventaReal - metaDelDia,
  };
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function mesActivoFromMonthKey(mes: string): MesActivo | null {
  const match = /^(\d{4})-(\d{2})$/.exec(mes);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    return null;
  }
  return { year, month, diasEnMes: new Date(Date.UTC(year, month, 0)).getUTCDate() };
}

function isCalendarDay(fecha: string): boolean {
  if (!isDayKey(fecha)) {
    return false;
  }
  const mes = mesActivoFromMonthKey(fecha.slice(0, 7));
  if (!mes) {
    return false;
  }
  const day = Number(fecha.slice(8, 10));
  return day >= 1 && day <= mes.diasEnMes;
}

function mesActivoFromFecha(fecha: string): MesActivo {
  const mes = mesActivoFromMonthKey(fecha.slice(0, 7));
  if (!mes || !isCalendarDay(fecha)) {
    throw new Error("La fecha no es válida");
  }
  return mes;
}

function monthKey(mes: MesActivo): string {
  return `${mes.year}-${pad2(mes.month)}`;
}

function ventaDelDia(ventas: VentaDiaria[], fecha: string): number | null {
  const rows = ventas.filter((venta) => venta.fecha === fecha);
  if (rows.length === 0) {
    return null;
  }
  return rows.reduce((sum, venta) => sum + venta.ventaReal, 0);
}

async function metaMensualDelMes(mes: MesActivo): Promise<number | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("metas_mensuales")
    .select("meta")
    .eq("mes", `${monthKey(mes)}-01`)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }
  return toMoney((data as { meta?: unknown }).meta);
}

async function metasPorSemana(mes: MesActivo, meta: number | null): Promise<number[] | null> {
  if (meta == null || !(mes.diasEnMes > 0)) {
    return null;
  }
  const promedios = await getPromediosPonderadosPorDiaSemana(mes);
  const suma = sumaPromediosPonderados(promedios);
  return WEEKDAYS.map((dia) => (suma === 0 ? meta / mes.diasEnMes : (meta * (promedios[dia] / suma) * 7) / mes.diasEnMes));
}

async function ventaExacta(fecha: string): Promise<number | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("ventas_diarias").select("fecha, venta_real").eq("fecha", fecha).limit(5);
  if (error) {
    throw error;
  }
  const rows = (data ?? [])
    .map((row) => ({ fecha: String(row.fecha ?? "").slice(0, 10), ventaReal: toMoney(row.venta_real) }))
    .filter((row) => row.fecha === fecha);
  if (!rows.length) {
    return null;
  }
  return toMoney(rows.reduce((sum, row) => sum + row.ventaReal, 0));
}

function conVenta(dias: AgentMetaDia[], fecha: string, ventaReal: number): AgentMetaDia[] {
  return dias.map((dia) => {
    if (dia.fecha !== fecha) {
      return dia;
    }
    return {
      ...dia,
      ventaReal,
      diferencia: dia.metaDelDia == null ? null : ventaReal - dia.metaDelDia,
    };
  });
}

async function loadMes(mes: MesActivo): Promise<AgentMetaMes> {
  const [meta, ventas] = await Promise.all([metaMensualDelMes(mes), getVentasDiariasMes(mes)]);
  const metas = await metasPorSemana(mes, meta);
  const dias: AgentMetaDia[] = [];
  let fecha = `${monthKey(mes)}-01`;
  const ultimo = `${monthKey(mes)}-${pad2(mes.diasEnMes)}`;
  while (fecha <= ultimo) {
    dias.push(agentMetaDia(fecha, metas, ventaDelDia(ventas, fecha)));
    fecha = addDaysToDayKey(fecha, 1);
  }
  return cerrarMes(mes, meta, dias);
}

function cerrarMes(mes: MesActivo, meta: number | null, dias: AgentMetaDia[]): AgentMetaMes {
  const ventasAcumuladas = toMoney(dias.reduce((sum, dia) => sum + (dia.ventaReal ?? 0), 0));
  const acumulado = acumuladoALaFecha(dias, corteAcumulado(monthKey(mes), mes.diasEnMes, todayDayKey()));
  return {
    mes: monthKey(mes),
    diasEnMes: mes.diasEnMes,
    metaMensual: meta,
    ventasAcumuladas,
    diferenciaMeta: meta == null ? null : toMoney(ventasAcumuladas - meta),
    ...acumulado,
    nota: NOTA,
    dias,
  };
}

export async function loadAgentMetaFecha(fecha: string): Promise<AgentMetaFecha> {
  const mes = mesActivoFromFecha(fecha);
  const reporte = await loadMes(mes);
  const exacta = await ventaExacta(fecha);
  const dias = exacta == null ? reporte.dias : conVenta(reporte.dias, fecha, exacta);
  const cerrado = cerrarMes(mes, reporte.metaMensual, dias);
  const dia = cerrado.dias.find((item) => item.fecha === fecha);
  if (!dia) {
    throw new Error("La fecha no es válida");
  }
  const acumulado = acumuladoALaFecha(cerrado.dias, fecha);
  return {
    fecha: dia.fecha,
    diaSemana: dia.diaSemana,
    metaDelDia: dia.metaDelDia,
    ventaReal: dia.ventaReal,
    diferencia: dia.diferencia,
    mes: cerrado.mes,
    diasEnMes: cerrado.diasEnMes,
    metaMensual: cerrado.metaMensual,
    ventasAcumuladas: cerrado.ventasAcumuladas,
    diferenciaMeta: cerrado.diferenciaMeta,
    ...acumulado,
    nota: cerrado.nota,
  };
}

export async function loadAgentMetaMes(mes: string): Promise<AgentMetaMes> {
  const parsed = mesActivoFromMonthKey(mes);
  if (!parsed) {
    throw new Error("El mes no es válido");
  }
  return loadMes(parsed);
}
