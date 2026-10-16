import { ConsumoResumenVista } from "@/components/admin/consumo/ConsumoResumenVista";
import { ErrorPanel } from "@/components/admin/consumo/ui";
import { resumenMiles } from "@/lib/miles-store";
import { cargarResumen, paramsDe, periodoDesdeParams } from "@/lib/pos-consumo";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Consumo | Administración",
  description: "Venta, margen y horario de la caja",
};

export default async function ConsumoPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  try {
    const data = await cargarResumen(periodoDesdeParams(paramsDe(searchParams)));
    let miles = null;
    try {
      miles = await resumenMiles();
    } catch {
      miles = null;
    }
    return <ConsumoResumenVista data={data} miles={miles} />;
  } catch (error) {
    return <ErrorPanel message={error instanceof Error ? error.message : "No pudimos cargar el consumo"} />;
  }
}
