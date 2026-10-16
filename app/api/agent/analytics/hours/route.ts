import { NextRequest, NextResponse } from "next/server";
import { exigirMiles, respuestaMiles, sobre } from "@/lib/miles-http";
import { cargarHorarios, periodoDesdeParams } from "@/lib/pos-consumo";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rol = await exigirMiles(request, ["miles", "lectura"]);
  if (rol instanceof NextResponse) return rol;
  const params = request.nextUrl.searchParams;
  try {
    const periodo = periodoDesdeParams(params);
    const reloj = params.get("reloj") === "caja" ? "caja" : "real";
    const data = await cargarHorarios(periodo, (params.get("categoria") ?? "").slice(0, 80), reloj);
    return NextResponse.json(
      sobre(
        { desde: periodo.desde, hasta: periodo.hasta, reloj, categoria: params.get("categoria") },
        {
          periodos: { principal: { desde: periodo.desde, hasta: periodo.hasta } },
          cobertura: {
            nota: "ocurrencias cuenta días con sesión cerrada en esa hora, incluidos los de cero ventas. No hay fuente de tienda cerrada.",
          },
          datos: data,
        },
      ),
    );
  } catch (error) {
    return respuestaMiles(error);
  }
}
