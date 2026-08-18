export type OrderSession = {
  id: string;
  chat_id: string;
  estado: "activa" | "usada" | "expirada";
  expira_en: string;
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

export type CreateOrderItem = {
  productId: string;
  cantidad: number;
};

export type CreateOrderPayload = {
  sessionId: string;
  items: CreateOrderItem[];
  direccion: string;
  metodoPago: MetodoPago;
};

export type CreateOrderResponse = {
  success: true;
  orderId: string;
};
