import { cache } from "react";
import { getCustomerForChat } from "@/lib/customers";
import {
  metodoPagoLabel,
  type CustomerOrder,
} from "@/lib/customer-orders-shared";
import { formatPrice, toMoney } from "@/lib/money";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type { OrderEstado } from "@/lib/types";

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function listCustomerOrdersForSession(chatId: string): Promise<CustomerOrder[]> {
  const supabase = getSupabaseAdminClient();
  const customer = await getCustomerForChat(chatId);

  const { data: chat } = await supabase
    .from("chats")
    .select("phone_number")
    .eq("id", chatId)
    .maybeSingle();

  const phone = String(chat?.phone_number ?? "").trim();
  let chatIds = [chatId];
  if (phone) {
    const { data: chats } = await supabase.from("chats").select("id").eq("phone_number", phone);
    chatIds = Array.from(new Set([chatId, ...(chats ?? []).map((row) => String(row.id))]));
  }

  let query = supabase
    .from("orders")
    .select(
      `
      id,
      created_at,
      estado,
      direccion,
      metodo_pago,
      total_estimado,
      chat_id,
      customer_id,
      order_items (
        id,
        product_id,
        cantidad,
        precio_unitario,
        estado,
        products!order_items_product_id_fkey ( nombre )
      )
    `
    )
    .order("created_at", { ascending: false });

  if (customer) {
    query = query.or(`customer_id.eq.${customer.id},chat_id.in.(${chatIds.join(",")})`);
  } else {
    query = query.in("chat_id", chatIds);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => {
    const rawItems = Array.isArray(row.order_items) ? row.order_items : [];
    const items = rawItems
      .filter((item) => String(item.estado ?? "ok") !== "eliminado")
      .map((item) => {
        const product = unwrapOne(item.products as { nombre?: string } | { nombre?: string }[] | null);
        const cantidad = Number(item.cantidad);
        const precio = toMoney(item.precio_unitario);
        const qty = Number.isFinite(cantidad) ? cantidad : 0;
        return {
          id: String(item.id ?? ""),
          productId: String(item.product_id ?? ""),
          nombre: product?.nombre ? String(product.nombre) : "Producto",
          cantidad: qty,
          precioLabel: formatPrice(precio * qty),
        };
      });

    return {
      id: String(row.id),
      createdAt: String(row.created_at ?? ""),
      estado: String(row.estado) as OrderEstado,
      direccion: String(row.direccion ?? ""),
      metodoPago: String(row.metodo_pago ?? ""),
      metodoPagoLabel: metodoPagoLabel(String(row.metodo_pago ?? "")),
      totalLabel: formatPrice(row.total_estimado),
      items,
    };
  });
}

const ORDER_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isPublicOrderId(value: string): boolean {
  return ORDER_ID_RE.test(value.trim());
}

export const getPublicOrder = cache(async (orderId: string): Promise<CustomerOrder | null> => {
  const id = orderId.trim();
  if (!isPublicOrderId(id)) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      created_at,
      estado,
      direccion,
      metodo_pago,
      total_estimado,
      order_items (
        id,
        product_id,
        cantidad,
        precio_unitario,
        estado,
        products!order_items_product_id_fkey ( nombre )
      )
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }

  const rawItems = Array.isArray(data.order_items) ? data.order_items : [];
  const items = rawItems
    .filter((item) => String(item.estado ?? "ok") !== "eliminado")
    .map((item) => {
      const product = unwrapOne(item.products as { nombre?: string } | { nombre?: string }[] | null);
      const cantidad = Number(item.cantidad);
      const precio = toMoney(item.precio_unitario);
      const qty = Number.isFinite(cantidad) ? cantidad : 0;
      return {
        id: String(item.id ?? ""),
        productId: String(item.product_id ?? ""),
        nombre: product?.nombre ? String(product.nombre) : "Producto",
        cantidad: qty,
        precioLabel: formatPrice(precio * qty),
      };
    });

  return {
    id: String(data.id),
    createdAt: String(data.created_at ?? ""),
    estado: String(data.estado) as OrderEstado,
    direccion: String(data.direccion ?? ""),
    metodoPago: String(data.metodo_pago ?? ""),
    metodoPagoLabel: metodoPagoLabel(String(data.metodo_pago ?? "")),
    totalLabel: formatPrice(data.total_estimado),
    items,
  };
});
