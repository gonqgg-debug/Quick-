import { paymentMethodLabel } from "@/lib/cash-payment";
import { toMoney } from "@/lib/money";
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
  pagoCon: number | null;
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

export function metodoPagoLabel(metodo: string, pagoCon?: number | null, total?: number | null): string {
  return paymentMethodLabel(metodo, pagoCon, total);
}

export function parsePagoConValue(value: unknown): number | null {
  const amount = toMoney(value);
  return amount > 0 ? amount : null;
}
