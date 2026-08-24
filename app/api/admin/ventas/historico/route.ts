import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { parseHistoricoMesParam } from "@/lib/admin-ventas-historico-shared";
import { loadVentasHistoricoDetalle, loadVentasHistoricoResumen } from "@/lib/admin-ventas-historico";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const mesRaw = request.nextUrl.searchParams.get("mes");
  const mesRequested = mesRaw != null && mesRaw.trim() !== "";
  const mes = parseHistoricoMesParam(mesRaw);

  try {
    if (mesRequested) {
      if (!mes) {
        return NextResponse.json({ error: "El mes no es válido" }, { status: 400 });
      }
      const detalle = await loadVentasHistoricoDetalle(mes);
      return NextResponse.json(detalle);
    }
    const resumen = await loadVentasHistoricoResumen();
    return NextResponse.json(resumen);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos cargar el histórico de ventas";
    console.error("[admin] ventas historico", error);
    const status = message.includes("no es válido") ? 400 : 500;
    return NextResponse.json({ error: message || "No pudimos cargar el histórico de ventas" }, { status });
  }
}
