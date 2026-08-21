import type { OrderEstado, OrderItemEstado } from "@/lib/types";
import { brand } from "@/lib/theme";

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

export function orderStatusColor(estado: OrderEstado | string): string {
  if (estado === "faltante_reportado" || estado === "cancelada") return brand.error;
  if (estado === "en_proceso" || estado === "confirmada" || estado === "despachada") return brand.blue;
  if (estado === "completada") return brand.green;
  return brand.orange;
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
