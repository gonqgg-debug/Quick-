"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/lib/money";
import type { ImportPreview } from "@/lib/catalog-import-shared";
import { brand } from "@/lib/theme";

const PREVIEW_LIMIT = 40;

const FIELD_LABEL = {
  nombre: "nombre",
  marca: "marca",
  categoria: "categoría",
  precio: "precio",
  codigoBarras: "código de barras",
} as const;

type Result = {
  created: number;
  updated: number;
  unchanged: number;
  missing: ImportPreview["missing"];
};

export function AdminCatalogImport() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<File | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"preview" | "confirm" | null>(null);

  async function sendFile(path: "/api/admin/catalogo/import/preview" | "/api/admin/catalogo/import/confirm") {
    const file = fileRef.current;
    if (!file) {
      throw new Error("Elige un archivo primero");
    }
    const body = new FormData();
    body.append("file", file);
    const response = await fetch(path, { method: "POST", body, credentials: "include" });
    if (response.status === 401) {
      router.replace("/admin/login");
      throw new Error("Sesión expirada");
    }
    const payload = (await response.json().catch(() => null)) as (ImportPreview & Result & { error?: string }) | null;
    if (!response.ok) {
      throw new Error(payload?.error || "No pudimos procesar el archivo");
    }
    return payload;
  }

  async function handleFile(file: File) {
    fileRef.current = file;
    setFileName(file.name);
    setPreview(null);
    setResult(null);
    setError(null);
    setLoading("preview");
    try {
      const payload = await sendFile("/api/admin/catalogo/import/preview");
      setPreview(payload as ImportPreview);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Error al leer el archivo");
    } finally {
      setLoading(null);
    }
  }

  async function handleConfirm() {
    if (!preview || (preview.totals.created === 0 && preview.totals.updated === 0)) {
      return;
    }
    setError(null);
    setLoading("confirm");
    try {
      const payload = (await sendFile("/api/admin/catalogo/import/confirm")) as Result;
      setResult(payload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Error al importar");
    } finally {
      setLoading(null);
    }
  }

  function reset() {
    fileRef.current = null;
    setFileName(null);
    setPreview(null);
    setResult(null);
    setError(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  const busy = loading != null;
  const canConfirm = Boolean(preview && !result && (preview.totals.created > 0 || preview.totals.updated > 0));

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Catálogo</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Importar</h1>
          <p className="mt-1 max-w-xl text-sm text-brand-muted">
            Sube el Excel o CSV de Odoo. Matcheamos por código; si el producto ya existe actualizamos datos y
            dejamos la foto como está. Nada se borra si no viene en el archivo.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void handleFile(file);
              }
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="rounded-full px-4 text-sm font-bold text-white disabled:opacity-50"
            style={{ backgroundColor: brand.orange, minHeight: 44 }}
          >
            {loading === "preview" ? "Leyendo..." : "Subir Excel o CSV"}
          </button>
          {preview || result ? (
            <button
              type="button"
              disabled={busy}
              onClick={reset}
              className="rounded-full px-4 text-sm font-bold disabled:opacity-50"
              style={{ minHeight: 44, backgroundColor: "#F3F4F6" }}
            >
              Otro archivo
            </button>
          ) : null}
        </div>
      </div>

      <p className="mt-3 text-xs text-brand-muted">
        Columnas que buscamos: código Odoo, nombre, marca, categoría, precio y, si viene, código de barras (EAN/barcode). Aceptamos nombres de Odoo como
        “Referencia interna” y “Precio de venta”.
      </p>
      {fileName ? <p className="mt-1 text-sm font-semibold">{fileName}</p> : null}

      {error ? (
        <p className="mt-4 rounded-2xl px-3 py-2 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>
          {error}
        </p>
      ) : null}

      {result ? <ResultCard result={result} /> : null}
      {preview && !result ? (
        <>
          <SummaryStrip totals={preview.totals} columns={preview.columns} />
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              disabled={!canConfirm || busy}
              onClick={() => void handleConfirm()}
              className="rounded-full px-5 text-sm font-bold text-white disabled:opacity-40"
              style={{ backgroundColor: brand.green, minHeight: 44 }}
            >
              {loading === "confirm" ? "Aplicando..." : "Confirmar importación"}
            </button>
          </div>
          <PreviewLists preview={preview} />
        </>
      ) : null}
    </div>
  );
}

function SummaryStrip({
  totals,
  columns,
}: {
  totals: ImportPreview["totals"];
  columns: ImportPreview["columns"];
}) {
  const chips = [
    { label: "Nuevos", value: totals.created, color: brand.green },
    { label: "Actualizaciones", value: totals.updated, color: brand.orange },
    { label: "Sin cambios", value: totals.unchanged, color: brand.blue },
    { label: "Filas con error", value: totals.invalid, color: brand.error },
    { label: "En DB, no en archivo", value: totals.missing, color: brand.muted },
  ];
  return (
    <div className="mt-5">
      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <span
            key={chip.label}
            className="rounded-full px-3 py-1.5 text-sm font-bold text-white"
            style={{ backgroundColor: chip.color }}
          >
            {chip.value} {chip.label}
          </span>
        ))}
      </div>
      {columns.codigo || columns.nombre ? (
        <p className="mt-2 text-xs text-brand-muted">
          Columnas detectadas:{" "}
          {[columns.codigo && `código “${columns.codigo}”`, columns.nombre && `nombre “${columns.nombre}”`, columns.marca && `marca “${columns.marca}”`, columns.categoria && `categoría “${columns.categoria}”`, columns.precio && `precio “${columns.precio}”`]
            .filter(Boolean)
            .join(" · ")}
        </p>
      ) : null}
    </div>
  );
}

