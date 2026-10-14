import { NextRequest, NextResponse } from "next/server";
import { requireAgentRol } from "@/lib/agent-auth";
import { facturasError, handleCandidatos } from "@/lib/facturas-http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const rol = requireAgentRol(request, ["phillip"]);
  if (rol instanceof NextResponse) {
    return rol;
  }
  try {
    return await handleCandidatos(params.id, request);
  } catch (error) {
    return facturasError(error, "No pudimos buscar los candidatos", "[agent] candidatos");
  }
}
