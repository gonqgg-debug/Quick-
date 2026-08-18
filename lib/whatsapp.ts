import { toMoney } from "@/lib/money";
import { getSupabaseAdminClient } from "@/lib/supabase";

const GRAPH_API_VERSION = "v20.0";
const GRAPH_API_BASE = "https://graph.facebook.com";

export type WhatsAppSendResult = {
  ok: boolean;
  status: number;
  data: unknown;
};

function getWhatsAppAccessToken(): string {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) {
    throw new Error("Falta la variable de entorno WHATSAPP_ACCESS_TOKEN");
  }
  return token;
}

function getWhatsAppPhoneNumberId(): string {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!phoneNumberId) {
    throw new Error("Falta la variable de entorno WHATSAPP_PHONE_NUMBER_ID");
  }
  return phoneNumberId;
}

function getStaffPhoneNumber(): string {
  const phone = process.env.STAFF_PHONE_NUMBER;
  if (!phone) {
    throw new Error("Falta la variable de entorno STAFF_PHONE_NUMBER");
  }
  return phone;
}

function getMessagesEndpoint(): string {
  return `${GRAPH_API_BASE}/${GRAPH_API_VERSION}/${getWhatsAppPhoneNumberId()}/messages`;
}

export function normalizePhoneNumber(phoneNumber: string): string {
  return phoneNumber.replace(/[^\d]/g, "");
}

function formatRd(value: unknown): string {
  const amount = toMoney(value);
  const formatted = new Intl.NumberFormat("es-DO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
  return `RD$${formatted}`;
}

function shortOrderId(orderId: string): string {
  return orderId.replace(/-/g, "").slice(0, 8).toUpperCase();
}

export function formatShortOrderId(orderId: string): string {
  return shortOrderId(orderId);
}

export function isSamePhone(a: string, b: string): boolean {
  return normalizePhoneNumber(a) === normalizePhoneNumber(b);
}

export function getStaffPhoneOrNull(): string | null {
  const phone = process.env.STAFF_PHONE_NUMBER?.trim();
  return phone ? phone : null;
}

function labelMetodoPago(metodo: string): string {
  if (metodo === "efectivo") return "Efectivo";
  if (metodo === "tarjeta") return "Tarjeta";
  return metodo;
}

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

async function postWhatsAppMessage(
  payload: Record<string, unknown>
): Promise<WhatsAppSendResult> {
  const response = await fetch(getMessagesEndpoint(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getWhatsAppAccessToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data &&
      typeof data === "object" &&
      "error" in data &&
      data.error &&
      typeof data.error === "object" &&
      "message" in data.error
        ? String((data.error as { message: unknown }).message)
        : "Error al enviar el mensaje de WhatsApp";
    throw new Error(message);
  }

  return {
    ok: true,
    status: response.status,
    data,
  };
}

export async function getOrCreateChat(
  phoneNumber: string,
  nombre?: string | null
): Promise<{ id: string; created: boolean }> {
  const supabase = getSupabaseAdminClient();
  const normalized = normalizePhoneNumber(phoneNumber);
  const variants = Array.from(new Set([phoneNumber.trim(), normalized, `+${normalized}`]));

  const { data: existing, error: lookupError } = await supabase
    .from("chats")
    .select("id, nombre")
    .in("phone_number", variants)
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    throw new Error("No pudimos buscar el chat de WhatsApp");
  }

  if (existing?.id) {
    if (nombre && !existing.nombre) {
      await supabase.from("chats").update({ nombre }).eq("id", existing.id);
    }
    return { id: existing.id as string, created: false };
  }

  const { data: created, error: insertError } = await supabase
    .from("chats")
    .insert({ phone_number: normalized, nombre: nombre || null })
    .select("id")
    .single();

  if (insertError || !created) {
    throw new Error("No pudimos registrar el chat de WhatsApp");
  }

  return { id: created.id as string, created: true };
}

async function getOrCreateChatId(phoneNumber: string): Promise<string> {
  const chat = await getOrCreateChat(phoneNumber);
  return chat.id;
}

async function logOutgoingMessage(phoneNumber: string, contenido: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const chatId = await getOrCreateChatId(phoneNumber);

  const { error } = await supabase.from("whatsapp_log").insert({
    chat_id: chatId,
    direccion: "saliente",
    contenido,
  });

  if (error) {
    console.error("No se pudo registrar el mensaje en whatsapp_log", error);
  }
}

export async function logIncomingMessage(chatId: string, contenido: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("whatsapp_log").insert({
    chat_id: chatId,
    direccion: "entrante",
    contenido,
  });

  if (error) {
    console.error("No se pudo registrar el mensaje entrante en whatsapp_log", error);
  }
}

export async function sendTextMessage(phoneNumber: string, text: string): Promise<WhatsAppSendResult> {
  const to = normalizePhoneNumber(phoneNumber);
  const result = await postWhatsAppMessage({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "text",
    text: {
      preview_url: false,
      body: text,
    },
  });

  await logOutgoingMessage(phoneNumber, text);
  return result;
}

export async function sendInteractiveMenu(phoneNumber: string): Promise<WhatsAppSendResult> {
  const to = normalizePhoneNumber(phoneNumber);
  const bodyText = "¡Bienvenido a Quick! Mini Market! ¿Cómo te podemos ayudar hoy?";
  const result = await postWhatsAppMessage({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: bodyText },
      action: {
        buttons: [
          {
            type: "reply",
            reply: { id: "nueva_orden", title: "Nueva orden" },
          },
          {
            type: "reply",
            reply: { id: "ver_pedido", title: "Ver mi pedido" },
          },
        ],
      },
    },
  });

  await logOutgoingMessage(
    phoneNumber,
    `${bodyText}\n[Nueva orden] [Ver mi pedido]`
  );
  return result;
}

