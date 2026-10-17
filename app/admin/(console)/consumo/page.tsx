import { redirect } from "next/navigation";
import { ResumenAnalitica } from "@/components/admin/consumo/ResumenAnalitica";
import { ErrorPanel } from "@/components/admin/consumo/ui";
import { consultarResumen, paramsDe } from "@/lib/pos-consumo";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Resumen del negocio | Analítica",
  description: "Cómo va el negocio, qué explica el cambio y qué requiere atención.",
};

export default async function ConsumoPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const params = paramsDe(searchParams);
  if (!params.get("preset") && !params.get("desde") && !params.get("hasta")) {
    params.set("preset", "7c");
    redirect(`/admin/consumo?${params.toString()}`);
  }
  try {
    const data = await consultarResumen(params);
    return <ResumenAnalitica inicial={data} consultaInicial={params.toString()} />;
  } catch (error) {
    return <ErrorPanel message={error instanceof Error ? error.message : "No pudimos cargar el resumen"} />;
  }
}