function ResultCard({ result }: { result: Result }) {
  return (
    <div className="mt-5 rounded-[24px] border px-5 py-5" style={{ borderColor: "#E5E7EB", backgroundColor: "#F8FAF7" }}>
      <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Resumen</p>
      <h2 className="font-display mt-1 text-xl font-bold">Importación aplicada</h2>
      <ul className="mt-3 space-y-1 text-sm font-semibold">
        <li>{result.created} productos creados</li>
        <li>{result.updated} productos actualizados</li>
        <li>{result.unchanged} quedaron sin cambios</li>
      </ul>
      {result.missing.length > 0 ? (
        <div className="mt-4">
          <p className="text-sm font-bold">
            {result.missing.length} productos de la base no aparecieron en este import (no se tocaron)
          </p>
          <MissingList items={result.missing} />
        </div>
      ) : null}
    </div>
  );
}

function PreviewLists({ preview }: { preview: ImportPreview }) {
  return (
    <div className="mt-6 space-y-6">
      <Section title={`Nuevos (${preview.created.length})`}>
        {preview.created.length === 0 ? (
          <Empty text="No hay productos nuevos en este archivo." />
        ) : (
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="text-xs font-bold uppercase tracking-wide text-brand-muted">
                <th className="px-3 py-2">Código</th>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Marca</th>
                <th className="px-3 py-2">Categoría</th>
                <th className="px-3 py-2 text-right">Precio</th>
              </tr>
            </thead>
            <tbody>
              {preview.created.slice(0, PREVIEW_LIMIT).map((item) => (
                <tr key={item.codigo} className="border-t" style={{ borderColor: "#F3F4F6" }}>
                  <td className="px-3 py-2 font-mono text-xs">{item.codigo}</td>
                  <td className="px-3 py-2 font-semibold">{item.nombre}</td>
                  <td className="px-3 py-2">{item.marca || "—"}</td>
                  <td className="px-3 py-2">{item.categoria}</td>
                  <td className="px-3 py-2 text-right font-bold">{formatPrice(item.precio)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <More count={preview.created.length} />
      </Section>

      <Section title={`Actualizaciones (${preview.updated.length})`}>
        {preview.updated.length === 0 ? (
          <Empty text="Ningún producto existente cambia con este archivo." />
        ) : (
          <ul className="divide-y" style={{ borderColor: "#F3F4F6" }}>
            {preview.updated.slice(0, PREVIEW_LIMIT).map((item) => (
              <li key={item.codigo} className="px-3 py-3">
                <p className="text-sm font-bold">
                  {item.nombre} <span className="font-mono text-xs font-semibold text-brand-muted">{item.codigo}</span>
                </p>
                <ul className="mt-1 space-y-0.5 text-sm text-brand-muted">
                  {item.changes.map((change) => (
                    <li key={change.field}>
                      {FIELD_LABEL[change.field]}: {change.fromLabel} → {change.toLabel}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
        <More count={preview.updated.length} />
      </Section>

      {preview.invalid.length > 0 ? (
        <Section title={`Filas con error (${preview.invalid.length})`}>
          <ul className="space-y-1 px-3 py-2 text-sm">
            {preview.invalid.slice(0, PREVIEW_LIMIT).map((item) => (
              <li key={`${item.row}-${item.codigo}`}>
                Fila {item.row}
                {item.codigo ? ` (${item.codigo})` : ""}: {item.reason}
              </li>
            ))}
          </ul>
          <More count={preview.invalid.length} />
        </Section>
      ) : null}

      <Section title={`En la base y no en este archivo (${preview.missing.length})`}>
        <p className="px-3 pb-2 text-sm text-brand-muted">No se van a borrar ni desactivar.</p>
        {preview.missing.length === 0 ? <Empty text="Todos los productos con código están en el archivo." /> : <MissingList items={preview.missing} />}
      </Section>
    </div>
  );
}

function MissingList({ items }: { items: ImportPreview["missing"] }) {
  return (
    <ul className="max-h-56 overflow-auto px-3 py-2 text-sm">
      {items.slice(0, PREVIEW_LIMIT).map((item) => (
        <li key={item.id}>
          {item.nombre} {item.codigo ? <span className="font-mono text-xs text-brand-muted">{item.codigo}</span> : <span className="text-xs text-brand-muted">(sin código Odoo)</span>}
        </li>
      ))}
      {items.length > PREVIEW_LIMIT ? (
        <li className="text-brand-muted">y {items.length - PREVIEW_LIMIT} más</li>
      ) : null}
    </ul>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[24px] border" style={{ borderColor: "#E5E7EB" }}>
      <h2 className="px-3 py-3 text-sm font-bold" style={{ backgroundColor: "#F8FAF7" }}>
        {title}
      </h2>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-3 py-4 text-sm text-brand-muted">{text}</p>;
}

function More({ count }: { count: number }) {
  if (count <= PREVIEW_LIMIT) {
    return null;
  }
  return <p className="px-3 py-2 text-xs text-brand-muted">Mostrando {PREVIEW_LIMIT} de {count}</p>;
}
