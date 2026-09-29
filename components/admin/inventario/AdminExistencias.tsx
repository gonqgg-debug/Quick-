"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable, DataTableCell, DataTableHead, DataTableRow, DataTableTh } from "@/components/admin/shell/DataTable";
import { AdminInput } from "@/components/admin/shell/AdminField";
import type { Existencia } from "@/lib/inventario/shared";
import { formatPrice } from "@/lib/money";
import { brand } from "@/lib/theme";

export function AdminExistencias() {
  const router = useRouter();
  const [tienda, setTienda] = useState("quick");
  const [q, setQ] = useState("");
  const [bajoMinimo, setBajoMinimo] = useState(false);
  const [rows, setRows] = useState<Existencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ tienda, q });
    if (bajoMinimo) {
      params.set("bajoMinimo", "true");
    }
    const response = await fetch(`/api/admin/inventario/existencias?${params}`, { credentials: "include" });
    if (response.status === 401) {
      router.replace("/admin/login");
      return;
    }
    const body = (await response.json()) as { existencias?: Existencia[]; error?: string };
    if (!response.ok) {
      throw new Error(body.error || "No pudimos cargar las existencias");
    }
    setRows(body.existencias ?? []);
  }, [bajoMinimo, q, router, tienda]);

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
      <h1 className="font-display mt-1 text-2xl font-bold">Existencias</h1>
      <div className="mt-5 flex flex-wrap gap-3">
        <AdminInput value={tienda} onChange={(event) => setTienda(event.target.value)} aria-label="Tienda" />
        <AdminInput value={q} onChange={(event) => setQ(event.target.value)} placeholder="Buscar producto o código" aria-label="Buscar" />
        <button type="button" onClick={() => setBajoMinimo((current) => !current)} className="rounded-full px-4 text-sm font-semibold" style={{ minHeight: 40, backgroundColor: bajoMinimo ? brand.ink : "#F3F4F6", color: bajoMinimo ? "#fff" : brand.ink }}>
          Bajo mínimo
        </button>
      </div>
      {error ? <p className="mt-4 rounded-2xl px-4 py-3 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>{error}</p> : null}
      <div className="mt-4">
        {loading ? (
          <div className="h-64 animate-pulse rounded-2xl bg-[#F3F4F6]" />
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#E7EBE4] px-6 py-16 text-center">
            <p className="font-display text-lg font-bold">Todavía no hay existencias</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-brand-muted">El stock entra al aplicar una factura de compra.</p>
          </div>
        ) : (
          <DataTable tableClassName="min-w-[980px]">
            <DataTableHead>
              <DataTableTh>Producto</DataTableTh>
              <DataTableTh>Odoo</DataTableTh>
              <DataTableTh>Barras</DataTableTh>
              <DataTableTh numeric>Cantidad</DataTableTh>
              <DataTableTh numeric>Costo promedio</DataTableTh>
              <DataTableTh numeric>Último costo</DataTableTh>
              <DataTableTh numeric>Reorden</DataTableTh>
              <DataTableTh numeric>Valor</DataTableTh>
            </DataTableHead>
            <tbody>
              {rows.map((row) => (
                <DataTableRow key={row.productoId}>
                  <DataTableCell className="font-semibold">{row.nombre}</DataTableCell>
                  <DataTableCell className="font-mono text-xs">{row.codigoOdoo || "—"}</DataTableCell>
                  <DataTableCell className="font-mono text-xs">{row.codigoBarras || "—"}</DataTableCell>
                  <DataTableCell numeric>{row.cantidad}</DataTableCell>
                  <DataTableCell numeric>{row.costoPromedio == null ? "—" : formatPrice(row.costoPromedio)}</DataTableCell>
                  <DataTableCell numeric>{row.ultimoCosto == null ? "—" : formatPrice(row.ultimoCosto)}</DataTableCell>
                  <DataTableCell numeric>{row.puntoReorden}</DataTableCell>
                  <DataTableCell numeric>{row.cantidad > 0 && row.costoPromedio != null ? formatPrice(row.cantidad * row.costoPromedio) : formatPrice(0)}</DataTableCell>
                </DataTableRow>
              ))}
            </tbody>
          </DataTable>
        )}
      </div>
    </div>
  );
}
