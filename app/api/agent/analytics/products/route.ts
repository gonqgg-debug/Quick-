import { NextRequest, NextResponse } from "next/server";
import { participacion } from "@/lib/consumo-metricas";
import { exigirMiles, respuestaMiles, sobre } from "@/lib/miles-http";
import { buscarSeguro, parseLimit, parseOrden } from "@/lib/pos-domain";
import { cargarProductos, periodoDesdeParams } from "@/lib/pos-consumo";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rol = await exigirMiles(request, ["miles", "lectura"]);
  if (rol instanceof NextResponse) return rol;
  const params = request.nextUrl.searchParams;
  try {
    const periodo = periodoDesdeParams(params);
    const lista = await cargarProductos({
      periodo,
      orden: parseOrden(params.get("orden")),
      categoria: (params.get("categoria") ?? "").slice(0, 80),
      q: buscarSeguro(params.get("q")),
      cursor: params.get("cursor"),
      limit: parseLimit(params.get("limit")),
    });
    return NextResponse.json(
      sobre(
        { desde: periodo.desde, hasta: periodo.hasta, categoria: params.get("categoria"), q: params.get("q") },
        {
          periodos: { principal: { desde: periodo.desde, hasta: periodo.hasta }, comparado: periodo.comparar ? periodo.anterior : null },
          cobertura: { ventaPeriodo: lista.ventaPeriodo, ventaAlcance: lista.ventaAlcance, base: "venta con ITBIS del periodo" },
          datos: {
            ...lista,
            rows: lista.rows.map((row) => ({
              ...row,
              participacionPeriodo: participacion(row.venta, lista.ventaPeriodo),
              participacionFiltro: participacion(row.venta, lista.ventaAlcance),
            })),
          },
        },
      ),
    );
  } catch (error) {
    return respuestaMiles(error);
  }
}
