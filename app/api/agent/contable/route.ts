import { NextRequest, NextResponse } from "next/server";
import { requireAgentApi } from "@/lib/agent-auth";
import { loadReporteContable } from "@/lib/admin-reporte-contable";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const denied = requireAgentApi(request);
  if (denied) {
    return denied;
  }
  try {
    const reporte = await loadReporteContable(request.nextUrl.searchParams.get("mes"));
    return NextResponse.json(reporte);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos armar el detalle contable";
    console.error("[agent] contable", error);
    const status = message.includes("no es válido") ? 400 : 500;
    return NextResponse.json({ error: message || "No pudimos armar el detalle contable" }, { status });
  }
}
