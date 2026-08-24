import { isMonthKey, monthStartFromInput } from "@/lib/admin-parametros-shared";

export type MetaMesNivel = "ok" | "cuidado" | "bajo";

export type VentasHistoricoMes = {
  mes: string;
  label: string;
  ventasReales: number;
  meta: number;
  diferencia: number;
  porcentajeMeta: number;
  comprasReales: number;
  presupuestoMaxCompras: number;
  nivel: MetaMesNivel;
};

export type VentasHistoricoResumen = {
  mesActivo: string;
  umbralCuidado: number;
  ratioRecompra: number;
  meses: VentasHistoricoMes[];
};

export type VentasHistoricoDia = {
  fecha: string;
  dia: string;
  ventaReal: number;
  metaDelDia: number;
  diferencia: number;
  diferenciaAcumulada: number;
  ventasAcumuladas: number;
  superado: boolean;
};

export type VentasHistoricoDetalle = {
  mes: string;
  label: string;
  esMesActivo: boolean;
  hasta: string | null;
  dias: VentasHistoricoDia[];
};

export const HISTORICO_CHART_MONTHS = 12;

export function nivelPorcentajeMeta(porcentajeMeta: number, umbralCuidado: number): MetaMesNivel {
  if (porcentajeMeta >= 1) {
    return "ok";
  }
  if (porcentajeMeta >= umbralCuidado) {
    return "cuidado";
  }
  return "bajo";
}

export function formatChartMes(mes: string): string {
  const start = monthStartFromInput(mes);
  if (!start) {
    return mes;
  }
  const date = new Date(Date.UTC(Number(start.slice(0, 4)), Number(start.slice(5, 7)) - 1, 1));
  return new Intl.DateTimeFormat("es-DO", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

export function parseHistoricoMesParam(value: string | null): string | null {
  const raw = value?.trim() ?? "";
  if (!raw) {
    return null;
  }
  if (isMonthKey(raw)) {
    return raw;
  }
  return monthStartFromInput(raw)?.slice(0, 7) ?? null;
}

export function chartMonths(meses: VentasHistoricoMes[]): VentasHistoricoMes[] {
  return [...meses].slice(0, HISTORICO_CHART_MONTHS).reverse();
}
