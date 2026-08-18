import type { OrderEstado, OrderItemEstado } from "@/lib/types";

export function formatOrderNumber(orderId: string): string {
  return orderId.replace(/-/g, "").slice(0, 8).toUpperCase();
}

export function orderStatusLabel(estado: OrderEstado | string): string {
  const labels: Record<string, string> = {
    nueva: "Nueva",
    en_proceso: "En proceso",
    faltante_reportado: "Faltante",
    confirmada: "Confirmada",
    despachada: "Despachada",
    completada: "Completada",
    cancelada: "Cancelada",
  };
  return labels[estado] ?? estado;
}

export function itemStatusLabel(estado: OrderItemEstado | string): string {
  const labels: Record<string, string> = {
    ok: "OK",
    faltante: "Faltante",
    reemplazado: "Reemplazo",
    eliminado: "Eliminado",
  };
  return labels[estado] ?? estado;
}
