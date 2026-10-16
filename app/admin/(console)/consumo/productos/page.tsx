import { ConsumoProductosVista } from "@/components/admin/consumo/ConsumoProductosVista";
import { ErrorPanel } from "@/components/admin/consumo/ui";
import { buscarSeguro, parseOrden } from "@/lib/pos-domain";
import { cargarProductos, paramsDe, periodoDesdeParams } from "@/lib/pos-consumo";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { TIENDA_DEFAULT } from "@/lib/pos-domain";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Productos | Consumo",
};

export default async function ConsumoProductosPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const params = paramsDe(searchParams);
  const periodo = periodoDesdeParams(params);
  try {
    const [lista, categorias] = await Promise.all([
      cargarProductos({
        periodo,
        orden: parseOrden(params.get("orden")),
        categoria: (params.get("categoria") ?? "").slice(0, 80),
        q: buscarSeguro(params.get("q")),
        cursor: params.get("cursor"),
      }),
      categoriasDelPeriodo(periodo.desde, periodo.hasta),
    ]);
    return (
      <ConsumoProductosVista
        rows={lista.rows}
        nextCursor={lista.nextCursor}
        orden={parseOrden(params.get("orden"))}
        categoria={params.get("categoria") ?? ""}
        q={params.get("q") ?? ""}
        categorias={categorias}
        desde={periodo.desde}
        hasta={periodo.hasta}
        cursor={params.get("cursor")}
      />
    );
  } catch (error) {
    return <ErrorPanel message={error instanceof Error ? error.message : "No pudimos cargar los productos"} />;
  }
}

async function categoriasDelPeriodo(desde: string, hasta: string): Promise<string[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc("consumo_categorias", {
    p_tienda: TIENDA_DEFAULT,
    p_desde: desde,
    p_hasta: hasta,
  });
  if (error) {
    throw error;
  }
  const nombres = ((data ?? []) as Array<{ categoria?: string }>).map((row) => String(row.categoria ?? "")).filter(Boolean);
  return nombres.includes("Sin match") ? nombres : [...nombres, "Sin match"];
}
