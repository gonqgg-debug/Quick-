import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { loadReporteContable } from "@/lib/admin-reporte-contable";
import { parseReporteMesParam } from "@/lib/admin-reporte-shared";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const reporte = await loadReporteContable(request.nextUrl.searchParams.get("mes"));
    const mes = parseReporteMesParam(reporte.mes) ?? "mes";
    const filename = `reporte-contable-${mes}.json`;
    return new NextResponse(JSON.stringify(reporte, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("[admin] no se pudo exportar el detalle contable", error);
    return NextResponse.json({ error: "No pudimos exportar el detalle contable" }, { status: 500 });
  }
}
