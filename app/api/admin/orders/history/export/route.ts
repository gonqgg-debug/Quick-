import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { localDayKey } from "@/lib/local-day";
import { buildXlsx } from "@/lib/simple-xlsx";
import {
  HISTORY_EXPORT_MAX_ROWS,
  fetchHistoryForExport,
  historyExportRows,
  parseHistoryFilters,
} from "@/lib/staff-history";
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
  "Calificación",
  "Requiere atención",
  "Comentario",
];

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
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

    const buffer = buildXlsx(HEADERS, historyExportRows(orders), "Historial de Delivery");
    const filename = `historial-pedidos-${localDayKey(new Date().toISOString())}.xlsx`;

    return new NextResponse(Uint8Array.from(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("[admin] no se pudo exportar el historial", error);
    return NextResponse.json({ error: "No pudimos exportar el historial" }, { status: 500 });
  }
}
