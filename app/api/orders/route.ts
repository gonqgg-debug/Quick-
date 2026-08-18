import { NextRequest, NextResponse } from "next/server";
import { toMoney } from "@/lib/money";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type { CreateOrderItem, MetodoPago } from "@/lib/types";
import { confirmOrderToCustomer, sendOrderToStaff } from "@/lib/whatsapp";

const METODOS_PAGO: MetodoPago[] = ["efectivo", "tarjeta"];

type OrderBody = {
  sessionId?: unknown;
  items?: unknown;
  direccion?: unknown;
  metodoPago?: unknown;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

function isMetodoPago(value: unknown): value is MetodoPago {
  return typeof value === "string" && METODOS_PAGO.includes(value as MetodoPago);
}

function parseItems(value: unknown): CreateOrderItem[] | null {
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

export async function GET() {
  return NextResponse.json({ orders: [] });
}

export async function POST(request: NextRequest) {
  let body: OrderBody;

  try {
    body = (await request.json()) as OrderBody;
  } catch {
    return jsonError("El cuerpo de la solicitud no es un JSON válido.", 400);
  }

  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  const direccion = typeof body.direccion === "string" ? body.direccion.trim() : "";
  const items = parseItems(body.items);

  if (!sessionId) {
    return jsonError("Falta sessionId.", 400);
  }

  if (!items) {
    return jsonError("Debes enviar al menos un producto con cantidad válida.", 400);
  }

  if (!direccion) {
    return jsonError("La dirección de entrega es obligatoria.", 400);
  }

  if (!isMetodoPago(body.metodoPago)) {
    return jsonError("El método de pago debe ser efectivo o tarjeta.", 400);
  }

  const supabase = getSupabaseAdminClient();

  const { data: session, error: sessionError } = await supabase
    .from("order_sessions")
    .select("id, chat_id, estado, expira_en")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) {
    return jsonError("No pudimos validar la sesión.", 500);
  }

  if (!session) {
    return jsonError("La sesión no existe. Solicita un enlace nuevo por WhatsApp.", 404);
  }

  if (new Date(session.expira_en as string).getTime() <= Date.now()) {
    return jsonError("La sesión expiró. Solicita un enlace nuevo por WhatsApp.", 409);
  }

  if (session.estado !== "activa") {
    return jsonError("Esta sesión ya no está activa. Solicita un enlace nuevo por WhatsApp.", 409);
  }

  const productIds = items.map((item) => item.productId);
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, precio, activo")
    .in("id", productIds);

  if (productsError || !products) {
    return jsonError("No pudimos leer los precios del catálogo.", 500);
  }

  const productById = new Map(
    products.map((product) => [
      product.id as string,
      { precio: toMoney(product.precio), activo: Boolean(product.activo) },
    ])
  );

  const orderItems = [];
  let totalEstimado = 0;

  for (const item of items) {
    const product = productById.get(item.productId);

    if (!product) {
      return jsonError("Uno de los productos no existe.", 409);
    }

    if (!product.activo) {
      return jsonError("Hay productos que ya no están disponibles.", 409);
    }

    totalEstimado += product.precio * item.cantidad;
    orderItems.push({
      product_id: item.productId,
      cantidad: item.cantidad,
      precio_unitario: product.precio,
      estado: "ok",
    });
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      chat_id: session.chat_id,
      session_id: session.id,
      direccion,
      metodo_pago: body.metodoPago,
      estado: "nueva",
      total_estimado: totalEstimado,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    return jsonError("No pudimos crear el pedido.", 500);
  }

  const { error: itemsError } = await supabase.from("order_items").insert(
    orderItems.map((item) => ({
      ...item,
      order_id: order.id,
    }))
  );

  if (itemsError) {
    return jsonError("El pedido se creó, pero no pudimos guardar los productos.", 500);
  }

  const { data: usedSession, error: sessionUpdateError } = await supabase
    .from("order_sessions")
    .update({ estado: "usada" })
    .eq("id", session.id)
    .eq("estado", "activa")
    .select("id")
    .maybeSingle();

  if (sessionUpdateError || !usedSession) {
    return jsonError("El pedido se creó, pero no pudimos cerrar la sesión.", 500);
  }

  try {
    await sendOrderToStaff(order.id);
    await confirmOrderToCustomer(order.id);
  } catch (error) {
    console.error("No se pudo notificar el pedido por WhatsApp", error);
  }

  return NextResponse.json({ success: true, orderId: order.id });
}

export async function PATCH() {
  return NextResponse.json({ updated: false }, { status: 501 });
}
