import { NextRequest, NextResponse } from "next/server";
import { requireAgentRol } from "@/lib/agent-auth";
import { handleQuitarPago, operacionError } from "@/lib/operacion-http";

export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest, { params }: { params: { id: string; pagoId: string } }) {
  const rol = requireAgentRol(request, ["fred"]);
  if (rol instanceof NextResponse) {
    return rol;
  }
  try {
    return await handleQuitarPago(params.id, params.pagoId, rol);
  } catch (error) {
    return operacionError(error, "No pudimos quitar el pago", "[agent] pagos");
  }
}
