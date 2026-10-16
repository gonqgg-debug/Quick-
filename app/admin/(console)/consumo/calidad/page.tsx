import { ConsumoCalidadVista } from "@/components/admin/consumo/ConsumoCalidadVista";
import { ErrorPanel } from "@/components/admin/consumo/ui";
import { parseDias } from "@/lib/pos-domain";
import {
  cargarConciliacion,
  cargarSinCosto,
  cargarSinMatch,
  cargarSinMovimiento,
  paramsDe,
  periodoDesdeParams,
  rangoDeDias,
} from "@/lib/pos-consumo";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Calidad | Consumo",
};

export default async function ConsumoCalidadPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const params = paramsDe(searchParams);
  const cola = params.get("cola") ?? "match";
  const dias = parseDias(params.get("dias"), cola === "movimiento" ? [14, 30, 60] : [7, 30, 60], 30);
  const periodo = periodoDesdeParams(params);
  const rango = rangoDeDias(dias);
  const cursor = params.get("cursor");
  try {
    const [match, costo, movimiento, cuadre] = await Promise.all([
      cola === "match" ? cargarSinMatch(periodo, cursor) : Promise.resolve({ rows: [], nextCursor: null }),
      cola === "costo" ? cargarSinCosto(rango.desde, rango.hasta, cursor) : Promise.resolve({ rows: [], nextCursor: null }),
      cola === "movimiento" ? cargarSinMovimiento(rango.desde, rango.hasta, cursor) : Promise.resolve({ rows: [], nextCursor: null }),
      cola === "cuadre" ? cargarConciliacion(periodo, cursor) : Promise.resolve({ rows: [], nextCursor: null }),
    ]);
    const activa = cola === "costo" ? costo : cola === "movimiento" ? movimiento : cola === "cuadre" ? cuadre : match;
    return (
      <ConsumoCalidadVista
        cola={cola}
        dias={dias}
        match={match.rows}
        costo={costo.rows}
        movimiento={movimiento.rows}
        cuadre={cuadre.rows}
        nextCursor={activa.nextCursor}
      />
    );
  } catch (error) {
    return <ErrorPanel message={error instanceof Error ? error.message : "No pudimos cargar la calidad"} />;
  }
}
