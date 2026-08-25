import { publicMyOrdersUrl, publicOrderUrl } from "@/lib/app-url";
import { createCatalogSession, ensureActiveCatalogSession } from "@/lib/catalog";
import { parseFeedbackButton, recordFeedbackComment, recordFeedbackRating } from "@/lib/order-feedback";
import { getSupabaseAdminClient } from "@/lib/supabase";
import {
  mediaAckMessage,
  mediaPlaceholder,
  storeIncomingWhatsAppMedia,
  type IncomingWhatsAppMedia,
} from "@/lib/whatsapp-media";
import { isMarketingOptOutText, MARKETING_OPT_OUT_REPLY } from "@/lib/marketing-opt-out";
import {
  formatShortOrderId,
  getActiveOrder,
  getOpenStaffOrder,
  getOrCreateChat,
  getStaffPhoneOrNull,
  handleModifyOrder,
  isSamePhone,
  isWaitingForHuman,
  logIncomingMessage,
  recordMissingItemDecision,
  reportMissingItem,
  requestHumanHelp,
  sendCancelConfirmation,
  sendClientMenu,
  sendTextMessage,
  cancelOrder,
  flagCustomerMessageAlert,
} from "@/lib/whatsapp";

const GREETING_PATTERN =
  /^(hola|holi|buenas|buen[oa]s?\s*(d[ií]as|tardes|noches)?|hey|hi|hello|menu|men[uú]|inicio|start)\b/i;

const FALTANTE_PATTERN = /^\/faltante\s+(\S+)\s+(\S+)/i;

type IncomingMessage = {
  from: string;
  text: string;
  buttonId: string | null;
  contactName: string | null;
  media: IncomingWhatsAppMedia | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

async function optOutMarketing(chatId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("chats").update({ acepta_marketing: false }).eq("id", chatId);
  if (error) {
    throw error;
  }
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

        const media = extractIncomingMedia(message, type);
        const text = (textBody || buttonTitle || media?.caption || (type === "interactive" ? buttonId || "" : "")).trim();

        messages.push({
          from,
          text,
          buttonId,
          contactName: nameByWaId.get(from) ?? null,
          media,
        });
      }
    }
  }

  return messages;
}

function extractIncomingMedia(message: Record<string, unknown>, type: string): IncomingWhatsAppMedia | null {
  if (type === "image") {
    const image = asRecord(message.image);
    const id = asString(image?.id);
    if (!id) {
      return null;
    }
    return {
      kind: "imagen",
      id,
      mimeType: asString(image?.mime_type) || "image/jpeg",
      caption: asString(image?.caption).trim(),
      filename: null,
    };
  }
  if (type === "video") {
    const video = asRecord(message.video);
    const id = asString(video?.id);
    if (!id) {
      return null;
    }
    return {
      kind: "video",
      id,
      mimeType: asString(video?.mime_type) || "video/mp4",
      caption: asString(video?.caption).trim(),
      filename: null,
    };
  }
  if (type === "document") {
    const document = asRecord(message.document);
    const id = asString(document?.id);
    if (!id) {
      return null;
    }
    return {
      kind: "documento",
      id,
      mimeType: asString(document?.mime_type) || "application/octet-stream",
      caption: asString(document?.caption).trim(),
      filename: asString(document?.filename) || null,
    };
  }
  return null;
}

