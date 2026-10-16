import { NextRequest, NextResponse } from "next/server";
import { requireAgentApi } from "@/lib/agent-auth";
import { buscarSeguro, parseLimit, parseOrden } from "@/lib/pos-domain";
import { cargarProductos, periodoDesdeParams } from "@/lib/pos-consumo";
import { respuestaPos } from "@/lib/pos-http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = requireAgentApi(request);
  if (denied) {
    return denied;
  }
  const params = request.nextUrl.searchParams;
  try {
    const body = await cargarProductos({
      periodo: periodoDesdeParams(params),
      orden: parseOrden(params.get("orden")),
      categoria: (params.get("categoria") ?? "").slice(0, 80),
      q: buscarSeguro(params.get("q")),
      cursor: params.get("cursor"),
      limit: parseLimit(params.get("limit")),
    });
    return NextResponse.json(body);
  } catch (error) {
    return respuestaPos(error, "[agent] consumo top");
  }
}
