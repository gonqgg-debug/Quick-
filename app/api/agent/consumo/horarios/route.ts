import { NextRequest, NextResponse } from "next/server";
import { requireAgentApi } from "@/lib/agent-auth";
import { parseMetrica } from "@/lib/pos-domain";
import { cargarHorarios, periodoDesdeParams } from "@/lib/pos-consumo";
import { respuestaPos } from "@/lib/pos-http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = await requireAgentApi(request);
  if (denied) {
    return denied;
  }
  const params = request.nextUrl.searchParams;
  try {
    const body = await cargarHorarios(periodoDesdeParams(params), (params.get("categoria") ?? "").slice(0, 80));
    return NextResponse.json({ metrica: parseMetrica(params.get("metrica")), ...body });
  } catch (error) {
    return respuestaPos(error, "[agent] consumo horarios");
  }
}
