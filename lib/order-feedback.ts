import { getSupabaseAdminClient } from "@/lib/supabase";
import { formatShortOrderId, sendFeedbackSurvey, sendTextMessage } from "@/lib/whatsapp";

export const FEEDBACK_DELAY_MINUTES = 45;
export const FEEDBACK_EMOJIS = ["", "😞", "😐", "🙂", "😊", "🤩"] as const;

export type OrderFeedback = {
  calificacion: number;
  comentario: string | null;
  requiereAtencion: boolean;
};

export function feedbackEmoji(calificacion: number): string {
  if (calificacion < 1 || calificacion > 5) {
    return "";
  }
  return FEEDBACK_EMOJIS[calificacion];
}

export function parseFeedbackButton(
  buttonId: string | null
): { orderId: string; calificacion: number } | null {
  if (!buttonId) {
    return null;
  }
  const match = /^feedback_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})_([1-5])$/i.exec(
    buttonId
  );
  if (!match) {
    return null;
  }
  return { orderId: match[1], calificacion: Number(match[2]) };
}

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function sendDueFeedbackSurveys(limit = 20): Promise<{ sent: number; skipped: number }> {
  const supabase = getSupabaseAdminClient();
  const dueBefore = new Date(Date.now() - FEEDBACK_DELAY_MINUTES * 60 * 1000).toISOString();

  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, chat_id, es_prueba, chats!orders_chat_id_fkey ( phone_number, esperando_humano )")
    .eq("estado", "completada")
    .eq("es_prueba", false)
    .is("feedback_solicitado_en", null)
    .not("completada_en", "is", null)
    .lte("completada_en", dueBefore)
    .order("completada_en", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[feedback] no se pudieron leer pedidos pendientes de encuesta", error);
    throw error;
  }

  let sent = 0;
  let skipped = 0;

  for (const order of orders ?? []) {
    const chat = unwrapOne(
      order.chats as
        | { phone_number?: string; esperando_humano?: boolean }
        | { phone_number?: string; esperando_humano?: boolean }[]
        | null
    );
    const phone = typeof chat?.phone_number === "string" ? chat.phone_number.trim() : "";

    if (!order.chat_id || !phone) {
      console.error("[feedback] no se pudo enviar encuesta: falta chat_id o phone_number", {
        orderId: order.id,
      });
      skipped += 1;
      continue;
    }

    if (Boolean(chat?.esperando_humano)) {
      skipped += 1;
      continue;
    }

    const { data: existing } = await supabase
      .from("order_feedback")
      .select("id")
      .eq("order_id", order.id)
      .maybeSingle();
    if (existing) {
      await supabase
        .from("orders")
        .update({ feedback_solicitado_en: new Date().toISOString() })
        .eq("id", order.id)
        .is("feedback_solicitado_en", null);
      skipped += 1;
      continue;
    }

    try {
      await sendFeedbackSurvey(phone, String(order.id));
      const { error: stampError } = await supabase
        .from("orders")
        .update({ feedback_solicitado_en: new Date().toISOString() })
        .eq("id", order.id)
        .is("feedback_solicitado_en", null);
      if (stampError) {
        console.error("[feedback] se envió la encuesta pero no se pudo marcar el pedido", {
          orderId: order.id,
          error: stampError,
        });
      }
      sent += 1;
    } catch (sendError) {
      console.error("[feedback] no se pudo enviar la encuesta", { orderId: order.id, error: sendError });
    }
  }

  return { sent, skipped };
}

export async function recordFeedbackRating(
  phoneNumber: string,
  chatId: string,
  orderId: string,
  calificacion: number,
  options?: { skipFollowUp?: boolean }
): Promise<boolean> {
  if (calificacion < 1 || calificacion > 5) {
    return false;
  }

  const supabase = getSupabaseAdminClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, chat_id")
    .eq("id", orderId)
    .maybeSingle();

  if (!order || String(order.chat_id) !== chatId) {
    return false;
  }

  const requiereAtencion = calificacion <= 2;
  const { error } = await supabase.from("order_feedback").insert({
    order_id: orderId,
    calificacion,
    requiere_atencion: requiereAtencion,
  });

  if (error) {
    if (error.code === "23505") {
      await sendTextMessage(phoneNumber, "Ya registramos tu calificación. ¡Gracias!");
      return true;
    }
    console.error("[feedback] no se pudo guardar la calificación", error);
    await sendTextMessage(phoneNumber, "No pudimos guardar tu calificación. Inténtalo de nuevo.");
    return true;
  }

  if (options?.skipFollowUp) {
    return true;
  }

  const numero = formatShortOrderId(orderId);

  if (calificacion <= 2) {
    await supabase.from("chats").update({ feedback_comentario_order_id: orderId }).eq("id", chatId);
    await sendTextMessage(
      phoneNumber,
      `Lamentamos que tu experiencia con el pedido #${numero} no fue la mejor, ¿nos cuentas qué pasó?`
    );
    return true;
  }

  await supabase.from("chats").update({ feedback_comentario_order_id: null }).eq("id", chatId);

  if (calificacion === 3) {
    await sendTextMessage(
      phoneNumber,
      `Gracias por tu calificación del pedido #${numero}. Si quieres contarnos algo, escríbenos por aquí.`
    );
    return true;
  }

  await sendTextMessage(phoneNumber, `¡Gracias! 🙌 Nos alegra que el pedido #${numero} haya salido bien.`);
  return true;
}

export async function recordFeedbackComment(
  phoneNumber: string,
  chatId: string,
  text: string
): Promise<boolean> {
  const comment = text.trim();
  if (comment.length < 2) {
    return false;
  }

  const supabase = getSupabaseAdminClient();
  const { data: chat } = await supabase
    .from("chats")
    .select("feedback_comentario_order_id")
    .eq("id", chatId)
    .maybeSingle();

  const orderId = chat?.feedback_comentario_order_id ? String(chat.feedback_comentario_order_id) : "";
  if (!orderId) {
    return false;
  }

  const { error } = await supabase
    .from("order_feedback")
    .update({ comentario: comment.slice(0, 1000) })
    .eq("order_id", orderId)
    .eq("requiere_atencion", true);

  await supabase.from("chats").update({ feedback_comentario_order_id: null }).eq("id", chatId);

  if (error) {
    console.error("[feedback] no se pudo guardar el comentario", error);
    return true;
  }

  await sendTextMessage(phoneNumber, "Gracias por contarnos. Vamos a revisarlo.");
  return true;
}
