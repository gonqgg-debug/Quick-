"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/lib/money";
import { countSpreadsheetDataRows } from "@/lib/count-spreadsheet-rows";
import type { ImportPreview } from "@/lib/catalog-import-shared";
import { brand } from "@/lib/theme";

const PREVIEW_LIMIT = 40;
const ACCEPT = ".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv";

const FIELD_LABEL = {
  nombre: "nombre",
  marca: "marca",
  categoria: "categoría",
  precio: "precio",
  codigoBarras: "código de barras",
} as const;

const EXPECTED_COLUMNS: Array<{ key: keyof ImportPreview["columns"] | "codigo"; label: string; hint: string }> = [
  { key: "codigo", label: "Código Odoo", hint: "Referencia interna" },
  { key: "nombre", label: "Nombre", hint: "Producto" },
  { key: "marca", label: "Marca", hint: "Opcional" },
  { key: "categoria", label: "Categoría", hint: "Si no viene, se conserva" },
  { key: "precio", label: "Precio", hint: "Precio de venta" },
  { key: "codigoBarras", label: "Código de barras", hint: "EAN / barcode, opcional" },
];

type Result = {
  created: number;
  updated: number;
  unchanged: number;
  missing: ImportPreview["missing"];
};

type PickedFile = {
  file: File;
  rows: number | null;
};

export function AdminCatalogImport() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [picked, setPicked] = useState<PickedFile | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"preview" | "confirm" | null>(null);

  async function sendFile(path: "/api/admin/catalogo/import/preview" | "/api/admin/catalogo/import/confirm") {
    const file = picked?.file;
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

  async function selectFile(file: File) {
    setError(null);
    setPreview(null);
    setResult(null);
    let rows: number | null = null;
    try {
      rows = await countSpreadsheetDataRows(file);
    } catch {
      rows = null;
    }
    setPicked({ file, rows });
  }

  async function handleAnalyze() {
    if (!picked) {
      return;
    }
    setError(null);
    setResult(null);
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
    setPicked(null);
    setPreview(null);
    setResult(null);
    setError(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function onDragEnter(event: React.DragEvent) {
    event.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  }

  function onDragLeave(event: React.DragEvent) {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) {
      setDragging(false);
    }
  }

  function onDragOver(event: React.DragEvent) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }

  function onDrop(event: React.DragEvent) {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      void selectFile(file);
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
        {picked || preview || result ? (
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

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void selectFile(file);
          }
        }}
      />

      {!result ? (
        <div
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDrop={onDrop}
          className="mt-6"
        >
          {picked ? (
            <FileCard
              picked={picked}
              busy={busy}
              loading={loading}
              analyzed={Boolean(preview)}
              onAnalyze={() => void handleAnalyze()}
              onBrowse={() => inputRef.current?.click()}
              dragging={dragging}
            />
          ) : (
            <DropZone dragging={dragging} disabled={busy} onBrowse={() => inputRef.current?.click()} />
          )}
        </div>
      ) : null}

      {!result ? <ColumnGuide columns={preview?.columns} /> : null}

      {error ? (
        <p className="mt-4 rounded-2xl px-3 py-2 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>
          {error}
        </p>
      ) : null}

      {result ? <ResultCard result={result} onReset={reset} /> : null}

      {preview && !result ? (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <StatCard label="Nuevos" value={preview.totals.created} color={brand.green} hint="Se van a crear" />
            <StatCard
              label="Actualizaciones"
              value={preview.totals.updated}
              color={brand.orange}
              hint="Ya existen y cambian"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <MiniChip label={`${preview.totals.unchanged} sin cambios`} />
            {preview.totals.invalid > 0 ? (
              <MiniChip label={`${preview.totals.invalid} filas con error`} tone="error" />
            ) : null}
            <MiniChip label={`${preview.totals.missing} no están en este archivo`} />
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              disabled={!canConfirm || busy}
              onClick={() => void handleConfirm()}
              className="rounded-full px-5 text-sm font-bold text-white disabled:opacity-40"
              style={{ backgroundColor: brand.green, minHeight: 44 }}
            >
              {loading === "confirm" ? "Aplicando..." : "Aplicar cambios"}
            </button>
          </div>
          <PreviewLists preview={preview} />
        </>
      ) : null}
    </div>
  );
}

