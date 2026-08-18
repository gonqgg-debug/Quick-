import { NextResponse } from "next/server";
import { toMoney } from "@/lib/money";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type { CreateOrderItem, MetodoPago, OrderEstado } from "@/lib/types";

export const METODOS_PAGO: MetodoPago[] = ["efectivo", "tarjeta"];

export const EDITABLE_ORDER_STATES: OrderEstado[] = [
  "nueva",
  "en_proceso",
  "faltante_reportado",
  "confirmada",
];

export function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export function isMetodoPago(value: unknown): value is MetodoPago {
  return typeof value === "string" && METODOS_PAGO.includes(value as MetodoPago);
}

export function parseItems(value: unknown): CreateOrderItem[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const merged = new Map<string, number>();

  for (const item of value) {
    if (!item || typeof item !== "object") {
      return null;
    }

    const productId = "productId" in item ? item.productId : undefined;
    const cantidad = "cantidad" in item ? item.cantidad : undefined;

    if (typeof productId !== "string" || productId.length === 0) {
      return null;
    }

    const qty = typeof cantidad === "number" ? cantidad : Number(cantidad);
    if (!Number.isInteger(qty) || qty <= 0) {
      return null;
    }

    merged.set(productId, (merged.get(productId) ?? 0) + qty);
  }

  return Array.from(merged.entries()).map(([productId, cantidad]) => ({
    productId,
    cantidad,
  }));
}

export type PricedOrderItem = {
  product_id: string;
  cantidad: number;
  precio_unitario: number;
  estado: "ok";
};

export async function priceCatalogItems(
  items: CreateOrderItem[]
): Promise<
  | { ok: true; orderItems: PricedOrderItem[]; totalEstimado: number }
  | { ok: false; message: string; status: number }
> {
  const productIds = items.map((item) => item.productId);
  const supabase = getSupabaseAdminClient();
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, precio, activo")
    .in("id", productIds);

  if (productsError || !products) {
    return { ok: false, message: "No pudimos leer los precios del catálogo.", status: 500 };
  }

  const productById = new Map(
    products.map((product) => [
      product.id as string,
      { precio: toMoney(product.precio), activo: Boolean(product.activo) },
    ])
  );

  const orderItems: PricedOrderItem[] = [];
  let totalEstimado = 0;

  for (const item of items) {
    const product = productById.get(item.productId);

    if (!product) {
      return { ok: false, message: "Uno de los productos no existe.", status: 409 };
    }

    if (!product.activo) {
      return { ok: false, message: "Hay productos que ya no están disponibles.", status: 409 };
    }

    totalEstimado += product.precio * item.cantidad;
    orderItems.push({
      product_id: item.productId,
      cantidad: item.cantidad,
      precio_unitario: product.precio,
      estado: "ok",
    });
  }

  return { ok: true, orderItems, totalEstimado };
}
