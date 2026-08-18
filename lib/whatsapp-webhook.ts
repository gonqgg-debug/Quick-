import { getSupabaseAdminClient } from "@/lib/supabase";
import {
  formatShortOrderId,
  getOrCreateChat,
  getStaffPhoneOrNull,
  isSamePhone,
  logIncomingMessage,
  notifyMissingItem,
  sendInteractiveMenu,
  sendTextMessage,
} from "@/lib/whatsapp";

const GREETING_PATTERN =
  /^(hola|holi|buenas|buen[oa]s?\s*(d[ií]as|tardes|noches)?|hey|hi|hello|menu|men[uú]|inicio|start)\b/i;

const FALTANTE_PATTERN = /^\/faltante\s+(\S+)\s+(\S+)/i;

type IncomingMessage = {
  from: string;
  text: string;
  buttonId: string | null;
  contactName: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
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

function orderStatusLabel(estado: string): string {
  const labels: Record<string, string> = {
    nueva: "nueva",
    en_proceso: "en proceso",
    faltante_reportado: "con un faltante reportado",
    confirmada: "confirmada",
    completada: "completada",
    cancelada: "cancelada",
  };
  return labels[estado] ?? estado;
}

function extractIncomingMessages(payload: unknown): IncomingMessage[] {
  const root = asRecord(payload);
  const entries = Array.isArray(root?.entry) ? root.entry : [];
  const messages: IncomingMessage[] = [];

  for (const entry of entries) {
    const changes = Array.isArray(asRecord(entry)?.changes) ? asRecord(entry)!.changes : [];
    for (const change of changes as unknown[]) {
      const value = asRecord(asRecord(change)?.value);
      if (!value) {
        continue;
      }

      const contacts = Array.isArray(value.contacts) ? value.contacts : [];
      const nameByWaId = new Map<string, string>();
      for (const contact of contacts) {
        const row = asRecord(contact);
        const waId = asString(row?.wa_id);
        const profile = asRecord(row?.profile);
        const name = asString(profile?.name);
        if (waId && name) {
          nameByWaId.set(waId, name);
        }
      }

      const incoming = Array.isArray(value.messages) ? value.messages : [];
      for (const raw of incoming) {
        const message = asRecord(raw);
        if (!message) {
          continue;
        }

        const from = asString(message.from);
        if (!from) {
          continue;
        }

        const type = asString(message.type);
        const textBody = asString(asRecord(message.text)?.body);
        const interactive = asRecord(message.interactive);
        const buttonReply = asRecord(interactive?.button_reply);
        const listReply = asRecord(interactive?.list_reply);
        const legacyButton = asRecord(message.button);

        const buttonId =
          asString(buttonReply?.id) ||
          asString(listReply?.id) ||
          asString(legacyButton?.payload) ||
          null;

        const buttonTitle =
          asString(buttonReply?.title) ||
          asString(listReply?.title) ||
          asString(legacyButton?.text);

        const text = textBody || buttonTitle || (type === "interactive" ? buttonId || "" : "");

        messages.push({
          from,
          text: text.trim(),
          buttonId,
          contactName: nameByWaId.get(from) ?? null,
        });
      }
    }
  }

  return messages;
}

function isNewOrderAction(message: IncomingMessage): boolean {
  const id = (message.buttonId ?? "").toLowerCase();
  const text = message.text.toLowerCase();
  return id === "nueva_orden" || text === "nueva orden";
}

function isViewOrderAction(message: IncomingMessage): boolean {
  const id = (message.buttonId ?? "").toLowerCase();
  const text = message.text.toLowerCase();
  return id === "ver_pedido" || text === "ver mi pedido";
}

async function handleNewOrder(phoneNumber: string, chatId: string): Promise<void> {
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
      expira_en: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    })
    .select("id")
    .single();

  if (error || !session) {
    throw new Error("No pudimos crear la sesión de pedido");
  }

  const link = `${catalogBaseUrl()}/order/${session.id}`;
  await sendTextMessage(
    phoneNumber,
    `Perfecto. Arma tu pedido aquí (el enlace vence en 2 horas):\n${link}`
  );
}

async function handleViewOrder(phoneNumber: string, chatId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select("id, estado")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error("No pudimos buscar el pedido");
  }

  if (!order) {
    await sendTextMessage(phoneNumber, "Aún no tienes un pedido. Elige *Nueva orden* para empezar.");
    return;
  }

  const numero = formatShortOrderId(order.id as string);
  await sendTextMessage(
    phoneNumber,
    `Tu pedido #${numero} está ${orderStatusLabel(String(order.estado))}.`
  );
}

