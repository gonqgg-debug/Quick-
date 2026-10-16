import { NextRequest, NextResponse } from "next/server";
import { coberturaDeFechas, fechasEsperadas } from "@/lib/consumo-metricas";
import { exigirMiles, respuestaMiles, sobre } from "@/lib/miles-http";
import { cargarFrescura, cargarResumen, periodoDesdeParams } from "@/lib/pos-consumo";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rol = await exigirMiles(request, ["miles", "lectura"]);
  if (rol instanceof NextResponse) return rol;
  try {
    const periodo = periodoDesdeParams(request.nextUrl.searchParams);
    const [resumen, frescura] = await Promise.all([cargarResumen(periodo), cargarFrescura()]);
    const presentes = resumen.dias.map((dia) => dia.fecha);
    const cobertura = coberturaDeFechas(presentes, periodo.desde, periodo.hasta);
    return NextResponse.json(
      sobre(
        { desde: periodo.desde, hasta: periodo.hasta },
        {
          periodos: { principal: { desde: periodo.desde, hasta: periodo.hasta } },
          cobertura: {
            diasConResumen: cobertura.dias,
            diasEsperados: cobertura.esperados,
            completa: cobertura.completa,
            fechasSinFila: fechasEsperadas(periodo.desde, periodo.hasta).filter((fecha) => !presentes.includes(fecha)),
            costo: resumen.kpis.cobertura,
            sinMatchProductos: resumen.calidad.sinMatchProductos,
            sinCostoProductos: resumen.calidad.sinCostoProductos,
            sesionesDescuadradas: resumen.calidad.descuadradas,
            partesAbiertas: frescura.partesAbiertas,
            faltaAyer: frescura.faltaAyer,
          },
          corte: frescura.ultimaFecha,
          datos: { calidad: resumen.calidad, frescura },
        },
      ),
    );
  } catch (error) {
    return respuestaMiles(error);
  }
}
