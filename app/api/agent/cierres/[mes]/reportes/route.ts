import { NextRequest, NextResponse } from "next/server";
import { requireAgentRol } from "@/lib/agent-auth";
import { handleReporteCierre, operacionError } from "@/lib/operacion-http";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { mes: string } }) {
  const rol = requireAgentRol(request, ["robert"]);
  if (rol instanceof NextResponse) {
    return rol;
  }
  try {
    return await handleReporteCierre(params.mes, request, rol);
  } catch (error) {
    return operacionError(error, "No pudimos guardar el estado", "[agent] reporte cierre");
  }
}
