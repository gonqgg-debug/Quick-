"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable, DataTableCell, DataTableHead, DataTableRow, DataTableTh } from "@/components/admin/shell/DataTable";
import { AdminInput, AdminSelect } from "@/components/admin/shell/AdminField";
import type { Movimiento } from "@/lib/inventario/shared";
import { formatPrice } from "@/lib/money";
import { brand } from "@/lib/theme";

const TIPOS = ["", "recepcion", "venta", "ajuste", "merma", "conteo", "devolucion_proveedor"];

export function AdminMovimientos() {
  const router = useRouter();
  const [tienda, setTienda] = useState("quick");
  const [tipo, setTipo] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [rows, setRows] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ tienda });
    if (tipo) {
      params.set("tipo", tipo);
    }
    if (desde) {
      params.set("desde", desde);
    }
    if (hasta) {
      params.set("hasta", hasta);
    }
    const response = await fetch(`/api/admin/inventario/movimientos?${params}`, { credentials: "include" });
    if (response.status === 401) {
      router.replace("/admin/login");
      return;
    }
    const body = (await response.json()) as { movimientos?: Movimiento[]; error?: string };
    if (!response.ok) {
      throw new Error(body.error || "No pudimos cargar los movimientos");
    }
    setRows(body.movimientos ?? []);
  }, [desde, hasta, router, tienda, tipo]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load()
      .then(() => {
        if (!cancelled) {
          setError(null);
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "Error al cargar");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Inventario</p>
      <h1 className="font-display mt-1 text-2xl font-bold">Movimientos</h1>
      <div className="mt-5 flex flex-wrap gap-3">
        <AdminInput value={tienda} onChange={(event) => setTienda(event.target.value)} aria-label="Tienda" />
        <AdminSelect value={tipo} onChange={(event) => setTipo(event.target.value)} aria-label="Tipo">
          {TIPOS.map((item) => (
            <option key={item || "todos"} value={item}>
              {item || "Todos los tipos"}
            </option>
          ))}
        </AdminSelect>
        <AdminInput type="date" value={desde} onChange={(event) => setDesde(event.target.value)} aria-label="Desde" />
        <AdminInput type="date" value={hasta} onChange={(event) => setHasta(event.target.value)} aria-label="Hasta" />
      </div>
      {error ? <p className="mt-4 rounded-2xl px-4 py-3 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>{error}</p> : null}
      <div className="mt-4">
        {loading ? (
          <div className="h-64 animate-pulse rounded-2xl bg-[#F3F4F6]" />
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#E7EBE4] px-6 py-16 text-center">
            <p className="font-display text-lg font-bold">No hay movimientos en ese filtro</p>
          </div>
        ) : (
          <DataTable tableClassName="min-w-[980px]">
            <DataTableHead>
              <DataTableTh>Fecha</DataTableTh>
              <DataTableTh>Producto</DataTableTh>
              <DataTableTh>Tipo</DataTableTh>
              <DataTableTh numeric>Cantidad</DataTableTh>
              <DataTableTh numeric>Costo</DataTableTh>
              <DataTableTh numeric>Stock</DataTableTh>
              <DataTableTh>Origen</DataTableTh>
              <DataTableTh>Referencia</DataTableTh>
            </DataTableHead>
            <tbody>
              {rows.map((row) => (
                <DataTableRow key={row.id}>
                  <DataTableCell className="whitespace-nowrap">{row.creadoEn.slice(0, 16).replace("T", " ")}</DataTableCell>
                  <DataTableCell className="font-semibold">{row.productoNombre || row.productoId}</DataTableCell>
                  <DataTableCell>{row.tipo}</DataTableCell>
                  <DataTableCell numeric>{row.cantidad}</DataTableCell>
                  <DataTableCell numeric>{row.costoUnitario == null ? "—" : formatPrice(row.costoUnitario)}</DataTableCell>
                  <DataTableCell numeric>{row.stockDespues}</DataTableCell>
                  <DataTableCell>{row.origen}</DataTableCell>
                  <DataTableCell>{row.referencia || "—"}</DataTableCell>
                </DataTableRow>
              ))}
            </tbody>
          </DataTable>
        )}
      </div>
    </div>
  );
}
