"use client";

import { useEffect, useState } from "react";
import type { Excepcion } from "@/lib/operacion-shared";
import { brand } from "@/lib/theme";
import { DataTable, DataTableCell, DataTableHead, DataTableRow, DataTableTh } from "@/components/admin/DataTable";

function fecha(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }
  return new Intl.DateTimeFormat("es-DO", {
    timeZone: "America/Santo_Domingo",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function AdminExcepciones() {
  const [excepciones, setExcepciones] = useState<Excepcion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/admin/excepciones?abiertas=true", { credentials: "include" })
      .then(async (response) => {
        const body = (await response.json()) as { excepciones?: Excepcion[]; error?: string };
        if (!response.ok) {
          throw new Error(body.error || "No pudimos cargar las excepciones");
        }
        setExcepciones(body.excepciones ?? []);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "No pudimos cargar las excepciones"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Finanzas</p>
      <h1 className="font-display mt-1 text-2xl font-bold">Excepciones</h1>
      <p className="mt-1 max-w-2xl text-sm text-brand-muted">Cada caso abierto trae quién lo tiene, desde cuándo y qué falta.</p>
      {error ? (
        <p className="mt-4 rounded-2xl px-4 py-3 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>
          {error}
        </p>
      ) : null}
      {loading ? <div className="mt-6 h-40 animate-pulse rounded-2xl bg-[#F3F4F6]" /> : null}
      {!loading && excepciones.length === 0 ? (
        <p className="mt-6 rounded-2xl bg-white px-4 py-6 text-sm text-brand-muted" style={{ border: "1px solid #E7EBE4" }}>
          No hay excepciones abiertas.
        </p>
      ) : null}
      {excepciones.length > 0 ? (
        <div className="mt-5">
          <DataTable>
            <DataTableHead>
              <DataTableTh>Desde</DataTableTh>
              <DataTableTh>Dueño</DataTableTh>
              <DataTableTh>Qué falta</DataTableTh>
              <DataTableTh>Factura</DataTableTh>
              <DataTableTh>Abrió</DataTableTh>
            </DataTableHead>
            <tbody>
              {excepciones.map((item) => (
                <DataTableRow key={item.id}>
                  <DataTableCell className="whitespace-nowrap">{fecha(item.abiertaEn)}</DataTableCell>
                  <DataTableCell className="capitalize">{item.dueno}</DataTableCell>
                  <DataTableCell>{item.queFalta}</DataTableCell>
                  <DataTableCell>{item.facturaReferencia ?? "—"}</DataTableCell>
                  <DataTableCell className="capitalize">{item.autor}</DataTableCell>
                </DataTableRow>
              ))}
            </tbody>
          </DataTable>
        </div>
      ) : null}
    </div>
  );
}
