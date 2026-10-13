import { NextRequest, NextResponse } from "next/server";
import { requireAgentRol } from "@/lib/agent-auth";
import { handleResolverExcepcion, operacionError } from "@/lib/operacion-http";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const rol = requireAgentRol(request, ["matt"]);
  if (rol instanceof NextResponse) {
    return rol;
  }
  try {
    return await handleResolverExcepcion(params.id, request, rol);
  } catch (error) {
    return operacionError(error, "No pudimos cerrar la excepción", "[agent] excepcion");
  }
}
