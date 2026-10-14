import { NextRequest, NextResponse } from "next/server";
import { requireAgentRol } from "@/lib/agent-auth";
import { facturasError, handleProponerLineas } from "@/lib/facturas-http";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const rol = requireAgentRol(request, ["phillip"]);
  if (rol instanceof NextResponse) {
    return rol;
  }
  try {
    return await handleProponerLineas(params.id, request, rol);
  } catch (error) {
    return facturasError(error, "No pudimos guardar las propuestas", "[agent] propuestas");
  }
}
