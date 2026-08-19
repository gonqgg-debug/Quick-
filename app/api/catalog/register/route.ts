import { NextRequest } from "next/server";
import { getCustomerForChat, isAddressLabel, registerCustomerForChat } from "@/lib/customers";
import { jsonError } from "@/lib/order-request";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type RegisterBody = {
  sessionId?: unknown;
  nombre?: unknown;
  apellido?: unknown;
  direccion?: unknown;
  etiqueta?: unknown;
};

async function sessionChatId(sessionId: string): Promise<{ chatId: string } | { error: ReturnType<typeof jsonError> }> {
  const supabase = getSupabaseAdminClient();
  const { data: session, error } = await supabase
    .from("order_sessions")
    .select("id, chat_id, estado, expira_en")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    return { error: jsonError("No pudimos validar la sesión.", 500) };
  }
  if (!session) {
    return { error: jsonError("La sesión no existe. Solicita un enlace nuevo por WhatsApp.", 404) };
  }
  if (new Date(session.expira_en as string).getTime() <= Date.now()) {
    return { error: jsonError("La sesión expiró. Solicita un enlace nuevo por WhatsApp.", 409) };
  }
  if (session.estado !== "activa") {
    return { error: jsonError("Esta sesión ya no está activa. Solicita un enlace nuevo por WhatsApp.", 409) };
  }
  return { chatId: String(session.chat_id) };
}

export async function POST(request: NextRequest) {
  let body: RegisterBody;
  try {
    body = (await request.json()) as RegisterBody;
  } catch {
    return jsonError("El cuerpo de la solicitud no es un JSON válido.", 400);
  }

  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
  const apellido = typeof body.apellido === "string" ? body.apellido.trim() : "";
  const direccion = typeof body.direccion === "string" ? body.direccion.trim() : "";
  const etiqueta = isAddressLabel(body.etiqueta) ? body.etiqueta : "Casa";

  if (!sessionId) {
    return jsonError("Falta la sesión.", 400);
  }
  if (nombre.length < 2) {
    return jsonError("Escribe tu nombre.", 400);
  }
  if (apellido.length < 2) {
    return jsonError("Escribe tu apellido.", 400);
  }
  if (direccion.length < 6) {
    return jsonError("Escribe una dirección de entrega más completa.", 400);
  }

  const session = await sessionChatId(sessionId);
  if ("error" in session) {
    return session.error;
  }

  try {
    const existing = await getCustomerForChat(session.chatId);
    if (existing) {
      return Response.json({ success: true, customer: existing });
    }
    const customer = await registerCustomerForChat(session.chatId, {
      nombre,
      apellido,
      direccion,
      etiqueta,
    });
    return Response.json({ success: true, customer });
  } catch (error) {
    console.error("[catalog] no se pudo registrar el cliente", error);
    const message = error instanceof Error ? error.message : "No pudimos guardar tus datos";
    return jsonError(message, 500);
  }
}
