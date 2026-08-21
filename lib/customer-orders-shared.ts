import type { OrderEstado } from "@/lib/types";

export const MY_ORDERS_HASH = "mis-pedidos";
export const MY_PROFILE_HASH = "mi-perfil";

export const CUSTOMER_PROGRESS_STEPS = ["Recibido", "Preparando", "En camino", "Entregado"] as const;

export type CustomerOrderItem = {
  id: string;
  productId: string;
  nombre: string;
  cantidad: number;
  precioLabel: string;
};

export type CustomerOrder = {
  id: string;
  createdAt: string;
  estado: OrderEstado;
  direccion: string;
  metodoPago: string;
  metodoPagoLabel: string;
  totalLabel: string;
  items: CustomerOrderItem[];
};

export function customerProgressIndex(estado: OrderEstado | string): number {
  if (estado === "cancelada") {
    return -1;
  }
  if (estado === "completada") {
    return 3;
  }
  if (estado === "despachada") {
    return 2;
  }
  if (estado === "nueva") {
    return 0;
  }
  return 1;
}

export function formatCustomerOrderDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat("es-DO", {
    timeZone: "America/Santo_Domingo",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function metodoPagoLabel(metodo: string): string {
  if (metodo === "efectivo") return "Efectivo";
  if (metodo === "tarjeta") return "Tarjeta";
  return metodo || "—";
}
