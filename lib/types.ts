import type { StructuredAddressFields } from "@/lib/customers";

export type OrderSession = {
  id: string;
  chat_id: string;
  estado: "activa" | "usada" | "expirada";
  expira_en: string;
  edit_order_id: string | null;
  es_prueba?: boolean;
};

export type Product = {
  id: string;
  nombre: string;
  marca: string | null;
  descripcion: string | null;
  precio: number;
  foto_url: string | null;
  categoria: string;
};

export type MetodoPago = "efectivo" | "tarjeta";

export type OrderEstado =
  | "nueva"
  | "en_proceso"
  | "faltante_reportado"
  | "confirmada"
  | "despachada"
  | "completada"
  | "cancelada";

export type OrderItemEstado = "ok" | "faltante" | "reemplazado" | "eliminado";

export type CreateOrderItem = {
  productId: string;
  cantidad: number;
};

export type CreateOrderPayload = {
  sessionId: string;
  items: CreateOrderItem[];
  direccion: string;
  metodoPago: MetodoPago;
  addressId?: string | null;
  nuevaDireccion?: StructuredAddressFields | null;
};

export type CreateOrderResponse = {
  success: true;
  orderId: string;
};

export type OrderDraftItem = {
  productId: string;
  cantidad: number;
};

export type OrderDraft = {
  orderId: string;
  direccion: string;
  metodoPago: MetodoPago | null;
  items: OrderDraftItem[];
};
