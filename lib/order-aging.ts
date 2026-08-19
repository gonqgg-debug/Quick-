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
  /** Recalcular el tiempo relativo en el cliente. */
  tickMs: 30_000,
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

export function elapsedMinutes(createdAt: string, now = Date.now()): number {
  const timestamp = new Date(createdAt).getTime();
  if (Number.isNaN(timestamp)) {
    return 0;
  }
  return Math.max(0, Math.floor((now - timestamp) / 60_000));
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
