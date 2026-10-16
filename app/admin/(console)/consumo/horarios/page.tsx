import { ConsumoHorariosVista } from "@/components/admin/consumo/ConsumoHorariosVista";
import { ErrorPanel } from "@/components/admin/consumo/ui";
import { parseMetrica } from "@/lib/pos-domain";
import { cargarHorarios, paramsDe, periodoDesdeParams } from "@/lib/pos-consumo";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Horarios | Consumo",
};

export default async function ConsumoHorariosPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const params = paramsDe(searchParams);
  try {
    const data = await cargarHorarios(periodoDesdeParams(params), (params.get("categoria") ?? "").slice(0, 80));
    return (
      <ConsumoHorariosVista
        celdas={data.celdas}
        turnos={data.turnos}
        categorias={data.categorias}
        categoria={params.get("categoria") ?? ""}
        metrica={parseMetrica(params.get("metrica"))}
      />
    );
  } catch (error) {
    return <ErrorPanel message={error instanceof Error ? error.message : "No pudimos cargar los horarios"} />;
  }
}
