import { NextRequest, NextResponse } from "next/server";
import { requireAgentRol } from "@/lib/agent-auth";
import { handleAbrirVersion, operacionError } from "@/lib/operacion-http";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { mes: string } }) {
  const rol = requireAgentRol(request, ["hans", "fred", "robert", "troy"]);
  if (rol instanceof NextResponse) {
    return rol;
  }
  try {
    return await handleAbrirVersion(params.mes);
  } catch (error) {
    return operacionError(error, "No pudimos abrir la versión", "[agent] cierre version");
  }
}
