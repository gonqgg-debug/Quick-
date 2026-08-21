import { NextRequest, NextResponse } from "next/server";
import { getCustomerForChat, parseNuevaDireccion, resolveCheckoutAddress } from "@/lib/customers";
import {
  EDITABLE_ORDER_STATES,
  isMetodoPago,
  jsonError,
  parseItems,
  priceCatalogItems,
} from "@/lib/order-request";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type { OrderEstado } from "@/lib/types";
import { confirmOrderToCustomer, sendOrderToStaff } from "@/lib/whatsapp";

type OrderBody = {
  sessionId?: unknown;
  items?: unknown;
  direccion?: unknown;
  metodoPago?: unknown;
  addressId?: unknown;
  nuevaDireccion?: unknown;
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const orderId = params.orderId?.trim();
  if (!orderId) {
    return jsonError("Falta el pedido.", 400);
  }

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

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, chat_id, estado, direccion, metodo_pago, es_prueba")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) {
    return jsonError("No pudimos leer el pedido.", 500);
  }

  if (!order) {
    return jsonError("No encontramos ese pedido.", 404);
  }

  const estado = String(order.estado) as OrderEstado;
  if (!EDITABLE_ORDER_STATES.includes(estado)) {
    return jsonError(
      "Este pedido ya no se puede modificar porque está despachado, completado o cancelado.",
      409
    );
  }

  const { data: session, error: sessionError } = await supabase
    .from("order_sessions")
    .select("id, chat_id, estado, expira_en, edit_order_id")
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

  if (session.chat_id !== order.chat_id) {
    return jsonError("Esta sesión no corresponde a este pedido.", 409);
  }

  if (session.edit_order_id !== order.id) {
    return jsonError("Esta sesión no es para editar este pedido.", 409);
  }

  const priced = await priceCatalogItems(items);
  if (!priced.ok) {
    return jsonError(priced.message, priced.status);
  }

  const { error: deleteError } = await supabase.from("order_items").delete().eq("order_id", order.id);

  if (deleteError) {
    return jsonError("No pudimos actualizar los productos del pedido.", 500);
  }

  const { error: itemsError } = await supabase.from("order_items").insert(
    priced.orderItems.map((item) => ({
      ...item,
      order_id: order.id,
    }))
  );

  if (itemsError) {
    return jsonError("No pudimos guardar los productos actualizados.", 500);
  }

  const orderPatch: Record<string, unknown> = {
    total_estimado: priced.totalEstimado,
  };

  const customer = await getCustomerForChat(String(session.chat_id));
  try {
    const resolved = await resolveCheckoutAddress(customer, {
      direccion,
      addressId: addressId || null,
      nuevaDireccion,
    });
    if (resolved.direccion !== String(order.direccion ?? "")) {
      orderPatch.direccion = resolved.direccion;
    }
    if (resolved.customerId) {
      orderPatch.customer_id = resolved.customerId;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos usar esa dirección.";
    return jsonError(message, 400);
  }

  if (body.metodoPago !== String(order.metodo_pago ?? "")) {
    orderPatch.metodo_pago = body.metodoPago;
  }

  const { error: updateError } = await supabase.from("orders").update(orderPatch).eq("id", order.id);

  if (updateError) {
    return jsonError("Los productos se actualizaron, pero no pudimos guardar el resto del pedido.", 500);
  }

  const { data: usedSession, error: sessionUpdateError } = await supabase
    .from("order_sessions")
    .update({ estado: "usada" })
    .eq("id", session.id)
    .eq("estado", "activa")
    .select("id")
    .maybeSingle();

  if (sessionUpdateError || !usedSession) {
    return jsonError("El pedido se actualizó, pero no pudimos cerrar la sesión.", 500);
  }

  if (!Boolean(order.es_prueba)) {
    const notifications = await Promise.allSettled([
      sendOrderToStaff(order.id, true),
      confirmOrderToCustomer(order.id, true),
    ]);

    notifications.forEach((result) => {
      if (result.status === "rejected") {
        console.error("No se pudo notificar la modificación por WhatsApp", result.reason);
      }
    });
  }

  return NextResponse.json({ success: true, orderId: order.id, updated: true });
}
