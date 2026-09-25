import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { loadReporteFinanciero } from "@/lib/admin-reporte";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const reporte = await loadReporteFinanciero(request.nextUrl.searchParams.get("mes"));
    return NextResponse.json(reporte);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos armar el reporte";
    console.error("[admin] reporte mensual", error);
    const status = message.includes("no es válido") ? 400 : 500;
    return NextResponse.json({ error: message || "No pudimos armar el reporte" }, { status });
  }
}
