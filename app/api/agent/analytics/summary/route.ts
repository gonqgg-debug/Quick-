import { NextRequest, NextResponse } from "next/server";
import { exigirMiles, respuestaMiles, sobre } from "@/lib/miles-http";
import { cargarResumen, periodoDesdeParams } from "@/lib/pos-consumo";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rol = await exigirMiles(request, ["miles", "lectura"]);
  if (rol instanceof NextResponse) return rol;
  try {
    const periodo = periodoDesdeParams(request.nextUrl.searchParams);
    const data = await cargarResumen(periodo);
    return NextResponse.json(
      sobre(
        { desde: periodo.desde, hasta: periodo.hasta, comparacion: periodo.comparacion },
        {
          periodos: {
            principal: { desde: periodo.desde, hasta: periodo.hasta },
            tramo: periodo.tramo,
            comparado: periodo.comparar ? periodo.anterior : null,
            algoritmo: periodo.algoritmo,
            estado: data.comparacionEstado,
          },
          cobertura: {
            costo: data.kpis.cobertura,
            ventaConCosto: data.kpis.ventaConCosto,
            ventaNetaConCosto: data.kpis.ventaNetaConCosto,
            metodoCosto: data.kpis.metodoCosto,
            ultimaCaja: data.frescura.ultimaFecha,
          },
          corte: data.frescura.ultimaFecha,
          datos: {
            kpis: data.kpis,
            comparado: data.anterior,
            tramoComparado: data.kpisComparados,
            mix: data.mix,
            dias: data.dias,
            tendencias: data.tendencias,
          },
        },
      ),
    );
  } catch (error) {
    return respuestaMiles(error);
  }
}
