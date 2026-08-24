import { isoWeekdayMonday1 } from "@/lib/local-day";

export type VentaDiaria = {
  id: string;
  fecha: string;
  diaSemana: string;
  monto: number;
};

export const VENTAS_DEFAULT_LIMIT = 14;
export const VENTAS_MAX_LIMIT = 90;

const DIAS_SEMANA_ISO = ["", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"] as const;

export function diaSemanaFromFecha(fecha: string): string {
  const iso = isoWeekdayMonday1(fecha);
  if (iso == null) {
    return "";
  }
  return DIAS_SEMANA_ISO[iso] ?? "";
}

export function formatDiaSemana(value: string): string {
  const nombre = value.trim();
  if (!nombre) {
    return "";
  }
  return nombre.charAt(0).toUpperCase() + nombre.slice(1);
}

export function parseVentasLimit(raw: string | null): number {
  if (raw == null || raw.trim() === "") {
    return VENTAS_DEFAULT_LIMIT;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return VENTAS_DEFAULT_LIMIT;
  }
  return Math.min(VENTAS_MAX_LIMIT, parsed);
}
