import { brand } from "@/lib/theme";
import type { OrderEstado } from "@/lib/types";

/**
 * Umbrales de urgencia visual para pedidos activos (Nuevas / En proceso).
 * Ajusta estos minutos si el ritmo operativo cambia.
 */
export const ORDER_AGING = {
  /** A partir de aquí el borde pasa a ámbar. */
  warnAfterMinutes: 5,
  /** A partir de aquí el borde pasa a rojo y se muestra ⚠️. */
  urgentAfterMinutes: 10,
  /** Recalcular cronómetros y color de aging en el cliente. */
  tickMs: 1_000,
  colors: {
    ok: brand.green,
    warn: "#F59E0B",
    urgent: brand.error,
  },
} as const;

export type OrderAgingLevel = keyof typeof ORDER_AGING.colors;

export function usesOrderAging(estado: OrderEstado): boolean {
  return (
    estado === "nueva" ||
    estado === "en_proceso" ||
    estado === "confirmada" ||
    estado === "faltante_reportado"
  );
}

export function elapsedMs(createdAt: string, now = Date.now()): number {
  const timestamp = new Date(createdAt).getTime();
  if (Number.isNaN(timestamp)) {
    return 0;
  }
  return Math.max(0, now - timestamp);
}

export function elapsedMinutes(createdAt: string, now = Date.now()): number {
  return Math.floor(elapsedMs(createdAt, now) / 60_000);
}

export function formatElapsedClock(createdAt: string, now = Date.now()): string {
  const totalSeconds = Math.floor(elapsedMs(createdAt, now) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  if (hours > 0) {
    return `${hours}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

/** Human label for wall displays, e.g. "8 min" or "1 h 12 min". */
export function formatElapsedMinutesLabel(createdAt: string, now = Date.now()): string {
  const minutes = elapsedMinutes(createdAt, now);
  if (minutes < 1) {
    return "< 1 min";
  }
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours} h ${rest} min` : `${hours} h`;
}

export function orderAgingLevel(minutes: number): OrderAgingLevel {
  if (minutes >= ORDER_AGING.urgentAfterMinutes) {
    return "urgent";
  }
  if (minutes >= ORDER_AGING.warnAfterMinutes) {
    return "warn";
  }
  return "ok";
}

export function orderAgingColor(level: OrderAgingLevel): string {
  return ORDER_AGING.colors[level];
}
