import { diaSemanaFromFecha } from "@/lib/admin-ventas-shared";
import {
  getMetaDelDia,
  getVentasDiariasMes,
  isoWeekdayIndex,
  type DiaSemanaISO,
  type MesActivo,
  type VentaDiaria,
} from "@/lib/finanzas";
import { addDaysToDayKey, isDayKey, todayDayKey } from "@/lib/local-day";
import { toMoney } from "@/lib/money";
import { getSupabaseAdminClient } from "@/lib/supabase";

const WEEKDAYS: DiaSemanaISO[] = [0, 1, 2, 3, 4, 5, 6];

const NOTA =
  "metaDelDia es la misma cifra que Hoy: reparte la meta del mes según el día de la semana, con el promedio ponderado de los tres meses anteriores. Si no hay historial, la reparte en partes iguales. ventaReal es null cuando ese día no tiene venta guardada.";

export type AgentMetaDia = {
  fecha: string;
  diaSemana: string;
  metaDelDia: number | null;
  ventaReal: number | null;
  diferencia: number | null;
};

export type AgentMetaMes = {
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
  if (meta == null) {
    return null;
  }
  return Promise.all(WEEKDAYS.map((dia) => getMetaDelDia(dia, mes)));
}

async function loadMes(mes: MesActivo): Promise<AgentMetaMes> {
  const [meta, ventas] = await Promise.all([metaMensualDelMes(mes), getVentasDiariasMes(mes)]);
  const metas = await metasPorSemana(mes, meta);
  const ventasAcumuladas = ventas.reduce((sum, venta) => sum + venta.ventaReal, 0);
  const dias: AgentMetaDia[] = [];
  let fecha = `${monthKey(mes)}-01`;
  const hasta = `${monthKey(mes)}-${pad2(mes.diasEnMes)}`;
  while (fecha <= hasta) {
    dias.push(agentMetaDia(fecha, metas, ventaDelDia(ventas, fecha)));
    fecha = addDaysToDayKey(fecha, 1);
  }
  return {
    mes: monthKey(mes),
    diasEnMes: mes.diasEnMes,
    metaMensual: meta,
    ventasAcumuladas,
    diferenciaMeta: meta == null ? null : ventasAcumuladas - meta,
    nota: NOTA,
    dias,
  };
}

export async function loadAgentMetaFecha(fecha: string): Promise<AgentMetaFecha> {
  const mes = mesActivoFromFecha(fecha);
  const reporte = await loadMes(mes);
  const dia = reporte.dias.find((item) => item.fecha === fecha);
  if (!dia) {
    throw new Error("La fecha no es válida");
  }
  return {
    fecha: dia.fecha,
    diaSemana: dia.diaSemana,
    metaDelDia: dia.metaDelDia,
    ventaReal: dia.ventaReal,
    diferencia: dia.diferencia,
    mes: reporte.mes,
    diasEnMes: reporte.diasEnMes,
    metaMensual: reporte.metaMensual,
    ventasAcumuladas: reporte.ventasAcumuladas,
    diferenciaMeta: reporte.diferenciaMeta,
    nota: reporte.nota,
  };
}

export async function loadAgentMetaMes(mes: string): Promise<AgentMetaMes> {
  const parsed = mesActivoFromMonthKey(mes);
  if (!parsed) {
    throw new Error("El mes no es válido");
  }
  return loadMes(parsed);
}
