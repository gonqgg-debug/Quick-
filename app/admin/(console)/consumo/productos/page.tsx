import { redirect } from "next/navigation";
import { ProductosAnalitica } from "@/components/admin/consumo/ProductosAnalitica";
import { ErrorPanel } from "@/components/admin/consumo/ui";
import { consultarProductos, paramsDe } from "@/lib/pos-consumo";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Ventas por producto | Analítica",
};

export default async function ConsumoProductosPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const params = paramsDe(searchParams);
  if (!params.get("preset") && !params.get("desde") && !params.get("hasta")) {
    params.set("preset", "7c");
    redirect(`/admin/consumo/productos?${params.toString()}`);
  }
  try {
    const data = await consultarProductos(params);
    return <ProductosAnalitica inicial={data} consultaInicial={params.toString()} />;
  } catch (error) {
    return <ErrorPanel message={error instanceof Error ? error.message : "No pudimos cargar los productos"} />;
  }
}