function DropZone({
  dragging,
  disabled,
  onBrowse,
}: {
  dragging: boolean;
  disabled: boolean;
  onBrowse: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onBrowse}
      className="flex w-full flex-col items-center justify-center rounded-[28px] px-6 py-12 text-center transition-colors disabled:opacity-50"
      style={{
        minHeight: 220,
        border: `2px dashed ${dragging ? brand.green : "#D1D5DB"}`,
        backgroundColor: dragging ? "#F8FAF7" : "#FAFBFA",
      }}
    >
      <UploadIcon accent={dragging ? brand.green : brand.muted} />
      <p className="mt-4 max-w-sm font-display text-lg font-bold leading-snug">
        Arrastra tu Excel o CSV aquí, o haz click para seleccionar
      </p>
      <p className="mt-2 text-sm text-brand-muted">.xlsx o .csv · máximo 4 MB</p>
    </button>
  );
}

function FileCard({
  picked,
  busy,
  loading,
  analyzed,
  onAnalyze,
  onBrowse,
  dragging,
}: {
  picked: PickedFile;
  busy: boolean;
  loading: "preview" | "confirm" | null;
  analyzed: boolean;
  onAnalyze: () => void;
  onBrowse: () => void;
  dragging: boolean;
}) {
  return (
    <div
      className="rounded-[28px] px-5 py-5"
      style={{
        border: `2px dashed ${dragging ? brand.green : "#E5E7EB"}`,
        backgroundColor: dragging ? "#F8FAF7" : "#FFFFFF",
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
            style={{ backgroundColor: "#F8FAF7" }}
          >
            <FileIcon />
          </div>
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-bold">{picked.file.name}</p>
            <p className="mt-1 text-sm text-brand-muted">
              {formatBytes(picked.file.size)}
              {picked.rows != null ? ` · ${picked.rows.toLocaleString("es-DO")} filas` : ""}
            </p>
            <button type="button" className="mt-2 text-sm font-bold" style={{ color: brand.blue }} onClick={onBrowse}>
              Cambiar archivo
            </button>
          </div>
        </div>
        {!analyzed ? (
          <button
            type="button"
            disabled={busy}
            onClick={onAnalyze}
            className="rounded-full px-5 text-sm font-bold text-white disabled:opacity-40"
            style={{ backgroundColor: brand.orange, minHeight: 44 }}
          >
            {loading === "preview" ? "Analizando..." : "Confirmar y analizar"}
          </button>
        ) : (
          <p className="text-sm font-semibold" style={{ color: brand.green }}>
            Archivo analizado
          </p>
        )}
      </div>
    </div>
  );
}

function ColumnGuide({ columns }: { columns?: ImportPreview["columns"] }) {
  return (
    <div className="mt-5">
      <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Columnas que buscamos</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {EXPECTED_COLUMNS.map((column) => {
          const detected = Boolean(columns?.[column.key]);
          return (
            <li
              key={column.key}
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold"
              style={{
                backgroundColor: detected ? "#F8FAF7" : "#F3F4F6",
                color: brand.ink,
                border: detected ? `1px solid ${brand.green}` : "1px solid transparent",
              }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: detected ? brand.green : brand.muted }}
              />
              {column.label}
              <span className="text-xs font-medium text-brand-muted">{column.hint}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StatCard({ label, value, color, hint }: { label: string; value: number; color: string; hint: string }) {
  return (
    <div className="rounded-[24px] px-5 py-5" style={{ backgroundColor: "#F8FAF7", border: "1px solid #E5E7EB" }}>
      <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">{label}</p>
      <p className="font-display mt-1 text-4xl font-bold" style={{ color }}>
        {value.toLocaleString("es-DO")}
      </p>
      <p className="mt-1 text-sm text-brand-muted">{hint}</p>
    </div>
  );
}

function MiniChip({ label, tone }: { label: string; tone?: "error" }) {
  return (
    <span
      className="rounded-full px-3 py-1.5 text-sm font-semibold"
      style={{
        backgroundColor: tone === "error" ? "#FEE2E2" : "#F3F4F6",
        color: tone === "error" ? brand.error : brand.ink,
      }}
    >
      {label}
    </span>
  );
}

function ResultCard({ result, onReset }: { result: Result; onReset: () => void }) {
  return (
    <div className="mt-6 rounded-[28px] px-5 py-6" style={{ backgroundColor: "#F8FAF7", border: "1px solid #E5E7EB" }}>
      <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Listo</p>
      <h2 className="font-display mt-1 text-xl font-bold">Importación aplicada</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <StatCard label="Productos creados" value={result.created} color={brand.green} hint="Nuevos en el catálogo" />
        <StatCard label="Actualizados" value={result.updated} color={brand.orange} hint="Datos reemplazados" />
      </div>
      <p className="mt-3 text-sm text-brand-muted">{result.unchanged} quedaron sin cambios</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {result.created > 0 ? (
          <Link
            href="/admin/catalogo/imagenes"
            className="inline-flex items-center rounded-full px-5 text-sm font-bold text-white"
            style={{ backgroundColor: brand.orange, minHeight: 44 }}
          >
            Ir a fotos del catálogo
          </Link>
        ) : null}
        <button
          type="button"
          onClick={onReset}
          className="rounded-full px-5 text-sm font-bold"
          style={{ backgroundColor: "#FFFFFF", minHeight: 44, border: "1px solid #E5E7EB" }}
        >
          Importar otro archivo
        </button>
      </div>
      {result.missing.length > 0 ? (
        <div className="mt-6">
          <Section title={`No encontrados en este import (revisar si se descontinuaron) · ${result.missing.length}`}>
            <p className="px-3 pb-2 text-sm text-brand-muted">No se tocaron. Revisa si ya no se venden.</p>
            <MissingList items={result.missing} />
          </Section>
        </div>
      ) : null}
    </div>
  );
}

function PreviewLists({ preview }: { preview: ImportPreview }) {
  return (
    <div className="mt-6 space-y-4">
      <details className="group overflow-hidden rounded-[24px] border" style={{ borderColor: "#E5E7EB" }} open>
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-bold [&::-webkit-details-marker]:hidden" style={{ backgroundColor: "#F8FAF7" }}>
          <span className="mr-2 inline-block text-brand-muted transition group-open:rotate-90">▸</span>
          Actualizaciones ({preview.updated.length})
        </summary>
        {preview.updated.length === 0 ? (
          <Empty text="Ningún producto existente cambia con este archivo." />
        ) : (
          <ul className="divide-y" style={{ borderColor: "#F3F4F6" }}>
            {preview.updated.slice(0, PREVIEW_LIMIT).map((item) => (
              <li key={item.codigo} className="px-4 py-3">
                <p className="text-sm font-bold">
                  {item.nombre}{" "}
                  <span className="font-mono text-xs font-semibold text-brand-muted">{item.codigo}</span>
                </p>
                <ul className="mt-1 space-y-0.5 text-sm">
                  {item.changes.map((change) => (
                    <li key={change.field}>
                      <span className="font-semibold">{FIELD_LABEL[change.field]}:</span>{" "}
                      <span className="text-brand-muted">{change.fromLabel}</span>
                      {" → "}
                      <span className="font-semibold">{change.toLabel}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
        <More count={preview.updated.length} />
      </details>

      <details className="group overflow-hidden rounded-[24px] border" style={{ borderColor: "#E5E7EB" }}>
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-bold [&::-webkit-details-marker]:hidden" style={{ backgroundColor: "#F8FAF7" }}>
          <span className="mr-2 inline-block text-brand-muted transition group-open:rotate-90">▸</span>
          Nuevos ({preview.created.length})
        </summary>
        {preview.created.length === 0 ? (
          <Empty text="No hay productos nuevos en este archivo." />
        ) : (
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="text-xs font-bold uppercase tracking-wide text-brand-muted">
                <th className="px-4 py-2">Código</th>
                <th className="px-4 py-2">Nombre</th>
                <th className="px-4 py-2">Marca</th>
                <th className="px-4 py-2">Categoría</th>
                <th className="px-4 py-2 text-right">Precio</th>
              </tr>
            </thead>
            <tbody>
              {preview.created.slice(0, PREVIEW_LIMIT).map((item) => (
                <tr key={item.codigo} className="border-t" style={{ borderColor: "#F3F4F6" }}>
                  <td className="px-4 py-2 font-mono text-xs">{item.codigo}</td>
                  <td className="px-4 py-2 font-semibold">{item.nombre}</td>
                  <td className="px-4 py-2">{item.marca || "—"}</td>
                  <td className="px-4 py-2">{item.categoria}</td>
                  <td className="px-4 py-2 text-right font-bold">{formatPrice(item.precio)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <More count={preview.created.length} />
      </details>

      {preview.invalid.length > 0 ? (
        <details className="group overflow-hidden rounded-[24px] border" style={{ borderColor: "#E5E7EB" }} open>
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-bold [&::-webkit-details-marker]:hidden" style={{ backgroundColor: "#FEF2F2" }}>
            <span className="mr-2 inline-block text-brand-muted transition group-open:rotate-90">▸</span>
            Filas con error ({preview.invalid.length})
          </summary>
          <ul className="space-y-1 px-4 py-3 text-sm">
            {preview.invalid.slice(0, PREVIEW_LIMIT).map((item) => (
              <li key={`${item.row}-${item.codigo}`}>
                Fila {item.row}
                {item.codigo ? ` (${item.codigo})` : ""}: {item.reason}
              </li>
            ))}
          </ul>
          <More count={preview.invalid.length} />
        </details>
      ) : null}

      <details className="group overflow-hidden rounded-[24px] border" style={{ borderColor: "#E5E7EB" }} open={preview.missing.length > 0}>
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-bold [&::-webkit-details-marker]:hidden" style={{ backgroundColor: "#F8FAF7" }}>
          <span className="mr-2 inline-block text-brand-muted transition group-open:rotate-90">▸</span>
          No encontrados en este import (revisar si se descontinuaron) · {preview.missing.length}
        </summary>
        <p className="px-4 pb-2 text-sm text-brand-muted">No se van a borrar ni desactivar.</p>
        {preview.missing.length === 0 ? (
          <Empty text="Todos los productos con código están en el archivo." />
        ) : (
          <MissingList items={preview.missing} />
        )}
      </details>
    </div>
  );
}

function MissingList({ items }: { items: ImportPreview["missing"] }) {
  return (
    <ul className="max-h-56 overflow-auto px-4 py-2 text-sm">
      {items.slice(0, PREVIEW_LIMIT).map((item) => (
        <li key={item.id} className="py-1">
          {item.nombre}{" "}
          {item.codigo ? (
            <span className="font-mono text-xs text-brand-muted">{item.codigo}</span>
          ) : (
            <span className="text-xs text-brand-muted">(sin código Odoo)</span>
          )}
        </li>
      ))}
      {items.length > PREVIEW_LIMIT ? (
        <li className="py-1 text-brand-muted">y {items.length - PREVIEW_LIMIT} más</li>
      ) : null}
    </ul>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[24px] border" style={{ borderColor: "#E5E7EB" }}>
      <h2 className="px-4 py-3 text-sm font-bold" style={{ backgroundColor: "#FFFFFF" }}>
        {title}
      </h2>
      <div>{children}</div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-4 py-4 text-sm text-brand-muted">{text}</p>;
}

function More({ count }: { count: number }) {
  if (count <= PREVIEW_LIMIT) {
    return null;
  }
  return (
    <p className="px-4 py-2 text-xs text-brand-muted">
      Mostrando {PREVIEW_LIMIT} de {count}
    </p>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024;
    return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function UploadIcon({ accent }: { accent: string }) {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect x="8" y="10" width="32" height="28" rx="6" stroke={accent} strokeWidth="2" />
      <path d="M24 30V18" stroke={accent} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M18.5 22.5 24 17l5.5 5.5" stroke={accent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 3.5h7.2L19 8.4V20a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 6 20V5a1.5 1.5 0 0 1 1-1.5Z"
        stroke={brand.green}
        strokeWidth="1.6"
      />
      <path d="M14 3.5V8h5" stroke={brand.green} strokeWidth="1.6" />
    </svg>
  );
}
