import { formatPrice, toMoney } from "@/lib/money";
import { STAFF_TIMEZONE } from "@/lib/local-day";
import type { Caja, CajaMoneda, CajaVarianzas } from "@/lib/caja";

export type { Caja, CajaMoneda } from "@/lib/caja";

export type CajaTurnoPeriodo = "AM" | "PM";
export type CajaLedgerTipo = "Entrada" | "Salida";

export type CajaTurnoListItem = {
  id: string;
  fecha: string;
  turno: CajaTurnoPeriodo;
  sistemaTarjeta: number;
  sistemaEfectivo: number;
  reportadoTarjeta: number;
  reportadoEfectivo: number;
  reportadoUsd: number;
  tasaUsdDop: number;
  verificado: boolean;
  notas: string | null;
} & CajaVarianzas;

export type CajaLedgerItem = {
  id: string;
  fecha: string;
  caja: Caja;
  moneda: CajaMoneda;
  tipo: CajaLedgerTipo;
  monto: number;
  concepto: string | null;
  referencia: string | null;
};

export const CAJA_TABS = [
  { href: "/admin/caja/balances", label: "Balances" },
  { href: "/admin/caja/turnos", label: "Turnos" },
  { href: "/admin/caja/ledger", label: "Ledger" },
] as const;

export function defaultTurnoPeriodo(now = Date.now()): CajaTurnoPeriodo {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: STAFF_TIMEZONE,
      hour: "numeric",
      hourCycle: "h23",
    })
      .formatToParts(new Date(now))
      .find((part) => part.type === "hour")?.value ?? "12"
  );
  return Number.isFinite(hour) && hour < 12 ? "AM" : "PM";
}

export function isCaja(value: unknown): value is Caja {
  return value === "Fuerte" || value === "Chica";
}

export function isCajaMoneda(value: unknown): value is CajaMoneda {
  return value === "DOP" || value === "USD";
}

export function isCajaTurnoPeriodo(value: unknown): value is CajaTurnoPeriodo {
  return value === "AM" || value === "PM";
}

export function isCajaLedgerTipo(value: unknown): value is CajaLedgerTipo {
  return value === "Entrada" || value === "Salida";
}

export function isNearZero(value: number): boolean {
  return Math.round(toMoney(value) * 100) === 0;
}

export function formatUsd(value: unknown): string {
  const amount = toMoney(value);
  const hasDecimals = Math.round(amount * 100) % 100 !== 0;
  const formatted = new Intl.NumberFormat("es-DO", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount);
  return `US$${formatted}`;
}

export function formatCajaMoney(value: unknown, moneda: CajaMoneda): string {
  return moneda === "USD" ? formatUsd(value) : formatPrice(value);
}
