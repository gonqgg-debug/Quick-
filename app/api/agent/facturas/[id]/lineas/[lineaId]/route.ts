import { NextRequest, NextResponse } from "next/server";
import { requireAgentRol } from "@/lib/agent-auth";
import { facturasError, handleAsignarProducto } from "@/lib/facturas-http";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: { id: string; lineaId: string } }) {
  const rol = await requireAgentRol(request, ["phillip"]);
  if (rol instanceof NextResponse) {
    return rol;
  }
  try {
    return await handleAsignarProducto(params.id, params.lineaId, request, rol);
  } catch (error) {
    return facturasError(error, "No pudimos enlazar el producto", "[agent] factura linea");
  }
}
