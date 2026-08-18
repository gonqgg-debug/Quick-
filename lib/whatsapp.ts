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

function catalogBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }
  return "http://localhost:3000";
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

const ACTIVE_ORDER_STATES = [
  "nueva",
  "en_proceso",
  "faltante_reportado",
  "confirmada",
] as const;

export async function getActiveOrder(
  chatId: string
): Promise<{ id: string; estado: string } | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, estado")
    .eq("chat_id", chatId)
    .in("estado", [...ACTIVE_ORDER_STATES])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error("No pudimos buscar el pedido activo");
  }

  if (!data?.id) {
    return null;
  }

  return { id: data.id as string, estado: String(data.estado) };
}

async function sendButtonMenu(
  phoneNumber: string,
  bodyText: string,
  buttons: { id: string; title: string }[]
): Promise<WhatsAppSendResult> {
  const to = normalizePhoneNumber(phoneNumber);
  const result = await postWhatsAppMessage({
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: bodyText },
      action: {
        buttons: buttons.map((button) => ({
          type: "reply",
          reply: { id: button.id, title: button.title },
        })),
      },
    },
  });

  await logOutgoingMessage(
    phoneNumber,
    `${bodyText}\n${buttons.map((button) => `[${button.title}]`).join(" ")}`
  );
  return result;
}

export async function sendClientMenu(
  phoneNumber: string,
  activeOrderId: string | null
): Promise<WhatsAppSendResult> {
  if (!activeOrderId) {
    return sendButtonMenu(phoneNumber, "¡Bienvenido a Quick! Mini Market! ¿Cómo te podemos ayudar hoy?", [
      { id: "nueva_orden", title: "Nueva orden" },
      { id: "ver_pedido", title: "Ver mi pedido" },
    ]);
  }

  return sendButtonMenu(phoneNumber, "Ya tienes un pedido en curso. ¿Qué quieres hacer?", [
    { id: "modificar_pedido", title: "Modificar pedido" },
    { id: "cancelar_pedido", title: "Cancelar pedido" },
    { id: "ver_estatus", title: "Ver estatus" },
  ]);
}

export async function handleModifyOrder(phoneNumber: string, chatId: string): Promise<void> {
  const activeOrder = await getActiveOrder(chatId);
  if (!activeOrder) {
    await sendTextMessage(phoneNumber, "No tienes un pedido activo para modificar.");
    return;
  }

  const supabase = getSupabaseAdminClient();

  await supabase
    .from("order_sessions")
    .update({ estado: "expirada" })
    .eq("chat_id", chatId)
    .eq("estado", "activa");

  const { data: session, error } = await supabase
    .from("order_sessions")
    .insert({
      chat_id: chatId,
      estado: "activa",
      edit_order_id: activeOrder.id,
      expira_en: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    })
    .select("id")
    .single();

  if (error || !session) {
    throw new Error("No pudimos crear la sesión de edición");
  }

  const link = `${catalogBaseUrl()}/order/${session.id}`;
  const numero = shortOrderId(activeOrder.id);
  await sendTextMessage(
    phoneNumber,
    `Aquí puedes modificar tu pedido #${numero} (el enlace vence en 2 horas):\n${link}`
  );
}

export async function sendCancelConfirmation(
  phoneNumber: string,
  orderId: string
): Promise<WhatsAppSendResult> {
  const numero = shortOrderId(orderId);
  return sendButtonMenu(phoneNumber, `¿Seguro que quieres cancelar tu pedido #${numero}?`, [
    { id: `confirmar_cancelacion_${orderId}`, title: "Sí, cancelar" },
    { id: "no_cancelar", title: "No" },
  ]);
}

export async function cancelOrder(orderId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { data: order, error } = await supabase
    .from("orders")
    .update({ estado: "cancelada" })
    .eq("id", orderId)
    .in("estado", [...ACTIVE_ORDER_STATES])
    .select("id, chats ( phone_number )")
    .maybeSingle();

  if (error) {
    throw new Error("No pudimos cancelar el pedido");
  }

  if (!order) {
    throw new Error("Ese pedido ya no se puede cancelar");
  }

  const chat = unwrapOne(
    order.chats as { phone_number: string } | { phone_number: string }[] | null
  );
  const phoneNumber = chat?.phone_number;
  const numero = shortOrderId(order.id as string);
  const staffPhone = getStaffPhoneOrNull();

  const notices: Promise<unknown>[] = [];
  if (staffPhone) {
    notices.push(
      sendTextMessage(staffPhone, `❌ Pedido #${numero} fue cancelado por el cliente`)
    );
  }
  if (phoneNumber) {
    notices.push(sendTextMessage(phoneNumber, `Tu pedido #${numero} fue cancelado.`));
  }

  const results = await Promise.allSettled(notices);
  results.forEach((result) => {
    if (result.status === "rejected") {
      console.error("[whatsapp] error al notificar la cancelación", result.reason);
    }
  });
}

export async function sendOrderToStaff(
  orderId: string,
  esModificacion = false
): Promise<void> {
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
    esModificacion ? `✏️ *Pedido #${numero} MODIFICADO*` : `🆕 *Pedido #${numero}*`,
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

export async function confirmOrderToCustomer(
  orderId: string,
  esModificacion = false
): Promise<void> {
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
    esModificacion ? `✏️ *Pedido #${numero} actualizado*` : `✅ *Pedido #${numero} recibido*`,
    "",
    ...itemLines,
    "",
    `💰 *Total: ${formatRd(order.total_estimado)}*`,
    `📍 ${order.direccion}`,
    `💳 ${labelMetodoPago(String(order.metodo_pago))}`,
    "",
    esModificacion
      ? "Guardamos los cambios. Te avisamos cuando esté en camino."
      : "Te avisamos cuando esté en camino. ¡Gracias por tu pedido!",
  ].join("\n");

  await sendTextMessage(phoneNumber, message);
}