function isHumanHelpAction(message: IncomingMessage): boolean {
  const id = (message.buttonId ?? "").toLowerCase();
  const text = message.text.trim().toLowerCase();
  return (
    id === "hablar_con_alguien" ||
    text === "hablar con alguien" ||
    text === "3" ||
    text === "3️⃣"
  );
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

function isModifyOrderAction(message: IncomingMessage): boolean {
  const id = (message.buttonId ?? "").toLowerCase();
  const text = message.text.toLowerCase();
  return id === "modificar_pedido" || text === "modificar pedido";
}

function isCancelOrderAction(message: IncomingMessage): boolean {
  const id = (message.buttonId ?? "").toLowerCase();
  const text = message.text.toLowerCase();
  return id === "cancelar_pedido" || text === "cancelar pedido";
}

function isViewStatusAction(message: IncomingMessage): boolean {
  const id = (message.buttonId ?? "").toLowerCase();
  const text = message.text.toLowerCase();
  return id === "ver_estatus" || text === "ver estatus";
}

function isNoCancelAction(message: IncomingMessage): boolean {
  return (message.buttonId ?? "").toLowerCase() === "no_cancelar";
}

function cancelConfirmationOrderId(message: IncomingMessage): string | null {
  const id = message.buttonId ?? "";
  const prefix = "confirmar_cancelacion_";
  if (!id.toLowerCase().startsWith(prefix)) {
    return null;
  }
  const orderId = id.slice(prefix.length).trim();
  return orderId.length > 0 ? orderId : null;
}

function isMissingReplaceAction(message: IncomingMessage): boolean {
  const id = (message.buttonId ?? "").toLowerCase();
  const text = message.text.trim().toLowerCase();
  return (
    id === "faltante_reemplazo" ||
    text === "1" ||
    text === "1️⃣" ||
    text.startsWith("1 ") ||
    text === "sugerir un reemplazo" ||
    text === "sugerir reemplazo"
  );
}

function isMissingDeleteAction(message: IncomingMessage): boolean {
  const id = (message.buttonId ?? "").toLowerCase();
  const text = message.text.trim().toLowerCase();
  return (
    id === "faltante_eliminar" ||
    text === "2" ||
    text === "2️⃣" ||
    text.startsWith("2 ") ||
    text === "eliminarlo del pedido" ||
    text === "eliminarlo" ||
    text === "eliminar"
  );
}

async function handleNewOrder(phoneNumber: string, chatId: string): Promise<void> {
  const sessionId = await createCatalogSession(chatId);
  const link = publicOrderUrl(sessionId);
  await sendTextMessage(
    phoneNumber,
    `Perfecto. Arma tu pedido aquí (el enlace vence en 2 horas):\n${link}`
  );
}

async function handleViewOrder(phoneNumber: string, chatId: string): Promise<void> {
  const sessionId = await ensureActiveCatalogSession(chatId);
  const link = publicMyOrdersUrl(sessionId);
  await sendTextMessage(phoneNumber, `Aquí puedes ver el estado de tus pedidos:\n${link}`);
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
  const found = await reportMissingItem(orderId, productId);

  if (!found) {
    await sendTextMessage(phoneNumber, "No encontré ese producto en el pedido.");
    return;
  }

  await sendTextMessage(
    phoneNumber,
    `Listo. Marcamos el producto como faltante y avisamos al cliente del pedido #${formatShortOrderId(orderId)}.`
  );
}

async function handleMissingReply(
  phoneNumber: string,
  chatId: string,
  message: IncomingMessage
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

  const orderId = order.id as string;
  const { data: missingItems, error: missingError } = await supabase
    .from("order_items")
    .select("id")
    .eq("order_id", orderId)
    .eq("estado", "faltante")
    .limit(1);

  if (missingError || !missingItems || missingItems.length === 0) {
    return false;
  }

  if (isMissingDeleteAction(message)) {
    await recordMissingItemDecision(orderId, "eliminado");
    await sendTextMessage(
      phoneNumber,
      "Listo, lo quitamos del pedido. El personal ajusta el total y te confirma."
    );
    return true;
  }

  if (isMissingReplaceAction(message)) {
    await sendTextMessage(
      phoneNumber,
      "Dinos qué producto te gustaría de reemplazo. El personal lo ajusta a mano."
    );
    return true;
  }

  if (!message.text) {
    return false;
  }

  await recordMissingItemDecision(orderId, "reemplazado", message.text);
  await sendTextMessage(
    phoneNumber,
    "Gracias. Le pasamos tu sugerencia al personal para que ajuste el pedido."
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
    : message.media
      ? message.media.caption || mediaPlaceholder(message.media.kind, message.media.filename)
      : message.text || "(mensaje vacío)";

  let mediaUrl: string | null = null;
  if (message.media) {
    try {
      mediaUrl = await storeIncomingWhatsAppMedia(chat.id, message.media);
    } catch (error) {
      console.error("[whatsapp] no se pudo guardar media de WhatsApp", error);
    }
  }

  try {
    await logIncomingMessage(chat.id, contenido, {
      tipoContenido: message.media?.kind ?? "texto",
      mediaUrl,
    });
  } catch (error) {
    console.error("[whatsapp] no se pudo registrar el mensaje en whatsapp_log", error);
  }

  if (!fromStaff && isMarketingOptOutText(message.text)) {
    try {
      await optOutMarketing(chat.id);
      await sendTextMessage(message.from, MARKETING_OPT_OUT_REPLY);
    } catch (error) {
      console.error("[whatsapp] error al procesar baja de marketing", error);
    }
    return;
  }

  if (!fromStaff) {
    const rating = parseFeedbackButton(message.buttonId);
    if (rating) {
      try {
        const waiting = await isWaitingForHuman(chat.id);
        await recordFeedbackRating(message.from, chat.id, rating.orderId, rating.calificacion, {
          skipFollowUp: waiting,
        });
      } catch (error) {
        console.error("[whatsapp] error al guardar calificación", error);
      }
      return;
    }

    if (!message.buttonId && message.text) {
      try {
        const savedComment = await recordFeedbackComment(message.from, chat.id, message.text);
        if (savedComment) {
          return;
        }
      } catch (error) {
        console.error("[whatsapp] error al guardar comentario de feedback", error);
      }
    }
  }

  if (!fromStaff) {
    try {
      const openOrder = await getOpenStaffOrder(chat.id);
      if (openOrder) {
        await flagCustomerMessageAlert(chat.id);
      }
    } catch (error) {
      console.error("[whatsapp] no se pudo marcar alerta de mensaje del cliente", error);
    }
  }

  if (!fromStaff) {
    try {
      const waiting = await isWaitingForHuman(chat.id);
      if (waiting) {
        console.log("[whatsapp] skip:reply, chat espera humano", chat.id);
        return;
      }
    } catch (error) {
      console.error("[whatsapp] no se pudo verificar espera humana", error);
    }
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

  if (message.media) {
    try {
      await sendTextMessage(message.from, mediaAckMessage(message.media.kind));
    } catch (error) {
      console.error("[whatsapp] error al acusar recibo de media", error);
    }
    return;
  }

  if (isHumanHelpAction(message)) {
    try {
      await requestHumanHelp(message.from, chat.id);
    } catch (error) {
      console.error("[whatsapp] error al pedir ayuda humana", error);
    }
    return;
  }

  const confirmedCancelId = cancelConfirmationOrderId(message);
  if (confirmedCancelId) {
    try {
      await cancelOrder(confirmedCancelId);
    } catch (error) {
      console.error("[whatsapp] error al cancelar pedido", error);
      try {
        await sendTextMessage(
          message.from,
          "No pudimos cancelar el pedido. Si sigue activo, inténtalo de nuevo."
        );
      } catch (notifyError) {
        console.error("[whatsapp] error al avisar que no se pudo cancelar", notifyError);
      }
    }
    return;
  }

  if (isNoCancelAction(message)) {
    try {
      const activeOrder = await getActiveOrder(chat.id);
      await sendClientMenu(message.from, activeOrder?.id ?? null);
    } catch (error) {
      console.error("[whatsapp] error al volver al menú", error);
    }
    return;
  }

  if (isNewOrderAction(message)) {
    try {
      const activeOrder = await getActiveOrder(chat.id);
      if (activeOrder) {
        await sendClientMenu(message.from, activeOrder.id);
        return;
      }
      await handleNewOrder(message.from, chat.id);
    } catch (error) {
      console.error("[whatsapp] error al crear nueva orden", error);
    }
    return;
  }

  if (isViewOrderAction(message) || isViewStatusAction(message)) {
    try {
      await handleViewOrder(message.from, chat.id);
    } catch (error) {
      console.error("[whatsapp] error al consultar pedido", error);
    }
    return;
  }

  if (isModifyOrderAction(message)) {
    try {
      await handleModifyOrder(message.from, chat.id);
    } catch (error) {
      console.error("[whatsapp] error al modificar pedido", error);
    }
    return;
  }

  if (isCancelOrderAction(message)) {
    try {
      const activeOrder = await getActiveOrder(chat.id);
      if (!activeOrder) {
        await sendTextMessage(message.from, "No tienes un pedido activo para cancelar.");
        return;
      }
      await sendCancelConfirmation(message.from, activeOrder.id);
    } catch (error) {
      console.error("[whatsapp] error al pedir confirmación de cancelación", error);
    }
    return;
  }

  try {
    const handledMissing = await handleMissingReply(message.from, chat.id, message);
    if (handledMissing) {
      return;
    }
  } catch (error) {
    console.error("[whatsapp] error al notificar respuesta de faltante", error);
  }

  const unrecognized = Boolean(message.text) && !GREETING_PATTERN.test(message.text);
  if (chat.created || GREETING_PATTERN.test(message.text) || unrecognized || !message.text) {
    try {
      const activeOrder = await getActiveOrder(chat.id);
      await sendClientMenu(message.from, activeOrder?.id ?? null);
    } catch (error) {
      console.error("[whatsapp] error al enviar el menú interactivo", error);
    }
  }
}

export async function processWhatsAppWebhook(payload: unknown): Promise<void> {
  console.log("[whatsapp][debug] payload recibido:", JSON.stringify(payload));
  const messages = extractIncomingMessages(payload);
  if (messages.length === 0) {
    console.log("[whatsapp] webhook sin mensajes de usuario (posible status delivery/read)");
    return;
  }

  for (const message of messages) {
    try {
      await handleIncomingMessage(message);
    } catch (error) {
      console.error("[whatsapp] error al procesar mensaje", message.from, error);
    }
  }
}
