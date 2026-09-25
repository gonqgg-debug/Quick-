import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { loadReporteContable } from "@/lib/admin-reporte-contable";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const reporte = await loadReporteContable(request.nextUrl.searchParams.get("mes"));
    return NextResponse.json(reporte);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos armar el detalle contable";
    console.error("[admin] reporte contable", error);
    const status = message.includes("no es válido") ? 400 : 500;
    return NextResponse.json({ error: message || "No pudimos armar el detalle contable" }, { status });
  }
}
