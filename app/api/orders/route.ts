import { NextRequest, NextResponse } from "next/server";
import { getCustomerForChat, parseNuevaDireccion, resolveCheckoutAddress } from "@/lib/customers";
import {
  isMetodoPago,
  jsonError,
  parseItems,
  priceCatalogItems,
} from "@/lib/order-request";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { confirmOrderToCustomer, sendOrderToStaff } from "@/lib/whatsapp";

type OrderBody = {
  sessionId?: unknown;
  items?: unknown;
  direccion?: unknown;
  metodoPago?: unknown;
  addressId?: unknown;
  nuevaDireccion?: unknown;
};

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
  const addressId = typeof body.addressId === "string" ? body.addressId.trim() : "";
  const nuevaDireccion = parseNuevaDireccion(body.nuevaDireccion);
  const items = parseItems(body.items);

  if (!sessionId) {
    return jsonError("Falta sessionId.", 400);
  }

  if (!items) {
    return jsonError("Debes enviar al menos un producto con cantidad válida.", 400);
  }

  if (!direccion && !addressId && !nuevaDireccion) {
    return jsonError("La dirección de entrega es obligatoria.", 400);
  }

  if (!isMetodoPago(body.metodoPago)) {
    return jsonError("El método de pago debe ser efectivo o tarjeta.", 400);
  }

  const supabase = getSupabaseAdminClient();

  const { data: session, error: sessionError } = await supabase
    .from("order_sessions")
    .select("id, chat_id, estado, expira_en, edit_order_id, es_prueba")
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

  if (session.edit_order_id) {
    return jsonError("Esta sesión es para modificar un pedido. Usa el enlace de edición.", 409);
  }

  const priced = await priceCatalogItems(items);
  if (!priced.ok) {
    return jsonError(priced.message, priced.status);
  }

  const customer = await getCustomerForChat(String(session.chat_id));
  let delivery = direccion;
  let customerId: string | null = customer?.id ?? null;
  try {
    const resolved = await resolveCheckoutAddress(customer, {
      direccion,
      addressId: addressId || null,
      nuevaDireccion,
    });
    delivery = resolved.direccion;
    customerId = resolved.customerId;
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos usar esa dirección.";
    return jsonError(message, 400);
  }

  if (!delivery) {
    return jsonError("La dirección de entrega es obligatoria.", 400);
  }

  const esPrueba = Boolean(session.es_prueba);
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      chat_id: session.chat_id,
      session_id: session.id,
      customer_id: customerId,
      direccion: delivery,
      metodo_pago: body.metodoPago,
      estado: "nueva",
      total_estimado: priced.totalEstimado,
      es_prueba: esPrueba,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    return jsonError("No pudimos crear el pedido.", 500);
  }

  const { error: itemsError } = await supabase.from("order_items").insert(
    priced.orderItems.map((item) => ({
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

  if (!esPrueba) {
    const notifications = await Promise.allSettled([
      sendOrderToStaff(order.id),
      confirmOrderToCustomer(order.id),
    ]);

    notifications.forEach((result) => {
      if (result.status === "rejected") {
        console.error("No se pudo notificar el pedido por WhatsApp", result.reason);
      }
    });
  }

  return NextResponse.json({ success: true, orderId: order.id });
}
