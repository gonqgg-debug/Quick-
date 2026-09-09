import { formatPrice, toMoney } from "@/lib/money";
import { parseItems, priceCatalogItems } from "@/lib/order-request";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type { CreateOrderItem, OrderEstado } from "@/lib/types";

export const STAFF_EDITABLE_ORDER_STATES: OrderEstado[] = [
  "nueva",
  "en_proceso",
  "faltante_reportado",
  "confirmada",
  "despachada",
];

function billableEstado(estado: string): boolean {
  return estado !== "eliminado" && estado !== "faltante";
}

export async function recalcOrderTotal(orderId: string): Promise<number> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("order_items")
    .select("cantidad, precio_unitario, estado")
    .eq("order_id", orderId);

  if (error) {
    throw new Error("No pudimos recalcular el total del pedido");
  }

  const total = (data ?? []).reduce((sum, row) => {
    if (!billableEstado(String(row.estado ?? "ok"))) {
      return sum;
    }
    const qty = Number(row.cantidad);
    return sum + toMoney(row.precio_unitario) * (Number.isFinite(qty) ? qty : 0);
  }, 0);

  const { error: updateError } = await supabase
    .from("orders")
    .update({ total_estimado: total })
    .eq("id", orderId);

  if (updateError) {
    throw new Error("No pudimos guardar el total actualizado");
  }

  return total;
}

export async function remainingBillableCount(orderId: string): Promise<number> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("order_items")
    .select("id, estado")
    .eq("order_id", orderId);

  if (error) {
    throw new Error("No pudimos leer los productos del pedido");
  }

  return (data ?? []).filter((row) => billableEstado(String(row.estado ?? "ok"))).length;
}

export type RemoveMissingResult = {
  found: boolean;
  cancelled: boolean;
  productName: string;
  total: number;
  totalLabel: string;
};

export async function removeMissingOrderItem(
  orderId: string,
  productId: string
): Promise<RemoveMissingResult> {
  const supabase = getSupabaseAdminClient();
  const { data: items, error } = await supabase
    .from("order_items")
    .select(
      `
      id,
      product_id,
      estado,
      products!order_items_product_id_fkey ( nombre )
    `
    )
    .eq("order_id", orderId)
    .eq("product_id", productId);

  if (error) {
    throw new Error("No pudimos leer el producto del pedido");
  }

  const match = (items ?? []).find((row) => billableEstado(String(row.estado ?? "ok")));
  if (!match) {
    return { found: false, cancelled: false, productName: "", total: 0, totalLabel: formatPrice(0) };
  }

  const product = Array.isArray(match.products) ? match.products[0] : match.products;
  const productName =
    product && typeof product === "object" && "nombre" in product && product.nombre
      ? String(product.nombre)
      : "Producto";

  const { error: updateError } = await supabase
    .from("order_items")
    .update({ estado: "eliminado" })
    .eq("id", match.id);

  if (updateError) {
    throw new Error("No pudimos quitar el producto del pedido");
  }

  const remaining = await remainingBillableCount(orderId);
  if (remaining === 0) {
    const { error: cancelError } = await supabase
      .from("orders")
      .update({ estado: "cancelada", total_estimado: 0 })
      .eq("id", orderId);
    if (cancelError) {
      throw new Error("No pudimos cancelar el pedido vacío");
    }
    return {
      found: true,
      cancelled: true,
      productName,
      total: 0,
      totalLabel: formatPrice(0),
    };
  }

  const total = await recalcOrderTotal(orderId);
  const { data: order } = await supabase.from("orders").select("estado").eq("id", orderId).maybeSingle();
  if (String(order?.estado ?? "") === "faltante_reportado") {
    await supabase.from("orders").update({ estado: "en_proceso" }).eq("id", orderId);
  }

  return {
    found: true,
    cancelled: false,
    productName,
    total,
    totalLabel: formatPrice(total),
  };
}

export async function replaceStaffOrderItems(
  orderId: string,
  items: CreateOrderItem[]
): Promise<{ total: number }> {
  const priced = await priceCatalogItems(items);
  if (!priced.ok) {
    throw new Error(priced.message);
  }

  const supabase = getSupabaseAdminClient();
  const { error: deleteError } = await supabase.from("order_items").delete().eq("order_id", orderId);
  if (deleteError) {
    throw new Error("No pudimos actualizar los productos del pedido");
  }

  const { error: insertError } = await supabase.from("order_items").insert(
    priced.orderItems.map((item) => ({
      ...item,
      order_id: orderId,
    }))
  );
  if (insertError) {
    throw new Error("No pudimos guardar los productos actualizados");
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update({ total_estimado: priced.totalEstimado })
    .eq("id", orderId);
  if (updateError) {
    throw new Error("No pudimos guardar el total actualizado");
  }

  return { total: priced.totalEstimado };
}

export function parseStaffOrderItems(value: unknown): CreateOrderItem[] | null {
  return parseItems(value);
}
