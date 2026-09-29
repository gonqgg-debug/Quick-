import { suggestedPagoConAmounts } from "@/lib/cash-payment";
import { toMoney } from "@/lib/money";

export type PosMetodoPago = "efectivo" | "tarjeta" | "transferencia";

export type PosProduct = {
  id: string;
  nombre: string;
  precio: number;
  fotoUrl: string | null;
  categoria: string;
  stock: number | null;
};

export type PosSaleItem = {
  productoId: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
};

export type PosSaleStatus = "pendiente_sync" | "sincronizada" | "sincronizada_advertencia";

export type PosAdvertencia = {
  id: string;
  createdAt: string;
  total: number;
  metodoPago: string;
  detalle: string | null;
};

export const POS_LOW_STOCK_AT = 5;

export function foldText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Miniatura para la grilla. Supabase sirve el archivo original, que en el mostrador es demasiado pesado. */
export function posThumbUrl(fotoUrl: string | null): string | null {
  if (!fotoUrl) {
    return null;
  }
  try {
    const url = new URL(fotoUrl);
    const marker = "/storage/v1/object/public/";
    const index = url.pathname.indexOf(marker);
    if (index === -1) {
      return fotoUrl;
    }
    const objectPath = url.pathname.slice(index + marker.length);
    url.pathname = `/storage/v1/render/image/public/${objectPath}`;
    url.search = "";
    url.searchParams.set("width", "480");
    url.searchParams.set("quality", "60");
    url.searchParams.set("resize", "cover");
    return url.toString();
  } catch {
    return fotoUrl;
  }
}

export function productInitials(nombre: string): string {
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "•";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function stockBadge(stock: number | null): { label: string; tone: "warning" | "stop" } | null {
  if (stock == null) {
    return null;
  }
  if (stock <= 0) {
    return { label: stock < 0 ? `Stock ${stock}` : "Quedan 0", tone: "stop" };
  }
  if (stock <= POS_LOW_STOCK_AT) {
    return { label: `Quedan ${stock}`, tone: "warning" };
  }
  return null;
}

export function lineSubtotal(cantidad: number, precio: number): number {
  return Math.round(cantidad * toMoney(precio) * 100) / 100;
}

export function saleTotal(items: Array<{ cantidad: number; precioUnitario: number }>): number {
  const sum = items.reduce((total, item) => total + lineSubtotal(item.cantidad, item.precioUnitario), 0);
  return Math.round(sum * 100) / 100;
}

export function mergeStock(serverStock: number | null, pendingQty: number): number | null {
  if (serverStock == null) {
    return null;
  }
  return serverStock - pendingQty;
}

export function cashDelta(recibido: number, total: number): number {
  return Math.round((toMoney(recibido) - toMoney(total)) * 100) / 100;
}

export function quickCashAmounts(total: number): number[] {
  return suggestedPagoConAmounts(total);
}

const METODOS = new Set<PosMetodoPago>(["efectivo", "tarjeta", "transferencia"]);

export type PosSaleRequest = {
  clientId: string;
  metodoPago: PosMetodoPago;
  montoRecibido: number | null;
  items: Array<{ productoId: string; cantidad: number; precioUnitario: number }>;
};

export function parsePosSaleRequest(body: unknown): { ok: true; value: PosSaleRequest } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "El cuerpo no es válido" };
  }
  const record = body as Record<string, unknown>;
  const clientId = typeof record.clientId === "string" ? record.clientId.trim() : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientId)) {
    return { ok: false, error: "La venta no tiene un id válido" };
  }
  const metodoPago = record.metodoPago;
  if (typeof metodoPago !== "string" || !METODOS.has(metodoPago as PosMetodoPago)) {
    return { ok: false, error: "El método de pago no es válido" };
  }
  if (!Array.isArray(record.items) || record.items.length === 0 || record.items.length > 200) {
    return { ok: false, error: "La venta no tiene productos" };
  }
  const items: PosSaleRequest["items"] = [];
  for (const raw of record.items) {
    if (!raw || typeof raw !== "object") {
      return { ok: false, error: "Hay una línea inválida" };
    }
    const line = raw as Record<string, unknown>;
    const productoId = typeof line.productoId === "string" ? line.productoId : typeof line.producto_id === "string" ? line.producto_id : "";
    const cantidad = typeof line.cantidad === "number" ? line.cantidad : Number(line.cantidad);
    const precioRaw = line.precioUnitario ?? line.precio_unitario;
    const precioUnitario = typeof precioRaw === "number" ? precioRaw : Number(precioRaw);
    if (!/^[0-9a-f-]{36}$/i.test(productoId)) {
      return { ok: false, error: "Hay un producto inválido" };
    }
    if (!Number.isInteger(cantidad) || cantidad <= 0 || cantidad > 999) {
      return { ok: false, error: "Hay una cantidad inválida" };
    }
    if (!Number.isFinite(precioUnitario) || precioUnitario < 0) {
      return { ok: false, error: "Hay un precio inválido" };
    }
    items.push({ productoId, cantidad, precioUnitario: Math.round(precioUnitario * 100) / 100 });
  }
  const total = saleTotal(items);
  let montoRecibido: number | null = null;
  if (metodoPago === "efectivo") {
    const raw = record.montoRecibido ?? record.monto_recibido;
    const amount = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(amount) || amount + 0.001 < total) {
      return { ok: false, error: "El monto recibido no cubre el total" };
    }
    montoRecibido = Math.round(amount * 100) / 100;
  }
  return {
    ok: true,
    value: { clientId, metodoPago: metodoPago as PosMetodoPago, montoRecibido, items },
  };
}
