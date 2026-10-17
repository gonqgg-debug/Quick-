import { ConsumoProductoVista } from "@/components/admin/consumo/ConsumoProductoVista";
import { ErrorPanel } from "@/components/admin/consumo/ui";
import { cargarProducto, paramsDe, periodoDesdeParams } from "@/lib/pos-consumo";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Producto | Analítica",
};

export default async function ConsumoProductoPage({
  params,
  searchParams,
}: {
  params: { codigo: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  try {
    const producto = await cargarProducto(decodeURIComponent(params.codigo), periodoDesdeParams(paramsDe(searchParams)));
    return <ConsumoProductoVista producto={producto} />;
  } catch (error) {
    return <ErrorPanel message={error instanceof Error ? error.message : "No pudimos cargar el producto"} />;
  }
}