async function handleStaffMissing(phoneNumber: string, text: string): Promise<void> {
  const match = text.match(FALTANTE_PATTERN);
  if (!match) {
    await sendTextMessage(
      phoneNumber,
      "Usa este formato: /faltante [orderId] [productId]"
    );
    return;
  }

  const orderId = match[1];
  const productId = match[2];
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
    await sendTextMessage(phoneNumber, "No encontré ese producto en el pedido.");
    return;
  }

  const { error: orderError } = await supabase
    .from("orders")
    .update({ estado: "faltante_reportado" })
    .eq("id", orderId);

  if (orderError) {
    throw new Error("No pudimos actualizar el estado del pedido");
  }

  await notifyMissingItem(orderId, productId);
  await sendTextMessage(
    phoneNumber,
    `Listo. Marcamos el producto como faltante y avisamos al cliente del pedido #${formatShortOrderId(orderId)}.`
  );
}

async function handleMissingReply(
  phoneNumber: string,
  chatId: string,
  text: string
): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select("id, estado")
    .eq("chat_id", chatId)
    .eq("estado", "faltante_reportado")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !order) {
    return false;
  }

  const staffPhone = getStaffPhoneOrNull();
  if (staffPhone) {
    await sendTextMessage(
      staffPhone,
      `💬 El cliente respondió sobre el pedido #${formatShortOrderId(order.id as string)}:\n"${text}"`
    );
  }

  await sendTextMessage(
    phoneNumber,
    "Gracias. El personal revisa tu respuesta y te confirma el cambio."
  );
  return true;
}

async function handleIncomingMessage(message: IncomingMessage): Promise<void> {
  const staffPhone = getStaffPhoneOrNull();
  const fromStaff = staffPhone ? isSamePhone(message.from, staffPhone) : false;

  let chat: { id: string; created: boolean };
  try {
    chat = await getOrCreateChat(message.from, message.contactName);
  } catch (error) {
    console.error("[whatsapp] no se pudo buscar o crear el chat", message.from, error);
    return;
  }

  const contenido = message.buttonId
    ? `[botón:${message.buttonId}] ${message.text}`.trim()
    : message.text || "(mensaje vacío)";

  try {
    await logIncomingMessage(chat.id, contenido);
  } catch (error) {
    console.error("[whatsapp] no se pudo registrar el mensaje en whatsapp_log", error);
  }

  if (fromStaff) {
    if (FALTANTE_PATTERN.test(message.text) || message.text.toLowerCase().startsWith("/faltante")) {
      try {
        await handleStaffMissing(message.from, message.text);
      } catch (error) {
        console.error("[whatsapp] error al reportar faltante", error);
      }
    }
    return;
  }

  if (isNewOrderAction(message)) {
    try {
      await handleNewOrder(message.from, chat.id);
    } catch (error) {
      console.error("[whatsapp] error al crear nueva orden", error);
    }
    return;
  }

  if (isViewOrderAction(message)) {
    try {
      await handleViewOrder(message.from, chat.id);
    } catch (error) {
      console.error("[whatsapp] error al consultar pedido", error);
    }
    return;
  }

  if (message.text && !message.buttonId) {
    try {
      const handledMissing = await handleMissingReply(message.from, chat.id, message.text);
      if (handledMissing) {
        return;
      }
    } catch (error) {
      console.error("[whatsapp] error al notificar respuesta de faltante", error);
    }
  }

  const unrecognized = Boolean(message.text) && !GREETING_PATTERN.test(message.text);
  if (chat.created || GREETING_PATTERN.test(message.text) || unrecognized || !message.text) {
    try {
      await sendInteractiveMenu(message.from);
    } catch (error) {
      console.error("[whatsapp] error al enviar el menú interactivo", error);
    }
  }
}

export async function processWhatsAppWebhook(payload: unknown): Promise<void> {
  console.log("[whatsapp][debug] payload recibido:", JSON.stringify(payload));
  const messages = extractIncomingMessages(payload);
  for (const message of messages) {
    try {
      await handleIncomingMessage(message);
    } catch (error) {
      console.error("[whatsapp] error al procesar mensaje", message.from, error);
    }
  }
}
