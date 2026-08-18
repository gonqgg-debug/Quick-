import { getSupabaseAdminClient } from "@/lib/supabase";
import { toMoney } from "@/lib/money";
import type { MetodoPago, OrderDraft, OrderSession, Product } from "@/lib/types";

export async function getActiveOrderSession(
  sessionId: string
): Promise<OrderSession | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("order_sessions")
    .select("id, chat_id, estado, expira_en, edit_order_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const session = data as OrderSession;
  if (session.estado !== "activa") {
    return null;
  }

  if (new Date(session.expira_en).getTime() <= Date.now()) {
    return null;
  }

  return {
    ...session,
    edit_order_id: (data.edit_order_id as string | null) ?? null,
  };
}

export async function getOrderDraft(orderId: string): Promise<OrderDraft | null> {
  const supabase = getSupabaseAdminClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      direccion,
      metodo_pago,
      order_items (
        product_id,
        cantidad,
        estado
      )
    `
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error || !order) {
    return null;
  }

  const metodo = String(order.metodo_pago ?? "");
  const metodoPago: MetodoPago | null =
    metodo === "efectivo" || metodo === "tarjeta" ? metodo : null;

  const rawItems = Array.isArray(order.order_items) ? order.order_items : [];
  const items = rawItems
    .filter((item) => String(item.estado ?? "ok") !== "eliminado")
    .map((item) => ({
      productId: String(item.product_id),
      cantidad: Number(item.cantidad),
    }))
    .filter((item) => item.productId && Number.isInteger(item.cantidad) && item.cantidad > 0);

  return {
    orderId: order.id as string,
    direccion: String(order.direccion ?? ""),
    metodoPago,
    items,
  };
}

export async function getActiveProducts(): Promise<Product[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, nombre, marca, descripcion, precio, foto_url, categoria")
    .eq("activo", true)
    .order("categoria", { ascending: true })
    .order("nombre", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    id: row.id as string,
    nombre: row.nombre as string,
    marca: (row.marca as string | null) ?? null,
    descripcion: (row.descripcion as string | null) ?? null,
    precio: toMoney(row.precio),
    foto_url: (row.foto_url as string | null) ?? null,
    categoria: row.categoria as string,
  }));
}
