import { NextRequest, NextResponse } from "next/server";
import { requireAgentApi } from "@/lib/agent-auth";
import { parseDias, parseLimit } from "@/lib/pos-domain";
import { cargarSinMovimiento, rangoDeDias } from "@/lib/pos-consumo";
import { respuestaPos } from "@/lib/pos-http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = await requireAgentApi(request);
  if (denied) {
    return denied;
  }
  const dias = parseDias(request.nextUrl.searchParams.get("dias"), [14, 30, 60], 30);
  const rango = rangoDeDias(dias);
  try {
    const body = await cargarSinMovimiento(rango.desde, rango.hasta, request.nextUrl.searchParams.get("cursor"), parseLimit(request.nextUrl.searchParams.get("limit")));
    return NextResponse.json({ ...body, dias, ...rango });
  } catch (error) {
    return respuestaPos(error, "[agent] consumo sin-movimiento");
  }
}
