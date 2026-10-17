import { redirect } from "next/navigation";
import { ProductoAnalitica } from "@/components/admin/consumo/ProductoAnalitica";
import { ErrorPanel } from "@/components/admin/consumo/ui";
import { consultarProducto, paramsDe } from "@/lib/pos-consumo";

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
  const codigo = decodeURIComponent(params.codigo);
  const consulta = paramsDe(searchParams);
  if (!consulta.get("preset") && !consulta.get("desde") && !consulta.get("hasta")) {
    consulta.set("preset", "7c");
    redirect(`/admin/consumo/productos/${encodeURIComponent(codigo)}?${consulta.toString()}`);
  }
  try {
    const data = await consultarProducto(codigo, consulta);
    return <ProductoAnalitica codigo={codigo} inicial={data} consultaInicial={consulta.toString()} />;
  } catch (error) {
    return <ErrorPanel message={error instanceof Error ? error.message : "No pudimos cargar el producto"} />;
  }
}
