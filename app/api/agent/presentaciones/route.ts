import { NextRequest, NextResponse } from "next/server";
import { requireAgentRol } from "@/lib/agent-auth";
import { facturasError, handleGuardarPresentacion } from "@/lib/facturas-http";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const rol = requireAgentRol(request, ["phillip"]);
  if (rol instanceof NextResponse) {
    return rol;
  }
  try {
    return await handleGuardarPresentacion(request, rol);
  } catch (error) {
    return facturasError(error, "No pudimos guardar la presentación", "[agent] presentaciones");
  }
}
