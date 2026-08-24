import { formatMesActivoLabel } from "@/lib/admin-dashboard-shared";
import { isDayKey } from "@/lib/local-day";
import { toMoney } from "@/lib/money";

export type ParametrosConfig = {
  mesActivo: string;
  ratioRecompra: number;
  umbralCuidado: number;
  umbralStop: number;
  pesoReciente: number;
  pesoIntermedio: number;
  pesoAntiguo: number;
};

export type MetaMensual = {
  mes: string;
  meta: number;
};

export const PESOS_SUMA_TOLERANCIA = 0.005;

const MONTH_KEY = /^(\d{4})-(\d{2})$/;

export function isMonthKey(value: string): boolean {
  const match = MONTH_KEY.exec(value);
  if (!match) {
    return false;
  }
  const month = Number(match[2]);
  return month >= 1 && month <= 12;
}

export function monthStartFromInput(value: unknown): string | null {
  const raw = typeof value === "string" ? value.trim() : "";
  if (isMonthKey(raw)) {
    return `${raw}-01`;
  }
  if (isDayKey(raw)) {
    return `${raw.slice(0, 7)}-01`;
  }
  return null;
}

export function monthInputValue(mesActivo: string): string {
  return mesActivo.slice(0, 7);
}

export function formatMetaMes(mes: string): string {
  const start = monthStartFromInput(mes);
  if (!start) {
    return mes;
  }
  return formatMesActivoLabel(Number(start.slice(0, 4)), Number(start.slice(5, 7)));
}

export function ratioToPercent(ratio: number): number {
  return Math.round(toMoney(ratio) * 10000) / 100;
}

/** API helper: 75 or "75%" → 0.75; 0.75 stays 0.75. */
export function parsePercentOrRatio(value: unknown): number | null {
  if (value == null || value === "") {
    return null;
  }
  const amount = typeof value === "number" ? value : Number(String(value).trim().replace("%", "").replace(",", "."));
  if (!Number.isFinite(amount) || amount < 0 || amount > 100) {
    return null;
  }
  return amount > 1 ? amount / 100 : amount;
}

export function pesosSumanUno(reciente: number, intermedio: number, antiguo: number): boolean {
  return Math.abs(reciente + intermedio + antiguo - 1) <= PESOS_SUMA_TOLERANCIA;
}

export function pesosSumaPercent(reciente: number, intermedio: number, antiguo: number): number {
  return Math.round((reciente + intermedio + antiguo) * 1000) / 10;
}
