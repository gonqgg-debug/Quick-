import { NextRequest, NextResponse } from "next/server";
import { requireAgentApi } from "@/lib/agent-auth";
import { cargarTicket, periodoDesdeParams } from "@/lib/pos-consumo";
import { respuestaPos } from "@/lib/pos-http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = await requireAgentApi(request);
  if (denied) {
    return denied;
  }
  try {
    const body = await cargarTicket(periodoDesdeParams(request.nextUrl.searchParams));
    return NextResponse.json(body);
  } catch (error) {
    return respuestaPos(error, "[agent] consumo ticket");
  }
}
