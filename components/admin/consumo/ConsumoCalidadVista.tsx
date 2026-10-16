"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { formatDayKey } from "@/lib/local-day";
import { formatRd } from "@/lib/pos-domain";
import { DataTable, DataTableCell, DataTableHead, DataTableRow, DataTableTh } from "@/components/admin/DataTable";
import { Pildora, Vacio, formatUnidades } from "@/components/admin/consumo/ui";
import { brand } from "@/lib/theme";

const COLAS = [
  ["match", "Sin match"],
  ["costo", "Sin costo"],
  ["movimiento", "Sin movimiento"],
  ["cuadre", "Conciliación"],
] as const;

export function ConsumoCalidadVista({
  cola,
  dias,
  match,
  costo,
  movimiento,
  cuadre,
  nextCursor,
}: {
  cola: string;
  dias: number;
  match: Array<{ codigo: string; nombre: string; unidades: number; venta: number; ultima: string }>;
  costo: Array<{ codigo: string; productId: string; nombre: string; marca: string | null; categoria: string; unidades: number; venta: number; ultima: string }>;
  movimiento: Array<{ productId: string; codigo: string | null; nombre: string; categoria: string | null; ultima: string | null }>;
  cuadre: Array<{ odooId: number; nombre: string; fecha: string; totalPagos: number; sumaOrdenes: number; sumaPagos: number }>;
  nextCursor: string | null;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const filas = cola === "costo" ? costo : cola === "movimiento" ? movimiento : cola === "cuadre" ? cuadre : match;

  function ir(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    next.set("cola", cola);
    next.set("dias", String(dias));
    next.delete("cursor");
    for (const [key, value] of Object.entries(patch)) {
      if (value == null) next.delete(key);
      else next.set(key, value);
    }
    router.push(`/admin/consumo/calidad?${next.toString()}`);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {COLAS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => ir({ cola: id })}
            className="rounded-full px-3 py-1.5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green"
            style={{ backgroundColor: cola === id ? "#111827" : "#F3F4F6", color: cola === id ? "#FFFFFF" : brand.ink }}
          >
            {label}
          </button>
        ))}
        {cola === "costo" || cola === "movimiento" ? (
          <div className="ml-auto flex gap-1">
            {(cola === "costo" ? [7, 30, 60] : [14, 30, 60]).map((opcion) => (
              <button
                key={opcion}
                type="button"
                onClick={() => ir({ dias: String(opcion) })}
                className="rounded-full px-3 py-1 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green"
                style={{ backgroundColor: dias === opcion ? brand.paleGreen : "#F3F4F6" }}
              >
                {opcion} días
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {filas.length === 0 ? (
        <div className="mt-4">
          <Vacio titulo="Nada en esta cola" detalle="Cuando aparezca una venta sin cruce, sin costo o una sesión que no cuadra, se lista aquí." />
        </div>
      ) : cola === "cuadre" ? (
        <DataTable className="mt-4" tableClassName="min-w-[760px]">
          <DataTableHead>
            <DataTableTh>Sesión</DataTableTh>
            <DataTableTh>Fecha</DataTableTh>
            <DataTableTh numeric>Total caja</DataTableTh>
            <DataTableTh numeric>Suma órdenes</DataTableTh>
            <DataTableTh numeric>Suma pagos</DataTableTh>
          </DataTableHead>
          <tbody>
            {cuadre.map((row) => (
              <DataTableRow key={row.odooId}>
                <DataTableCell className="font-semibold">{row.nombre}</DataTableCell>
                <DataTableCell>{formatDayKey(row.fecha)}</DataTableCell>
                <DataTableCell numeric>{formatRd(row.totalPagos)}</DataTableCell>
                <DataTableCell numeric>{formatRd(row.sumaOrdenes)}</DataTableCell>
                <DataTableCell numeric>{formatRd(row.sumaPagos)}</DataTableCell>
              </DataTableRow>
            ))}
          </tbody>
        </DataTable>
      ) : cola === "movimiento" ? (
        <DataTable className="mt-4" tableClassName="min-w-[640px]">
          <DataTableHead>
            <DataTableTh>Producto</DataTableTh>
            <DataTableTh>Categoría</DataTableTh>
            <DataTableTh>Última venta</DataTableTh>
          </DataTableHead>
          <tbody>
            {movimiento.map((row) => (
              <DataTableRow key={row.productId}>
                <DataTableCell>
                  <Link href={`/admin/catalogo/productos/${row.productId}`} className="font-semibold">
                    {row.nombre}
                  </Link>
                </DataTableCell>
                <DataTableCell>{row.categoria ?? "—"}</DataTableCell>
                <DataTableCell>{row.ultima ? formatDayKey(row.ultima) : "Sin ventas en lo cargado"}</DataTableCell>
              </DataTableRow>
            ))}
          </tbody>
        </DataTable>
      ) : (
        <DataTable className="mt-4" tableClassName="min-w-[760px]">
          <DataTableHead>
            <DataTableTh>Producto</DataTableTh>
            <DataTableTh numeric>Unidades</DataTableTh>
            <DataTableTh numeric>Venta</DataTableTh>
            <DataTableTh>Última</DataTableTh>
            <DataTableTh>{cola === "costo" ? "Costo" : ""}</DataTableTh>
          </DataTableHead>
          <tbody>
            {cola === "costo"
              ? costo.map((row) => (
                  <DataTableRow key={row.codigo}>
                    <DataTableCell>
                      <span className="font-semibold">{row.nombre || row.codigo}</span>
                      <span className="mt-0.5 block text-xs text-brand-muted">{row.codigo}</span>
                    </DataTableCell>
                    <DataTableCell numeric>{formatUnidades(row.unidades)}</DataTableCell>
                    <DataTableCell numeric>{formatRd(row.venta)}</DataTableCell>
                    <DataTableCell>{row.ultima ? formatDayKey(row.ultima) : "—"}</DataTableCell>
                    <DataTableCell>
                      <CostoInline productId={row.productId} />
                    </DataTableCell>
                  </DataTableRow>
                ))
              : match.map((row) => (
                  <DataTableRow key={row.codigo}>
                    <DataTableCell>
                      <span className="font-semibold">{row.nombre || row.codigo}</span>
                      <span className="mt-0.5 block text-xs text-brand-muted">{row.codigo}</span>
                      <Pildora tono="naranja">Sin match</Pildora>
                    </DataTableCell>
                    <DataTableCell numeric>{formatUnidades(row.unidades)}</DataTableCell>
                    <DataTableCell numeric>{formatRd(row.venta)}</DataTableCell>
                    <DataTableCell>{row.ultima ? formatDayKey(row.ultima) : "—"}</DataTableCell>
                    <DataTableCell>
                      <Link href={`/admin/catalogo/productos?q=${encodeURIComponent(row.codigo)}`} className="text-sm font-semibold" style={{ color: "#3F6B1C" }}>
                        Buscar en catálogo
                      </Link>
                    </DataTableCell>
                  </DataTableRow>
                ))}
          </tbody>
        </DataTable>
      )}
      {nextCursor ? (
        <button type="button" onClick={() => ir({ cursor: nextCursor })} className="mt-4 text-sm font-semibold" style={{ color: "#3F6B1C" }}>
          Siguiente
        </button>
      ) : null}
    </div>
  );
}

function CostoInline({ productId }: { productId: string }) {
  const router = useRouter();
  const [costo, setCosto] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/catalogo/productos", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: productId, costo }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(body?.error || "No pudimos guardar el costo");
      }
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No pudimos guardar el costo");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        void guardar();
      }}
    >
      <input
        value={costo}
        onChange={(event) => setCosto(event.target.value)}
        inputMode="decimal"
        aria-label="Costo manual"
        placeholder="RD$"
        className="w-24 rounded-md border border-[#E5E7EB] px-2 py-1.5 text-sm tabular-nums focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/40"
      />
      <button type="submit" disabled={guardando || !costo.trim()} className="text-sm font-semibold disabled:opacity-40" style={{ color: "#3F6B1C" }}>
        {guardando ? "Guardando" : "Guardar"}
      </button>
      {error ? <span className="text-xs" style={{ color: brand.error }}>{error}</span> : null}
    </form>
  );
}
