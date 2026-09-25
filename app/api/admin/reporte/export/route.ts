import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { loadReporteFinanciero } from "@/lib/admin-reporte";
import { REPORTE_EXPORT_HEADERS, reporteExportRows } from "@/lib/admin-reporte-shared";
import { localDayKey } from "@/lib/local-day";
import { buildXlsx } from "@/lib/simple-xlsx";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const reporte = await loadReporteFinanciero(null);
    const buffer = buildXlsx(REPORTE_EXPORT_HEADERS, reporteExportRows(reporte.meses), "Reporte mensual");
    const filename = `reporte-financiero-${localDayKey(new Date().toISOString())}.xlsx`;
    return new NextResponse(Uint8Array.from(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("[admin] no se pudo exportar el reporte", error);
    return NextResponse.json({ error: "No pudimos exportar el reporte" }, { status: 500 });
  }
}
