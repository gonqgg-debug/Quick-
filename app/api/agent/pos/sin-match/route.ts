import { NextRequest, NextResponse } from "next/server";
import { requireAgentApi } from "@/lib/agent-auth";
import { parseLimit } from "@/lib/pos-domain";
import { cargarSinMatch, periodoDesdeParams } from "@/lib/pos-consumo";
import { respuestaPos } from "@/lib/pos-http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = await requireAgentApi(request);
  if (denied) {
    return denied;
  }
  try {
    const body = await cargarSinMatch(
      periodoDesdeParams(request.nextUrl.searchParams),
      request.nextUrl.searchParams.get("cursor"),
      parseLimit(request.nextUrl.searchParams.get("limit")),
    );
    return NextResponse.json(body);
  } catch (error) {
    return respuestaPos(error, "[agent] pos sin-match");
  }
}
