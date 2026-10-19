import { NextRequest, NextResponse } from "next/server";
import { afirmarPeriodoCanasta, leerMinJuntos } from "@/lib/canasta-periodo";
import { asociacionCanasta, DEFINICIONES_CONSUMO } from "@/lib/consumo-metricas";
import { metricaAsociacion } from "@/lib/miles-casos";
import { exigirMiles, respuestaMiles, sobre } from "@/lib/miles-http";
import { cargarAsociacion, cargarCanasta, cargarCanastaPeriodo, periodoDesdeParams } from "@/lib/pos-consumo";
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
    const semanaSuelta = params.get("semana");
    const periodoExplicito = params.get("desde") || params.get("hasta") || params.get("preset");
    if (semanaSuelta && semanaSuelta.length === 10 && !periodoExplicito) {
      const semana = lunesDe(semanaSuelta);
      const lista = await cargarCanasta(semana, params.get("cursor"), parseLimit(params.get("limit")));
      return NextResponse.json(
        sobre(
          { semana },
          {
            periodos: { semana },
            cobertura: {
              regla: "Esta respuesta es solo la semana pedida, con pares de al menos 5 tickets en esa semana, ordenados por afinidad. Para ver todos los pares de un periodo usa desde y hasta, sin elegir productos.",
            },
            datos: lista,
          },
        ),
      );
    }
    const periodo = periodoExplicito
      ? periodoDesdeParams(params)
      : periodoDesdeParams({ get: (name) => (name === "preset" ? "30c" : null) });
    afirmarPeriodoCanasta(periodo.desde, periodo.hasta);
    const minJuntos = leerMinJuntos(params.get("min"));
    const categoria = (params.get("categoria") ?? "").trim();
    const lista = await cargarCanastaPeriodo({
      desde: periodo.desde,
      hasta: periodo.hasta,
      minJuntos,
      limit: parseLimit(params.get("limit")),
      cursor: params.get("cursor"),
      categoria: categoria || null,
    });
    const rows = lista.rows.map((row) => {
      const metrica = metricaAsociacion({ elegibles: row.n, conA: row.nA, conB: row.nB, conAmbos: row.nAB });
      return { ...row, ...(metrica.metrica ?? {}), error: metrica.error };
    });
    return NextResponse.json(
      sobre(
        { desde: periodo.desde, hasta: periodo.hasta, min: minJuntos, categoria: categoria || null },
        {
          periodos: { principal: { desde: periodo.desde, hasta: periodo.hasta } },
          cobertura: {
            regla: "Cada fila es un par real del periodo, con presencia deduplicada por ticket. No hace falta elegir candidatos ni categorías. pares es el total que llega al mínimo; una página no es el universo. Sigue nextCursor hasta null. Lo que no aparece quedó bajo min, no es que no se compre junto. categoria, si viene, esconde el resto. La afinidad no es probabilidad de venta.",
          },
          datos: { ...lista, rows },
        },
      ),
    );
  } catch (error) {
    return respuestaMiles(error);
  }
}
