import { NextRequest, NextResponse } from "next/server";
import { requireAgentRol } from "@/lib/agent-auth";
import { facturasError, handlePostValidaciones } from "@/lib/facturas-http";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const rol = requireAgentRol(request, ["phillip", "lectura"]);
  if (rol instanceof NextResponse) {
    return rol;
  }
  try {
    return await handlePostValidaciones(params.id, request, rol);
  } catch (error) {
    return facturasError(error, "No pudimos guardar las validaciones", "[agent] factura validaciones");
  }
}
