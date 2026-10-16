import { NextRequest, NextResponse } from "next/server";
import { requireAgentRol } from "@/lib/agent-auth";
import { facturasError, handlePostPreguntas } from "@/lib/facturas-http";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const rol = await requireAgentRol(request, ["phillip", "lectura"]);
  if (rol instanceof NextResponse) {
    return rol;
  }
  try {
    return await handlePostPreguntas(params.id, request, rol);
  } catch (error) {
    return facturasError(error, "No pudimos guardar la pregunta", "[agent] factura preguntas");
  }
}
