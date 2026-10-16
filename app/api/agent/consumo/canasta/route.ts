import { NextRequest, NextResponse } from "next/server";
import { requireAgentApi } from "@/lib/agent-auth";
import { isDayKey, todayDayKey } from "@/lib/local-day";
import { lunesDe, parseLimit } from "@/lib/pos-domain";
import { cargarCanasta } from "@/lib/pos-consumo";
import { respuestaPos } from "@/lib/pos-http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = requireAgentApi(request);
  if (denied) {
    return denied;
  }
  const raw = request.nextUrl.searchParams.get("semana");
  const semana = lunesDe(raw && isDayKey(raw) ? raw : todayDayKey());
  try {
    const body = await cargarCanasta(semana, request.nextUrl.searchParams.get("cursor"), parseLimit(request.nextUrl.searchParams.get("limit")));
    return NextResponse.json(body);
  } catch (error) {
    return respuestaPos(error, "[agent] consumo canasta");
  }
}
