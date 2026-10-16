import { NextRequest, NextResponse } from "next/server";
import { requireAgentApi } from "@/lib/agent-auth";
import { listarPartesAbiertas } from "@/lib/pos-ingesta";
import { respuestaPos } from "@/lib/pos-http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = await requireAgentApi(request);
  if (denied) {
    return denied;
  }
  try {
    return NextResponse.json(await listarPartesAbiertas());
  } catch (error) {
    return respuestaPos(error, "[agent] pos partes");
  }
}
