import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { MilesError } from "@/lib/miles-domain";
import { respuestaMiles } from "@/lib/miles-http";
import { crearPrueba } from "@/lib/miles-store";
import { isDayKey } from "@/lib/local-day";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const admin = await requireAdminApi();
  if (admin instanceof NextResponse) return admin;
  try {
    const body = await request.json();
    const hipotesis = typeof body.hipotesis === "string" ? body.hipotesis.trim() : "";
    const accion = typeof body.accion === "string" ? body.accion.trim() : "";
    const metrica = typeof body.metricaPrincipal === "string" ? body.metricaPrincipal.trim() : "";
    if (!hipotesis || !accion || !metrica) throw new MilesError(400, "Hipótesis, acción y métrica son obligatorias");
    for (const campo of ["inicioPrevisto", "finPrevisto"] as const) {
      if (body[campo] != null && body[campo] !== "" && (typeof body[campo] !== "string" || !isDayKey(body[campo]))) {
        throw new MilesError(400, `${campo} tiene que ser una fecha`);
      }
    }
    const row = await crearPrueba(
      {
        hallazgo_id: typeof body.hallazgoId === "string" ? body.hallazgoId : null,
        hipotesis,
        accion,
        tienda: "quick",
        productos: Array.isArray(body.productos) ? body.productos.slice(0, 30) : [],
        responsable: typeof body.responsable === "string" ? body.responsable.slice(0, 80) : null,
        inicio_previsto: body.inicioPrevisto || null,
        fin_previsto: body.finPrevisto || null,
        presupuesto: typeof body.presupuesto === "number" ? body.presupuesto : null,
        metrica_principal: metrica,
        metricas_control: Array.isArray(body.metricasControl) ? body.metricasControl : [],
        linea_base: body.lineaBase && typeof body.lineaBase === "object" ? body.lineaBase : {},
        resultado_esperado: typeof body.resultadoEsperado === "string" ? body.resultadoEsperado.slice(0, 500) : null,
        limitaciones: typeof body.limitaciones === "string" ? body.limitaciones.slice(0, 1000) : null,
      },
      admin.email ?? "admin",
    );
    return NextResponse.json({ id: row.id, estado: row.estado, aviso: "Quedó como propuesta. Aprobarla no cambia precios ni pedidos." }, { status: 201 });
  } catch (error) {
    return respuestaMiles(error);
  }
}