export async function notifyOrderDispatched(orderId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select("id, chats ( phone_number )")
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    throw new Error("No pudimos leer el pedido para avisar el despacho");
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

  const numero = shortOrderId(order.id as string);
  await sendTextMessage(
    phoneNumber,
    `🚚 Tu pedido #${numero} ya salió. Para hacer un pedido nuevo, escríbenos cuando quieras.`
  );
}

async function sendMissingItemPrompt(phoneNumber: string, bodyText: string): Promise<void> {
  const to = normalizePhoneNumber(phoneNumber);

  try {
    await postWhatsAppMessage({
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
              reply: { id: "faltante_reemplazo", title: "Sugerir reemplazo" },
            },
            {
              type: "reply",
              reply: { id: "faltante_eliminar", title: "Eliminarlo" },
            },
          ],
        },
      },
    });
    await logOutgoingMessage(
      phoneNumber,
      `${bodyText}\n[Sugerir reemplazo] [Eliminarlo]`
    );
  } catch (error) {
    console.error("[whatsapp] no se pudo enviar el menú de faltante, usando texto", error);
    await sendTextMessage(phoneNumber, bodyText);
  }
}

export async function notifyMissingItem(orderId: string, productId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, chat_id, chats ( phone_number )")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) {
    throw new Error("No pudimos leer el pedido para avisar del faltante");
  }

  if (!order.chat_id) {
    throw new Error("El pedido no tiene un chat asociado");
  }

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("nombre")
    .eq("id", productId)
    .maybeSingle();

  if (productError) {
    throw new Error("No pudimos leer el producto faltante");
  }

  const chat = unwrapOne(
    order.chats as { phone_number: string } | { phone_number: string }[] | null
  );
  const phoneNumber = chat?.phone_number;

  if (!phoneNumber) {
    throw new Error("El pedido no tiene un teléfono de cliente");
  }

  const productName = product?.nombre ? String(product.nombre) : "un producto";
  const bodyText = [
    `❗ No tenemos disponible: ${productName}`,
    "¿Qué prefieres?",
    "1️⃣ Sugerir un reemplazo (respóndenos cuál)",
    "2️⃣ Eliminarlo del pedido",
  ].join("\n");

  await sendMissingItemPrompt(phoneNumber, bodyText);
}

export async function reportMissingItem(orderId: string, productId: string): Promise<boolean> {
  const supabase = getSupabaseAdminClient();

  const { data: items, error: itemError } = await supabase
    .from("order_items")
    .update({ estado: "faltante" })
    .eq("order_id", orderId)
    .eq("product_id", productId)
    .select("id");

  if (itemError) {
    throw new Error("No pudimos marcar el producto como faltante");
  }

  if (!items || items.length === 0) {
    return false;
  }

  const { error: orderError } = await supabase
    .from("orders")
    .update({ estado: "faltante_reportado" })
    .eq("id", orderId);

  if (orderError) {
    throw new Error("No pudimos actualizar el estado del pedido");
  }

  await notifyMissingItem(orderId, productId);
  return true;
}

export type MissingItemDecision = "eliminado" | "reemplazado";

export async function recordMissingItemDecision(
  orderId: string,
  decision: MissingItemDecision,
  clientNote?: string
): Promise<{ productNames: string[] }> {
  const supabase = getSupabaseAdminClient();

  const { data: items, error: lookupError } = await supabase
    .from("order_items")
    .select("id, products!order_items_product_id_fkey ( nombre )")
    .eq("order_id", orderId)
    .eq("estado", "faltante");

  if (lookupError) {
    throw new Error("No pudimos leer los productos faltantes");
  }

  const rows = Array.isArray(items) ? items : [];
  const productNames = rows.map((item) => {
    const product = unwrapOne(
      item.products as { nombre: string } | { nombre: string }[] | null
    );
    return product?.nombre ? String(product.nombre) : "un producto";
  });

  if (rows.length === 0) {
    return { productNames };
  }

  const { error: updateError } = await supabase
    .from("order_items")
    .update({ estado: decision })
    .eq("order_id", orderId)
    .eq("estado", "faltante");

  if (updateError) {
    throw new Error("No pudimos guardar la preferencia del cliente");
  }

  const staffPhone = getStaffPhoneOrNull();
  if (!staffPhone) {
    return { productNames };
  }

  const numero = shortOrderId(orderId);
  const listed = productNames.join(", ");
  const staffMessage =
    decision === "eliminado"
      ? `❌ El cliente quiere ELIMINAR *${listed}* del pedido #${numero}. Ajusta el pedido.`
      : [
          `🔄 El cliente quiere REEMPLAZAR *${listed}* del pedido #${numero}.`,
          clientNote ? `Sugerencia: "${clientNote}"` : "Todavía no indicó el producto de reemplazo.",
          "Ajusta el pedido manualmente (sin matching automático).",
        ].join("\n");

  await sendTextMessage(staffPhone, staffMessage);
  return { productNames };
}
