import { NextRequest, NextResponse } from "next/server";
import { requireAgentRol } from "@/lib/agent-auth";
import { handleMarca, operacionError } from "@/lib/operacion-http";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const rol = await requireAgentRol(request, ["rodrigo"]);
  if (rol instanceof NextResponse) {
    return rol;
  }
  try {
    return await handleMarca(params.id, request, rol);
  } catch (error) {
    return operacionError(error, "No pudimos marcar la compra", "[agent] marca");
  }
}
