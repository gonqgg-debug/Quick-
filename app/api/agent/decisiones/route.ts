import { NextRequest, NextResponse } from "next/server";
import { requireAgentApi, requireAgentRol } from "@/lib/agent-auth";
import { handleAbrirDecision, handleListarDecisiones, operacionError } from "@/lib/operacion-http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = await requireAgentApi(request);
  if (denied) {
    return denied;
  }
  try {
    return await handleListarDecisiones();
  } catch (error) {
    return operacionError(error, "No pudimos leer las decisiones", "[agent] decisiones");
  }
}

export async function POST(request: NextRequest) {
  const rol = await requireAgentRol(request, ["rodrigo", "phillip", "boris", "fred", "hans", "matt", "troy", "robert"]);
  if (rol instanceof NextResponse) {
    return rol;
  }
  try {
    return await handleAbrirDecision(request, rol);
  } catch (error) {
    return operacionError(error, "No pudimos abrir la decisión", "[agent] decisiones");
  }
}
