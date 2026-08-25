import type { OrderEstado } from "@/lib/types";

export type AdminClienteListItem = {
  chatId: string;
  nombre: string;
  telefono: string;
  telefonoLabel: string;
  pedidosCount: number;
  totalGastado: number;
  totalGastadoLabel: string;
  ticketPromedio: number;
  ticketPromedioLabel: string;
  ultimoPedidoAt: string | null;
  ultimoPedidoLabel: string;
  aceptaMarketing: boolean;
  clienteDesde: string;
  clienteDesdeLabel: string;
};

export type AdminClientePedido = {
  id: string;
  createdAt: string;
  createdAtLabel: string;
  total: number;
  totalLabel: string;
  estado: OrderEstado;
  esPrueba: boolean;
};

export type AdminClienteFavorito = {
  productId: string;
  nombre: string;
  veces: number;
  cantidadTotal: number;
  ultimoPedidoAt: string;
  ultimoPedidoLabel: string;
};

export type AdminClienteDetalle = AdminClienteListItem & {
  pedidos: AdminClientePedido[];
  favoritos: AdminClienteFavorito[];
  frecuenciaCompraDias: number | null;
  frecuenciaCompraLabel: string;
  metodoPagoPreferido: "efectivo" | "tarjeta" | null;
  metodoPagoPreferidoLabel: string;
};

export type AdminClienteSortKey =
  | "nombre"
  | "pedidosCount"
  | "totalGastado"
  | "ultimoPedidoAt"
  | "ticketPromedio"
  | "aceptaMarketing";
