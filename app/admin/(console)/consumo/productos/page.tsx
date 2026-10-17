import { Suspense } from "react";
import { ProductosAnalitica } from "@/components/admin/consumo/ProductosAnalitica";
import { ErrorPanel } from "@/components/admin/consumo/ui";
import { parseSinCosto, parseVista } from "@/lib/productos-analitica";
import { TIENDA_DEFAULT, buscarSeguro, parseOrden, parsePagina, parseTamano } from "@/lib/pos-domain";
import { cargarFrescura, cargarPanelProducto, cargarProductos, paramsDe, periodoDesdeParams } from "@/lib/pos-consumo";
import { getSupabaseAdminClient } from "@/lib/supabase";

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
  const periodo = periodoDesdeParams(params);
  const ordenRaw = parseOrden(params.get("orden"));
  const orden = !periodo.comparar && (ordenRaw === "variacion" || ordenRaw === "variacion_asc") ? "venta" : ordenRaw;
  const categoria = (params.get("categoria") ?? "").slice(0, 80);
  const q = buscarSeguro(params.get("q"));
  const sinCosto = parseSinCosto(params.get("sin_costo"));
  const tamano = parseTamano(params.get("tamano"));
  const pagina = parsePagina(params.get("pagina"));
  const vista = parseVista(params.get("vista"));
  const codigo = (params.get("producto") ?? "").slice(0, 120);
  try {
    const [lista, categorias, frescura] = await Promise.all([
      cargarProductos({
        periodo,
        orden,
        categoria,
        q,
        cursor: null,
        limit: tamano,
        offset: (pagina - 1) * tamano,
        sinCosto,
      }),
      categoriasDelPeriodo(periodo.desde, periodo.hasta),
      cargarFrescura().catch(() => null),
    ]);
    let panel: Awaited<ReturnType<typeof cargarPanelProducto>> | null = null;
    let panelError: string | null = null;
    if (codigo) {
      try {
        panel = await cargarPanelProducto(codigo, periodo);
      } catch (error) {
        panelError = error instanceof Error ? error.message : "No pudimos abrir el producto";
      }
    }
    return (
      <Suspense fallback={<div className="analitica-productos h-40 animate-pulse rounded-lg bg-[#E8EBE8]" aria-hidden="true" />}>
      <ProductosAnalitica
        rows={lista.rows}
        periodo={periodo}
        totales={lista.totales}
        totalesTramo={lista.totalesTramo}
        totalesAnterior={lista.totalesAnterior}
        ventaPeriodo={lista.ventaPeriodo}
        orden={orden}
        categoria={categoria}
        q={q}
        categorias={categorias}
        sinCosto={sinCosto}
        vista={vista}
        pagina={pagina}
        tamano={tamano}
        frescura={frescura}
        panel={panel}
        panelError={panelError}
      />
      </Suspense>
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
