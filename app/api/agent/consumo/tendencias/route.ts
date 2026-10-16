import { NextRequest, NextResponse } from "next/server";
import { requireAgentApi } from "@/lib/agent-auth";
import { isDayKey, todayDayKey } from "@/lib/local-day";
import { cargarTendencias } from "@/lib/pos-consumo";
import { respuestaPos } from "@/lib/pos-http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = requireAgentApi(request);
  if (denied) {
    return denied;
  }
  const raw = request.nextUrl.searchParams.get("hasta");
  const hasta = raw && isDayKey(raw) ? raw : todayDayKey();
  try {
    const body = await cargarTendencias(hasta);
    return NextResponse.json(body);
  } catch (error) {
    return respuestaPos(error, "[agent] consumo tendencias");
  }
}