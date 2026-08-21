import { NextRequest, NextResponse } from "next/server";
import { getActiveOrderSession } from "@/lib/catalog";
import { listCustomerOrdersForSession } from "@/lib/customer-orders";
import { jsonError } from "@/lib/order-request";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId")?.trim() ?? "";
  if (!sessionId) {
    return jsonError("Falta la sesión.", 400);
  }

  const session = await getActiveOrderSession(sessionId);
  if (!session) {
    return jsonError("La sesión no está activa. Solicita un enlace nuevo por WhatsApp.", 409);
  }

  try {
    const orders = await listCustomerOrdersForSession(session.chat_id);
    return NextResponse.json({ orders });
  } catch (error) {
    console.error("[orders] no se pudieron leer los pedidos del cliente", error);
    return jsonError("No pudimos cargar tus pedidos.", 500);
  }
}
