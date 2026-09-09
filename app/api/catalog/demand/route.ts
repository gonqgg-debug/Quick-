import { NextRequest, NextResponse } from "next/server";
import { getActiveOrderSession } from "@/lib/catalog";
import { getKitchenDemand } from "@/lib/kitchen-demand";
import { jsonError } from "@/lib/order-request";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId")?.trim() ?? "";
  if (!sessionId) {
    return jsonError("Falta la sesión.", 400);
  }

  const session = await getActiveOrderSession(sessionId);
  if (!session) {
    return jsonError("La sesión no es válida. Solicita un enlace nuevo por WhatsApp.", 401);
  }

  try {
    const demand = await getKitchenDemand();
    return NextResponse.json(demand);
  } catch (error) {
    console.error("[catalog] no se pudo leer la demanda", error);
    return jsonError("No pudimos consultar la demanda.", 500);
  }
}
