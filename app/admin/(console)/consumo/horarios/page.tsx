import { redirect } from "next/navigation";
import { ConsumoHorariosVista } from "@/components/admin/consumo/ConsumoHorariosVista";
import { ErrorPanel } from "@/components/admin/consumo/ui";
import { consultarHorarios, paramsDe } from "@/lib/pos-consumo";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Ventas por día y hora | Analítica",
  description: "Cuándo se concentra la demanda y qué cambia frente al periodo comparado.",
};

export default async function ConsumoHorariosPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const params = paramsDe(searchParams);
  if (!params.get("preset") && !params.get("desde") && !params.get("hasta")) {
    params.set("preset", "7c");
    redirect(`/admin/consumo/horarios?${params.toString()}`);
  }
  try {
    const data = await consultarHorarios(params);
    return <ConsumoHorariosVista inicial={data} consultaInicial={params.toString()} />;
  } catch (error) {
    return <ErrorPanel message={error instanceof Error ? error.message : "No pudimos cargar los horarios"} />;
  }
}
