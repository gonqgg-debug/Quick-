import { NextRequest, NextResponse } from "next/server";
import { requireAgentRol } from "@/lib/agent-auth";
import { handleConciliacion, operacionError } from "@/lib/operacion-http";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const rol = requireAgentRol(request, ["fred"]);
  if (rol instanceof NextResponse) {
    return rol;
  }
  try {
    return await handleConciliacion(params.id, request, rol);
  } catch (error) {
    return operacionError(error, "No pudimos guardar la conciliación", "[agent] conciliacion");
  }
}
