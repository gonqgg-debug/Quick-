import { NextRequest, NextResponse } from "next/server";
import { requireAgentApi, requireAgentRol } from "@/lib/agent-auth";
import { facturasError, handleGuardarPresentacion, handleListarPresentaciones } from "@/lib/facturas-http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = requireAgentApi(request);
  if (denied) {
    return denied;
  }
  try {
    return await handleListarPresentaciones(request);
  } catch (error) {
    return facturasError(error, "No pudimos leer las equivalencias", "[agent] presentaciones");
  }
}

export async function POST(request: NextRequest) {
  const rol = requireAgentRol(request, ["phillip", "rodrigo"]);
  if (rol instanceof NextResponse) {
    return rol;
  }
  try {
    return await handleGuardarPresentacion(request, rol);
  } catch (error) {
    return facturasError(error, "No pudimos guardar la presentación", "[agent] presentaciones");
  }
}
