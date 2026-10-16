import Link from "next/link";
import { formatDayKey } from "@/lib/local-day";
import { formatPct, formatRd, formatUnidades } from "@/lib/pos-domain";
import type { ProductoConsumo } from "@/lib/pos-consumo";
import { DataTable, DataTableCell, DataTableHead, DataTableRow, DataTableTh } from "@/components/admin/DataTable";
import { Pildora, Vacio } from "@/components/admin/consumo/ui";
import { FiltrosProductos } from "@/components/admin/consumo/FiltrosProductos";

export function ConsumoProductosVista({
  rows,
  nextCursor,
  orden,
  categoria,
  q,
  categorias,
  desde,
  hasta,
  cursor,
}: {
  rows: ProductoConsumo[];
  nextCursor: string | null;
  orden: string;
  categoria: string;
  q: string;
  categorias: string[];
  desde: string;
  hasta: string;
  cursor: string | null;
}) {
  const base = new URLSearchParams({ preset: "custom", desde, hasta, orden });
  if (categoria) base.set("categoria", categoria);
  if (q) base.set("q", q);
  const ventaTotal = rows.reduce((sum, row) => sum + row.venta, 0);
  const esVariacion = orden === "variacion" || orden === "variacion_asc";
  const secundaria = "hidden md:table-cell";

  return (
    <div>
      <FiltrosProductos orden={orden} categoria={categoria} q={q} categorias={categorias} />
      {rows.length === 0 ? (
        <div className="mt-4">
          <Vacio titulo="No hay productos en este corte" detalle="Prueba otro periodo o quita el filtro de categoría." />
        </div>
      ) : (
        <DataTable className="mt-4" tableClassName="min-w-[860px]">
          <DataTableHead>
            <DataTableTh>Producto</DataTableTh>
            <DataTableTh className={secundaria}>Categoría</DataTableTh>
            <DataTableTh numeric>Unidades</DataTableTh>
            <DataTableTh numeric>Venta</DataTableTh>
            <DataTableTh numeric className={secundaria}>% venta</DataTableTh>
            <DataTableTh numeric className={secundaria}>Costo</DataTableTh>
            <DataTableTh numeric className={orden === "margen" ? undefined : secundaria}>Margen</DataTableTh>
            <DataTableTh numeric className={secundaria}>Margen %</DataTableTh>
            {esVariacion ? <DataTableTh numeric>Variación</DataTableTh> : null}
          </DataTableHead>
          <tbody>
            {rows.map((row) => {
              const params = new URLSearchParams(base);
              return (
                <DataTableRow key={row.codigo}>
                  <DataTableCell>
                    <Link href={`/admin/consumo/productos/${encodeURIComponent(row.codigo)}?${params}`} className="font-semibold text-[#111827]">
                      {row.nombre}
                    </Link>
                    <span className="mt-0.5 block text-xs text-brand-muted">
                      {row.marca ? `${row.marca} · ` : ""}
                      {row.codigo}
                    </span>
                  </DataTableCell>
                  <DataTableCell className={secundaria}>
                    {row.matchEstado === "sin_match" ? <Pildora tono="naranja">Sin match</Pildora> : row.categoria}
                  </DataTableCell>
                  <DataTableCell numeric>{formatUnidades(row.unidades)}</DataTableCell>
                  <DataTableCell numeric>{formatRd(row.venta)}</DataTableCell>
                  <DataTableCell numeric className={secundaria}>{ventaTotal > 0 ? formatPct(row.venta / ventaTotal).replace("+", "") : "—"}</DataTableCell>
                  <DataTableCell numeric className={secundaria}>
                    {row.costo == null ? (
                      "—"
                    ) : (
                      <span>
                        {formatRd(row.costo)}
                        <span className="mt-0.5 block text-xs text-brand-muted">
                          {row.costoOrigen === "manual" ? "Manual" : "Factura"}
                          {row.costoFecha ? ` · ${formatDayKey(row.costoFecha)}` : ""}
                        </span>
                      </span>
                    )}
                  </DataTableCell>
                  <DataTableCell numeric className={orden === "margen" ? undefined : secundaria}>{row.margen == null ? <Pildora tono="gris">Sin costo</Pildora> : formatRd(row.margen)}</DataTableCell>
                  <DataTableCell numeric className={secundaria}>{row.margenPct == null ? "—" : formatPct(row.margenPct).replace("+", "")}</DataTableCell>
                  {esVariacion ? <DataTableCell numeric>{formatPct(row.variacion)}</DataTableCell> : null}
                </DataTableRow>
              );
            })}
          </tbody>
        </DataTable>
      )}
      <div className="mt-4 flex items-center justify-between text-sm">
        <p className="text-brand-muted">
          {rows.length} filas · venta de esta página {formatRd(ventaTotal)}
        </p>
        {nextCursor ? (
          <Link
            href={`/admin/consumo/productos?${(() => {
              const next = new URLSearchParams(base);
              next.set("cursor", nextCursor);
              return next.toString();
            })()}`}
            className="font-semibold"
            style={{ color: "#3F6B1C" }}
          >
            Siguiente
          </Link>
        ) : cursor ? (
          <span className="text-brand-muted">Fin de la lista</span>
        ) : null}
      </div>
    </div>
  );
}
