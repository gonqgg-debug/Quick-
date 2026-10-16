import { NextRequest, NextResponse } from "next/server";
import { requireAgentRol } from "@/lib/agent-auth";
import { handleConfirmacion, operacionError } from "@/lib/operacion-http";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const rol = await requireAgentRol(request, ["rodrigo"]);
  if (rol instanceof NextResponse) {
    return rol;
  }
  try {
    return await handleConfirmacion(params.id, request, rol);
  } catch (error) {
    return operacionError(error, "No pudimos guardar la respuesta de la tienda", "[agent] confirmacion");
  }
}