export async function sendOrderToStaff(orderId: string): Promise<void> {
  const staffPhone = getStaffPhoneNumber();
  const supabase = getSupabaseAdminClient();

  const { data: order, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      direccion,
      metodo_pago,
      total_estimado,
      chat_id,
      order_items (
        cantidad,
        precio_unitario,
        product_id,
        products!order_items_product_id_fkey ( nombre )
      )
    `
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    throw new Error("No pudimos leer el pedido para notificar al personal");
  }

  if (!order) {
    throw new Error(`No existe el pedido ${orderId}`);
  }

  const items = Array.isArray(order.order_items) ? order.order_items : [];
  const itemLines = items.map((item) => {
    const product = unwrapOne(
      item.products as { nombre: string } | { nombre: string }[] | null
    );
    const nombre = product?.nombre ?? "Producto";
    const cantidad = Number(item.cantidad);
    const lineTotal = toMoney(item.precio_unitario) * cantidad;
    return `${cantidad}x ${nombre} - ${formatRd(lineTotal)}`;
  });

  const numero = shortOrderId(order.id as string);
  const message = [
    `🆕 *Pedido #${numero}*`,
    `📍 ${order.direccion}`,
    `💳 ${labelMetodoPago(String(order.metodo_pago))}`,
    "",
    ...itemLines,
    "",
    `💰 *Total: ${formatRd(order.total_estimado)}*`,
    "",
    `Responde con /faltante ${order.id} [productId] para reportar un producto que no está disponible.`,
  ].join("\n");

  await sendTextMessage(staffPhone, message);
}

export async function confirmOrderToCustomer(orderId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();

  const { data: order, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      direccion,
      metodo_pago,
      total_estimado,
      chats ( phone_number ),
      order_items (
        cantidad,
        precio_unitario,
        products!order_items_product_id_fkey ( nombre )
      )
    `
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    throw new Error("No pudimos leer el pedido para confirmar al cliente");
  }

  if (!order) {
    throw new Error(`No existe el pedido ${orderId}`);
  }

  const chat = unwrapOne(
    order.chats as { phone_number: string } | { phone_number: string }[] | null
  );
  const phoneNumber = chat?.phone_number;

  if (!phoneNumber) {
    throw new Error("El pedido no tiene un teléfono de cliente");
  }

  const items = Array.isArray(order.order_items) ? order.order_items : [];
  const itemLines = items.map((item) => {
    const product = unwrapOne(
      item.products as { nombre: string } | { nombre: string }[] | null
    );
    const nombre = product?.nombre ?? "Producto";
    const cantidad = Number(item.cantidad);
    const lineTotal = toMoney(item.precio_unitario) * cantidad;
    return `${cantidad}x ${nombre} - ${formatRd(lineTotal)}`;
  });

  const numero = shortOrderId(order.id as string);
  const message = [
    `✅ *Pedido #${numero} recibido*`,
    "",
    ...itemLines,
    "",
    `💰 *Total: ${formatRd(order.total_estimado)}*`,
    `📍 ${order.direccion}`,
    `💳 ${labelMetodoPago(String(order.metodo_pago))}`,
    "",
    "Te avisamos cuando esté en camino. ¡Gracias por tu pedido!",
  ].join("\n");

  await sendTextMessage(phoneNumber, message);
}

export async function notifyMissingItem(orderId: string, productId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, chats ( phone_number )")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) {
    throw new Error("No pudimos leer el pedido para avisar del faltante");
  }

  const { data: product } = await supabase
    .from("products")
    .select("nombre")
    .eq("id", productId)
    .maybeSingle();

  const chat = unwrapOne(
    order.chats as { phone_number: string } | { phone_number: string }[] | null
  );
  const phoneNumber = chat?.phone_number;

  if (!phoneNumber) {
    throw new Error("El pedido no tiene un teléfono de cliente");
  }

  const productName = product?.nombre ? String(product.nombre) : "un producto";
  const numero = shortOrderId(order.id as string);

  await sendTextMessage(
    phoneNumber,
    `El producto *${productName}* de tu pedido #${numero} no está disponible. ¿Quieres reemplazarlo por otro o eliminarlo del pedido? Responde por este chat y el personal lo resuelve.`
  );
}
