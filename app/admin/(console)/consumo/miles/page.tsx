import { MilesVista } from "@/components/admin/consumo/MilesVista";
import { ErrorPanel } from "@/components/admin/consumo/ui";
import { credencialMilesActiva, listarHallazgos, listarInvestigaciones, listarPruebas, resumenMiles } from "@/lib/miles-store";

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
    const [hallazgos, investigaciones, pruebas, credencial, miles] = await Promise.all([
      listarHallazgos({
        tienda: uno("tienda") || null,
        tipo: uno("tipo") || null,
        estado: uno("estado") || null,
        prioridad: uno("prioridad") || null,
        desde: uno("desde") || null,
        hasta: uno("hasta") || null,
        limit: 50,
        cursor: null,
      }),
      listarInvestigaciones(null, 50),
      listarPruebas(null),
      credencialMilesActiva(),
      resumenMiles(),
    ]);
    return (
      <MilesVista
        vista={uno("vista") || "hallazgos"}
        filtros={{ tipo: uno("tipo"), estado: uno("estado"), prioridad: uno("prioridad"), desde: uno("desde"), hasta: uno("hasta") }}
        hallazgos={hallazgos}
        investigaciones={investigaciones}
        pruebas={pruebas}
        credencial={credencial}
        ultima={miles.ultima}
        recomendaciones={miles.recomendaciones}
      />
    );
  } catch (error) {
    return <ErrorPanel message={error instanceof Error ? error.message : "No pudimos cargar Miles"} />;
  }
}
