import { MilesVista } from "@/components/admin/consumo/MilesVista";
import { ErrorPanel } from "@/components/admin/consumo/ui";
import { MilesError } from "@/lib/miles-domain";
import { credencialMilesActiva, leerHallazgo, listarEjecuciones, listarHallazgos, listarInvestigaciones, listarPruebas, resumenMiles } from "@/lib/miles-store";
import { cargarFrescura } from "@/lib/pos-consumo";
import { listarPropuestas } from "@/lib/promo-store";

export const dynamic = "force-dynamic";

export const metadata = { title: "Miles | Consumo" };

export default async function MilesPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const uno = (key: string) => {
    const value = searchParams[key];
    return Array.isArray(value) ? value[0] ?? "" : value ?? "";
  };
  try {
    const hallazgoId = uno("hallazgo");
    const [hallazgos, investigaciones, pruebas, ejecuciones, credencial, miles, frescura, detalle, promos] = await Promise.all([
      listarHallazgos({ tienda: null, tipo: null, estado: null, prioridad: null, desde: null, hasta: null, limit: 100, cursor: null }),
      listarInvestigaciones(null, 50),
      listarPruebas(null),
      listarEjecuciones(20),
      credencialMilesActiva(),
      resumenMiles(),
      cargarFrescura().catch(() => null),
      hallazgoId ? leerHallazgo(hallazgoId) : Promise.resolve(null),
      listarPropuestas().then(
        (rows) => ({ rows, disponibles: true }),
        (error: unknown) => {
          if (error instanceof MilesError && error.status === 503) return { rows: [], disponibles: false };
          throw error;
        },
      ),
    ]);
    return (
      <MilesVista
        vista={uno("vista") || "hallazgos"}
        filtros={{
          tipo: uno("tipo"),
          estado: uno("estado"),
          prioridad: uno("prioridad"),
          desde: uno("desde"),
          hasta: uno("hasta"),
          q: uno("q"),
          rapido: uno("rapido"),
        }}
        hallazgos={hallazgos}
        investigaciones={investigaciones}
        pruebas={pruebas}
        propuestas={promos.rows}
        promosDisponibles={promos.disponibles}
        pedirPromo={uno("pedir") === "1"}
        ejecuciones={ejecuciones}
        credencial={credencial}
        ultima={miles.ultima}
        frescura={frescura}
        detalle={detalle}
        origen={uno("origen")}
      />
    );
  } catch (error) {
    return <ErrorPanel message={error instanceof Error ? error.message : "No pudimos cargar Miles"} />;
  }
}
