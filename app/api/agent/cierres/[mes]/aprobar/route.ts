import { NextRequest, NextResponse } from "next/server";
import { requireAgentRol } from "@/lib/agent-auth";
import { handleAprobar, operacionError } from "@/lib/operacion-http";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { mes: string } }) {
  const rol = await requireAgentRol(request, ["troy"]);
  if (rol instanceof NextResponse) {
    return rol;
  }
  try {
    return await handleAprobar(params.mes, request, rol);
  } catch (error) {
    return operacionError(error, "No pudimos guardar el cierre", "[agent] aprobar");
  }
}
