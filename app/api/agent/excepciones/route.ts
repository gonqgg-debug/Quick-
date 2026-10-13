import { NextRequest, NextResponse } from "next/server";
import { requireAgentApi, requireAgentRol } from "@/lib/agent-auth";
import { handleAbrirExcepcion, handleListarExcepciones, operacionError } from "@/lib/operacion-http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = requireAgentApi(request);
  if (denied) {
    return denied;
  }
  try {
    return await handleListarExcepciones(request);
  } catch (error) {
    return operacionError(error, "No pudimos leer las excepciones", "[agent] excepciones");
  }
}

export async function POST(request: NextRequest) {
  const rol = requireAgentRol(request, ["boris", "hans", "fred", "matt"]);
  if (rol instanceof NextResponse) {
    return rol;
  }
  try {
    return await handleAbrirExcepcion(request, rol);
  } catch (error) {
    return operacionError(error, "No pudimos abrir la excepción", "[agent] excepciones");
  }
}
