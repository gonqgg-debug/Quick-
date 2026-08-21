"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/lib/money";
import { brand } from "@/lib/theme";
import {
  CATALOG_PRODUCTS_PAGE_SIZE,
  catalogProductsQueryString,
  isUncategorized,
  shortOdooCode,
  type AdminCatalogProduct,
  type AdminCatalogProductList,
} from "@/lib/admin-catalog-products-shared";

const ESTADO_FILTERS: Array<{ id: "todos" | "activo" | "inactivo"; label: string }> = [
  { id: "todos", label: "Todos" },
  { id: "activo", label: "Activos" },
  { id: "inactivo", label: "Inactivos" },
];

const BATCH_CONFIRM = 20;

type PatchPayload = {
  nombre?: string;
  marca?: string | null;
  categoria?: string;
  precio?: number;
  activo?: boolean;
};

export function AdminCatalogProducts() {
  const router = useRouter();
  const [products, setProducts] = useState<AdminCatalogProduct[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [batchBusy, setBatchBusy] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [batchCategory, setBatchCategory] = useState("");
  const [batchNewCategory, setBatchNewCategory] = useState("");

  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [categoria, setCategoria] = useState("");
  const [estado, setEstado] = useState<"todos" | "activo" | "inactivo">("todos");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setSelected([]);
  }, [query, categoria, estado]);

  const queryString = useMemo(
    () => catalogProductsQueryString({ q: query, categoria, estado, page }),
    [query, categoria, estado, page]
  );
  const filterQueryString = useMemo(
    () => catalogProductsQueryString({ q: query, categoria, estado, page: 1 }),
    [query, categoria, estado]
  );

  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/catalogo/productos?${queryString}`, { credentials: "include" });
    if (response.status === 401) {
      router.replace("/admin/login");
      return;
    }
    const body = (await response.json().catch(() => null)) as (AdminCatalogProductList & { error?: string }) | null;
    if (!response.ok) {
      throw new Error(body?.error || "No pudimos cargar los productos");
    }
    setProducts(body?.products ?? []);
    setTotal(body?.total ?? 0);
    setCategories(body?.categories ?? []);
  }, [queryString, router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await load();
        if (!cancelled) {
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Error al cargar");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  function rememberCategory(value: string) {
    const next = value.trim();
    if (!next || isUncategorized(next)) {
      return;
    }
    setCategories((current) =>
      current.includes(next) ? current : [...current, next].sort((left, right) => left.localeCompare(right, "es"))
    );
  }

  async function patchProduct(id: string, payload: PatchPayload) {
    const response = await fetch("/api/admin/catalogo/productos", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...payload }),
    });
    if (response.status === 401) {
      router.replace("/admin/login");
      throw new Error("Sesión expirada");
    }
    const body = (await response.json().catch(() => null)) as { product?: AdminCatalogProduct; error?: string } | null;
    if (!response.ok || !body?.product) {
      throw new Error(body?.error || "No pudimos guardar");
    }
    if (payload.categoria) {
      rememberCategory(payload.categoria);
    }
    setProducts((current) => {
      const next = current.map((item) => (item.id === id ? body.product! : item));
      if (estado === "activo" && !body.product!.activo) {
        return next.filter((item) => item.id !== id);
      }
      if (estado === "inactivo" && body.product!.activo) {
        return next.filter((item) => item.id !== id);
      }
      return next;
    });
    return body.product;
  }

  async function runBatch(payload: { activo?: boolean; categoria?: string }) {
    if (selected.length === 0) {
      return;
    }
    const needsConfirm =
      selected.length > BATCH_CONFIRM && (payload.activo !== undefined || Boolean(payload.categoria));
    if (needsConfirm) {
      const action =
        payload.activo === true ? "activar" : payload.activo === false ? "desactivar" : "cambiar de categoría";
      if (!window.confirm(`Vas a ${action} ${selected.length} productos. ¿Continuar?`)) {
        return;
      }
    }
    setBatchBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/catalogo/productos/batch", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selected, ...payload }),
      });
      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(body?.error || "No pudimos actualizar los seleccionados");
      }
      if (payload.categoria) {
        rememberCategory(payload.categoria);
      }
      setSelected([]);
      setBatchCategory("");
      setBatchNewCategory("");
      await load();
    } catch (batchError) {
      setError(batchError instanceof Error ? batchError.message : "Error en la acción masiva");
    } finally {
      setBatchBusy(false);
    }
  }

  async function exportWorkbook(ids?: string[]) {
    setExporting(true);
    setError(null);
    try {
      const response = ids
        ? await fetch("/api/admin/catalogo/productos/export", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids }),
          })
        : await fetch(`/api/admin/catalogo/productos/export?${filterQueryString}`, { credentials: "include" });
      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "No pudimos exportar");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `catalogo-productos-${stamp}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Error al exportar");
    } finally {
      setExporting(false);
    }
  }

  const pageIds = products.map((product) => product.id);
  const selectedOnPage = pageIds.filter((id) => selected.includes(id));
  const allPageSelected = pageIds.length > 0 && selectedOnPage.length === pageIds.length;
  const somePageSelected = selectedOnPage.length > 0 && !allPageSelected;
  const usableCategories = categories.filter((item) => !isUncategorized(item));
  const pageCount = Math.max(1, Math.ceil(total / CATALOG_PRODUCTS_PAGE_SIZE));
  const fromRow = total === 0 ? 0 : (page - 1) * CATALOG_PRODUCTS_PAGE_SIZE + 1;
  const toRow = Math.min(page * CATALOG_PRODUCTS_PAGE_SIZE, total);

  function togglePage(checked: boolean) {
    setSelected((current) => {
      if (checked) {
        return Array.from(new Set([...current, ...pageIds]));
      }
      return current.filter((id) => !pageIds.includes(id));
    });
  }

  function toggleRow(id: string, checked: boolean) {
    setSelected((current) => (checked ? Array.from(new Set([...current, id])) : current.filter((item) => item !== id)));
  }

  const assignCategory = batchCategory === "__new__" ? batchNewCategory.trim() : batchCategory;

  return (
    <div className={selected.length > 0 ? "pb-24" : undefined}>
      <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Catálogo</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Productos</h1>
          <p className="mt-1 max-w-xl text-sm text-brand-muted">
            Click en nombre, marca, categoría o precio para editar. El catálogo público solo muestra productos activos.
          </p>
        </div>
        <button
          type="button"
          disabled={exporting || loading || total === 0}
          onClick={() => void exportWorkbook()}
          className="rounded-full px-4 text-sm font-bold disabled:opacity-40"
          style={{ minHeight: 44, backgroundColor: "#F3F4F6" }}
        >
          {exporting ? "Exportando..." : "Exportar a Excel"}
        </button>
      </div>

      <div className="mt-5 space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-xs font-bold text-brand-muted">
            Buscar
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Nombre, marca o código"
              className="mt-1 h-11 w-full rounded-xl border bg-white px-3 text-sm font-semibold"
              style={{ borderColor: "#E5E7EB", color: brand.ink }}
            />
          </label>
          <label className="block text-xs font-bold text-brand-muted">
            Categoría
            <select
              value={categoria}
              onChange={(event) => {
                setCategoria(event.target.value);
                setPage(1);
              }}
              className="mt-1 h-11 w-full rounded-xl border bg-white px-3 text-sm font-semibold"
              style={{ borderColor: "#E5E7EB", color: brand.ink }}
            >
              <option value="">Todas</option>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {isUncategorized(item) ? "Sin categoría (All)" : item}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar por estado">
          {ESTADO_FILTERS.map((filter) => {
            const active = estado === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setEstado(filter.id);
                  setPage(1);
                }}
                className="rounded-full px-3 text-sm font-bold"
                style={{
                  minHeight: 40,
                  backgroundColor: active ? brand.green : "#F3F4F6",
                  color: active ? "#FFFFFF" : "#4B5563",
                }}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6">
        {error ? (
          <p className="mb-3 rounded-2xl px-3 py-2 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="h-64 animate-pulse rounded-[24px] bg-gray-100" />
        ) : products.length === 0 ? (
          <div className="rounded-[28px] px-5 py-14 text-center" style={{ backgroundColor: "#F8FAF7" }}>
            <p className="font-display text-xl font-bold">No hay productos con esos filtros</p>
            <p className="mt-2 text-sm text-brand-muted">Prueba otro texto, categoría o estado.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-[24px] border" style={{ borderColor: "#E5E7EB" }}>
              <table className="w-full min-w-[1080px] text-left text-sm">
                <thead>
                  <tr
                    className="text-xs font-bold uppercase tracking-wide text-brand-muted"
                    style={{ backgroundColor: "#F8FAF7" }}
                  >
                    <th className="w-10 px-3 py-3">
                      <HeaderCheckbox
                        checked={allPageSelected}
                        indeterminate={somePageSelected}
                        onChange={togglePage}
                      />
                    </th>
                    <th className="px-3 py-3">Foto</th>
                    <th className="px-3 py-3">Nombre</th>
                    <th className="px-3 py-3">Marca</th>
                    <th className="px-3 py-3">Categoría</th>
                    <th className="whitespace-nowrap px-3 py-3 text-right">Precio</th>
                    <th className="whitespace-nowrap px-3 py-3">Cód. Odoo</th>
                    <th className="whitespace-nowrap px-3 py-3">Barras</th>
                    <th className="px-3 py-3">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product, index) => (
                    <ProductRow
                      key={product.id}
                      product={product}
                      zebra={index % 2 === 1}
                      selected={selected.includes(product.id)}
                      categories={usableCategories}
                      onToggle={(checked) => toggleRow(product.id, checked)}
                      onPatch={patchProduct}
                      onError={setError}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-brand-muted">
                {fromRow}–{toRow} de {total.toLocaleString("es-DO")}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="rounded-full px-4 text-sm font-bold disabled:opacity-40"
                  style={{ minHeight: 40, backgroundColor: "#F3F4F6" }}
                >
                  Anterior
                </button>
                <p className="text-sm font-semibold tabular-nums">
                  {page} / {pageCount}
                </p>
                <button
                  type="button"
                  disabled={page >= pageCount}
                  onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                  className="rounded-full px-4 text-sm font-bold disabled:opacity-40"
                  style={{ minHeight: 40, backgroundColor: "#F3F4F6" }}
                >
                  Siguiente
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {selected.length > 0 ? (
        <div
          className="fixed bottom-4 left-4 right-4 z-20 mx-auto flex max-w-5xl flex-wrap items-center gap-2 rounded-[24px] px-4 py-3 shadow-lg md:left-[248px]"
          style={{ backgroundColor: brand.ink, color: "#FFFFFF" }}
        >
          <p className="mr-2 text-sm font-bold">{selected.length} seleccionados</p>
          <button
            type="button"
            disabled={batchBusy}
            onClick={() => void runBatch({ activo: true })}
            className="rounded-full px-3 text-sm font-bold disabled:opacity-40"
            style={{ minHeight: 36, backgroundColor: brand.green, color: "#FFFFFF" }}
          >
            Activar
          </button>
          <button
            type="button"
            disabled={batchBusy}
            onClick={() => void runBatch({ activo: false })}
            className="rounded-full px-3 text-sm font-bold disabled:opacity-40"
            style={{ minHeight: 36, backgroundColor: "#FFFFFF", color: brand.ink }}
          >
            Desactivar
          </button>
          <button
            type="button"
            disabled={exporting || batchBusy}
            onClick={() => void exportWorkbook(selected)}
            className="rounded-full px-3 text-sm font-bold disabled:opacity-40"
            style={{ minHeight: 36, backgroundColor: "#374151", color: "#FFFFFF" }}
          >
            Exportar seleccionados
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={batchCategory}
              disabled={batchBusy}
              onChange={(event) => setBatchCategory(event.target.value)}
              className="h-9 rounded-full px-3 text-sm font-semibold"
              style={{ color: brand.ink }}
            >
              <option value="">Asignar categoría</option>
              {usableCategories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
              <option value="__new__">Nueva categoría…</option>
            </select>
            {batchCategory === "__new__" ? (
              <input
                value={batchNewCategory}
                disabled={batchBusy}
                onChange={(event) => setBatchNewCategory(event.target.value)}
                placeholder="Nombre de la categoría"
                className="h-9 rounded-full px-3 text-sm font-semibold"
                style={{ color: brand.ink }}
              />
            ) : null}
            <button
              type="button"
              disabled={batchBusy || !assignCategory}
              onClick={() => void runBatch({ categoria: assignCategory })}
              className="rounded-full px-3 text-sm font-bold disabled:opacity-40"
              style={{ minHeight: 36, backgroundColor: brand.orange, color: "#FFFFFF" }}
            >
              Aplicar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function HeaderCheckbox({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: (checked: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      aria-label="Seleccionar todos los visibles"
      className="h-4 w-4 accent-[#7EB341]"
    />
  );
}

function ProductRow({
  product,
  zebra,
  selected,
  categories,
  onToggle,
  onPatch,
  onError,
}: {
  product: AdminCatalogProduct;
  zebra: boolean;
  selected: boolean;
  categories: string[];
  onToggle: (checked: boolean) => void;
  onPatch: (id: string, payload: PatchPayload) => Promise<AdminCatalogProduct>;
  onError: (message: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const missingCategory = isUncategorized(product.categoria);

  async function toggleActivo() {
    setBusy(true);
    try {
      await onPatch(product.id, { activo: !product.activo });
      onError(null);
    } catch (toggleError) {
      onError(toggleError instanceof Error ? toggleError.message : "No pudimos cambiar el estado");
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr
      className="border-t"
      style={{
        borderColor: "#F3F4F6",
        backgroundColor: selected ? "#F0F7E8" : zebra ? "#FAFBFA" : "#FFFFFF",
        opacity: product.activo ? 1 : 0.72,
      }}
    >
      <td className="px-3 py-1.5">
        <input
          type="checkbox"
          checked={selected}
          onChange={(event) => onToggle(event.target.checked)}
          aria-label={`Seleccionar ${product.nombre}`}
          className="h-4 w-4 accent-[#7EB341]"
        />
      </td>
      <td className="px-3 py-1.5">
        <div
          className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg"
          style={{ backgroundColor: "#F3F4F6" }}
        >
          {product.fotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.fotoUrl} alt="" className="h-full w-full object-contain" />
          ) : (
            <span className="text-[10px] text-brand-muted">—</span>
          )}
        </div>
      </td>
      <td className="max-w-[240px] px-3 py-1.5 font-semibold leading-tight">
        <InlineText
          value={product.nombre}
          align="left"
          onSave={async (next) => {
            await onPatch(product.id, { nombre: next });
          }}
          onError={onError}
        />
      </td>
      <td className="whitespace-nowrap px-3 py-1.5">
        <InlineText
          value={product.marca || ""}
          emptyLabel="—"
          muted
          allowEmpty
          onSave={async (next) => {
            await onPatch(product.id, { marca: next || null });
          }}
          onError={onError}
        />
      </td>
      <td className="whitespace-nowrap px-3 py-1.5">
        <InlineCategory
          value={product.categoria}
          missing={missingCategory}
          categories={categories}
          onSave={async (next) => {
            await onPatch(product.id, { categoria: next });
          }}
          onError={onError}
        />
      </td>
      <td className="whitespace-nowrap px-3 py-1.5 text-right">
        <InlinePrice
          value={product.precio}
          onSave={async (next) => {
            await onPatch(product.id, { precio: next });
          }}
          onError={onError}
        />
      </td>
      <td className="whitespace-nowrap px-3 py-1.5 font-mono text-xs text-brand-muted">
        {product.codigoOdoo ? (
          <span title={product.codigoOdoo}>{shortOdooCode(product.codigoOdoo)}</span>
        ) : (
          "—"
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-1.5 font-mono text-xs text-brand-muted">{product.codigoBarras || "—"}</td>
      <td className="px-3 py-1.5">
        <button
          type="button"
          role="switch"
          aria-checked={product.activo}
          disabled={busy}
          onClick={() => void toggleActivo()}
          className="inline-flex items-center gap-2 disabled:opacity-40"
        >
          <span
            className="relative inline-block h-5 w-9 rounded-full"
            style={{ backgroundColor: product.activo ? brand.green : "#D1D5DB" }}
          >
            <span
              className="absolute top-0.5 h-4 w-4 rounded-full bg-white"
              style={{ left: product.activo ? 16 : 2 }}
            />
          </span>
          <span className="text-xs font-bold" style={{ color: product.activo ? brand.green : brand.muted }}>
            {product.activo ? "Activo" : "Inactivo"}
          </span>
        </button>
      </td>
    </tr>
  );
}

function InlineText({
  value,
  emptyLabel = "",
  muted = false,
  allowEmpty = false,
  align = "left",
  onSave,
  onError,
}: {
  value: string;
  emptyLabel?: string;
  muted?: boolean;
  allowEmpty?: boolean;
  align?: "left" | "right";
  onSave: (next: string) => Promise<void>;
  onError: (message: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saved, setSaved] = useState(false);
  const savingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!editing) {
      setDraft(value);
    }
  }, [value, editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  async function commit() {
    if (savingRef.current) {
      return;
    }
    const next = draft.trim();
    if (!allowEmpty && !next) {
      onError("Ese campo no puede quedar vacío");
      setDraft(value);
      setEditing(false);
      return;
    }
    if (next === value.trim()) {
      setEditing(false);
      return;
    }
    savingRef.current = true;
    try {
      await onSave(next);
      onError(null);
      setEditing(false);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1400);
    } catch (saveError) {
      onError(saveError instanceof Error ? saveError.message : "No pudimos guardar");
      setDraft(value);
      setEditing(false);
    } finally {
      savingRef.current = false;
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void commit();
          }
          if (event.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        className="h-8 w-full min-w-[8rem] rounded-lg border px-2 text-sm font-semibold"
        style={{ borderColor: brand.green, textAlign: align }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="inline-flex max-w-full items-center gap-1 text-left"
      title="Editar"
    >
      <span className={muted ? "text-brand-muted" : undefined}>{value || emptyLabel || "—"}</span>
      {saved ? <span style={{ color: brand.green }}>✓</span> : null}
    </button>
  );
}

function InlinePrice({
  value,
  onSave,
  onError,
}: {
  value: number;
  onSave: (next: number) => Promise<void>;
  onError: (message: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [saved, setSaved] = useState(false);
  const savingRef = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!editing) {
      setDraft(String(value));
    }
  }, [value, editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  async function commit() {
    if (savingRef.current) {
      return;
    }
    const parsed = Number(draft.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < 0) {
      onError("Precio inválido");
      setDraft(String(value));
      setEditing(false);
      return;
    }
    const next = Math.round(parsed * 100) / 100;
    if (next === value) {
      setEditing(false);
      return;
    }
    savingRef.current = true;
    try {
      await onSave(next);
      onError(null);
      setEditing(false);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1400);
    } catch (saveError) {
      onError(saveError instanceof Error ? saveError.message : "No pudimos guardar el precio");
      setDraft(String(value));
      setEditing(false);
    } finally {
      savingRef.current = false;
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        inputMode="decimal"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void commit();
          }
          if (event.key === "Escape") {
            setDraft(String(value));
            setEditing(false);
          }
        }}
        className="h-8 w-[7.5rem] rounded-lg border px-2 text-right text-sm font-bold tabular-nums"
        style={{ borderColor: brand.green }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="inline-flex items-center justify-end gap-1 font-bold tabular-nums"
      title="Editar precio"
    >
      {formatPrice(value)}
      {saved ? <span style={{ color: brand.green }}>✓</span> : null}
    </button>
  );
}

function InlineCategory({
  value,
  missing,
  categories,
  onSave,
  onError,
}: {
  value: string;
  missing: boolean;
  categories: string[];
  onSave: (next: string) => Promise<void>;
  onError: (message: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [mode, setMode] = useState<"select" | "new">("select");
  const [draft, setDraft] = useState(missing ? "" : value);
  const [saved, setSaved] = useState(false);
  const savingRef = useRef(false);
  const selectRef = useRef<HTMLSelectElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!editing) {
      setDraft(missing ? "" : value);
      setMode("select");
    }
  }, [value, missing, editing]);

  useEffect(() => {
    if (editing && mode === "select") {
      selectRef.current?.focus();
    }
    if (editing && mode === "new") {
      inputRef.current?.focus();
    }
  }, [editing, mode]);

  async function commit(nextRaw: string) {
    if (savingRef.current) {
      return;
    }
    const next = nextRaw.trim();
    if (!next) {
      onError("La categoría no puede quedar vacía");
      setEditing(false);
      return;
    }
    if (!missing && next === value) {
      setEditing(false);
      return;
    }
    savingRef.current = true;
    try {
      await onSave(next);
      onError(null);
      setEditing(false);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1400);
    } catch (saveError) {
      onError(saveError instanceof Error ? saveError.message : "No pudimos guardar la categoría");
      setEditing(false);
    } finally {
      savingRef.current = false;
    }
  }

  if (editing && mode === "new") {
    return (
      <input
        ref={inputRef}
        value={draft}
        placeholder="Nueva categoría"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void commit(draft)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void commit(draft);
          }
          if (event.key === "Escape") {
            setEditing(false);
          }
        }}
        className="h-8 min-w-[9rem] rounded-lg border px-2 text-sm font-semibold"
        style={{ borderColor: brand.green }}
      />
    );
  }

  if (editing) {
    return (
      <select
        ref={selectRef}
        value={missing ? "" : value}
        onChange={(event) => {
          if (event.target.value === "__new__") {
            setMode("new");
            setDraft("");
            return;
          }
          void commit(event.target.value);
        }}
        onBlur={() => {
          if (mode === "select") {
            setEditing(false);
          }
        }}
        className="h-8 min-w-[9rem] rounded-lg border px-2 text-sm font-semibold"
        style={{ borderColor: brand.green }}
      >
        <option value="" disabled>
          Elegir…
        </option>
        {categories.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
        <option value="__new__">Nueva categoría…</option>
      </select>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="inline-flex items-center gap-1 text-left"
      title="Editar categoría"
    >
      {missing ? (
        <span className="inline-flex items-center gap-1 font-semibold" style={{ color: brand.orange }}>
          <AlertDot />
          Sin categoría
        </span>
      ) : (
        <span className="text-brand-muted">{value}</span>
      )}
      {saved ? <span style={{ color: brand.green }}>✓</span> : null}
    </button>
  );
}

function AlertDot() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6 3.4v3.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="6" cy="8.4" r="0.6" fill="currentColor" />
    </svg>
  );
}
