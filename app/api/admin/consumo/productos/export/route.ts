import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { csvProductos, parseSinCosto } from "@/lib/productos-analitica";
import { CONSUMO_PAGE_MAX, buscarSeguro, parseOrden } from "@/lib/pos-domain";
import { cargarProductos, periodoDesdeParams } from "@/lib/pos-consumo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }
  const params = request.nextUrl.searchParams;
  const periodo = periodoDesdeParams(params);
  const ordenRaw = parseOrden(params.get("orden"));
  const orden = !periodo.comparar && (ordenRaw === "variacion" || ordenRaw === "variacion_asc") ? "venta" : ordenRaw;
  const categoria = (params.get("categoria") ?? "").slice(0, 80);
  const q = buscarSeguro(params.get("q"));
  const sinCosto = parseSinCosto(params.get("sin_costo"));
  try {
    const filas = [];
    let denominador = 0;
    for (let offset = 0; offset < 20000; offset += CONSUMO_PAGE_MAX) {
      const pagina = await cargarProductos({
        periodo,
        orden,
        categoria,
        q,
        cursor: null,
        limit: CONSUMO_PAGE_MAX,
        offset,
        sinCosto,
        conTotales: offset === 0,
      });
      if (offset === 0) {
        denominador = pagina.totales.venta;
        if (pagina.totales.productos === 0) {
          return NextResponse.json({ error: "No hay productos para exportar" }, { status: 400 });
        }
      }
      filas.push(...pagina.rows);
      if (pagina.rows.length < CONSUMO_PAGE_MAX) {
        break;
      }
    }
    const csv = csvProductos(filas, denominador, periodo.comparar);
    const filename = `ventas-por-producto-${periodo.desde}-${periodo.hasta}.csv`;
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("[admin] ventas por producto export", error);
    const message = error instanceof Error ? error.message : "No pudimos exportar";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
