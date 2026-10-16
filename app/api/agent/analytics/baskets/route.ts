import { NextRequest, NextResponse } from "next/server";
import { asociacionCanasta, DEFINICIONES_CONSUMO } from "@/lib/consumo-metricas";
import { exigirMiles, respuestaMiles, sobre } from "@/lib/miles-http";
import { cargarAsociacion, cargarCanasta, periodoDesdeParams } from "@/lib/pos-consumo";
import { lunesDe, parseLimit } from "@/lib/pos-domain";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rol = await exigirMiles(request, ["miles", "lectura"]);
  if (rol instanceof NextResponse) return rol;
  const params = request.nextUrl.searchParams;
  try {
    const a = (params.get("a") ?? "").trim();
    const b = (params.get("b") ?? "").trim();
    if (a && b) {
      if (a === b) {
        return NextResponse.json({ error: "Los dos productos tienen que ser distintos" }, { status: 400 });
      }
      const periodo = periodoDesdeParams(params);
      const cuentas = await cargarAsociacion(periodo, a, b);
      const asociacion = asociacionCanasta(cuentas);
      return NextResponse.json(
        sobre(
          { desde: periodo.desde, hasta: periodo.hasta, a, b },
          {
            periodos: { principal: { desde: periodo.desde, hasta: periodo.hasta } },
            cobertura: { regla: DEFINICIONES_CONSUMO.canasta },
            datos: { ...cuentas, ...asociacion },
          },
        ),
      );
    }
    const semana = params.get("semana") && params.get("semana")!.length === 10 ? lunesDe(params.get("semana")!) : lunesDe(periodoDesdeParams(params).hasta);
    const lista = await cargarCanasta(semana, params.get("cursor"), parseLimit(params.get("limit")));
    return NextResponse.json(
      sobre(
        { semana },
        {
          periodos: { semana },
          cobertura: { regla: "Pares con al menos 5 órdenes. lift es la fuerza frente a la popularidad de esa semana." },
          datos: lista,
        },
      ),
    );
  } catch (error) {
    return respuestaMiles(error);
  }
}
