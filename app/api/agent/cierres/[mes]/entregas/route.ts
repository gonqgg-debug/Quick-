import { NextRequest, NextResponse } from "next/server";
import { requireAgentRol } from "@/lib/agent-auth";
import { handleEntrega, operacionError } from "@/lib/operacion-http";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { mes: string } }) {
  const rol = requireAgentRol(request, ["hans", "fred", "robert"]);
  if (rol instanceof NextResponse) {
    return rol;
  }
  try {
    return await handleEntrega(params.mes, request, rol);
  } catch (error) {
    return operacionError(error, "No pudimos guardar la entrega", "[agent] entrega");
  }
}
