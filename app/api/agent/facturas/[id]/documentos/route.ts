import { NextRequest, NextResponse } from "next/server";
import { requireAgentRol } from "@/lib/agent-auth";
import { facturasError, handlePostDocumentos } from "@/lib/facturas-http";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const rol = requireAgentRol(request, ["rodrigo", "phillip", "lectura"]);
  if (rol instanceof NextResponse) {
    return rol;
  }
  try {
    return await handlePostDocumentos(params.id, request, rol);
  } catch (error) {
    return facturasError(error, "No pudimos guardar la foto", "[agent] factura documentos");
  }
}
