export const PRODUCT_REQUEST_STATES = ["pendiente", "agregado", "no_disponible"] as const;
export type ProductRequestEstado = (typeof PRODUCT_REQUEST_STATES)[number];

export type ProductRequest = {
  id: string;
  customerId: string | null;
  phoneNumber: string;
  clienteNombre: string | null;
  productoSolicitado: string;
  nota: string | null;
  notaAdmin: string | null;
  estado: ProductRequestEstado;
  createdAt: string;
};

export function isProductRequestEstado(value: unknown): value is ProductRequestEstado {
  return typeof value === "string" && PRODUCT_REQUEST_STATES.includes(value as ProductRequestEstado);
}

export function productRequestEstadoLabel(estado: ProductRequestEstado): string {
  if (estado === "agregado") {
    return "Agregado";
  }
  if (estado === "no_disponible") {
    return "No disponible";
  }
  return "Pendiente";
}

export const PRODUCT_REQUESTS_CHANGED_EVENT = "quick-product-requests-changed";
