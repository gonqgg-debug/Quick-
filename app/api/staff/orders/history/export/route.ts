import { NextRequest, NextResponse } from "next/server";
import { localDayKey } from "@/lib/local-day";
import { buildXlsx } from "@/lib/simple-xlsx";
import {
  HISTORY_EXPORT_MAX_ROWS,
  fetchHistoryForExport,
  historyExportRows,
  parseHistoryFilters,
} from "@/lib/staff-history";
import { isStaffAuthorized, unauthorized } from "@/lib/staff-auth";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const HEADERS = [
  "Fecha/Hora",
  "# Orden",
  "Cliente",
  "Teléfono",
  "Dirección",
  "# Ítems",
  "Total",
  "Estado",
  "Tiempo que tardó",
];

export async function GET(request: NextRequest) {
  if (!isStaffAuthorized()) {
    return unauthorized();
  }

  const filters = parseHistoryFilters(request.nextUrl.searchParams);

  try {
    const supabase = getSupabaseAdminClient();
    const orders = await fetchHistoryForExport(supabase, filters);

    if (orders.length >= HISTORY_EXPORT_MAX_ROWS) {
      return NextResponse.json(
        { error: "Demasiados pedidos para exportar. Acota fechas o filtros." },
        { status: 400 }
      );
    }

    const buffer = buildXlsx(HEADERS, historyExportRows(orders));
    const filename = `historial-pedidos-${localDayKey(new Date().toISOString())}.xlsx`;

    return new NextResponse(Uint8Array.from(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("[staff] no se pudo exportar el historial", error);
    return NextResponse.json({ error: "No pudimos exportar el historial" }, { status: 500 });
  }
}
