"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  const [barMounted, setBarMounted] = useState(false);
  const [barOpen, setBarOpen] = useState(false);
  const [selectingAll, setSelectingAll] = useState(false);
  const lastSelectedCount = useRef(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const dirtyRef = useRef(false);
  const savedTimer = useRef(0);

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
    dirtyRef.current = false;
    setEditingId(null);
  }, [query, categoria, estado]);

  useEffect(() => {
    let cancelled = false;
    if (selected.length > 0) {
      setBarMounted(true);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (!cancelled) {
            setBarOpen(true);
          }
        });
      });
      return () => {
        cancelled = true;
      };
    }
    setBarOpen(false);
    const timer = window.setTimeout(() => {
      if (!cancelled) {
        setBarMounted(false);
      }
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [selected.length]);

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

  function confirmDiscardIfNeeded(): boolean {
    if (editingId && dirtyRef.current) {
      return window.confirm("Hay cambios sin guardar en esta fila. ¿Descartarlos?");
    }
    return true;
  }

  function startEdit(id: string) {
    if (id === editingId) {
      return;
    }
    if (!confirmDiscardIfNeeded()) {
      return;
    }
    dirtyRef.current = false;
    setEditingId(id);
  }

  function cancelEdit() {
    dirtyRef.current = false;
    setEditingId(null);
  }

  function finishSave(id: string) {
    dirtyRef.current = false;
    setEditingId(null);
    setSavedId(id);
    window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setSavedId(null), 1400);
  }

  function changePage(next: number) {
    if (!confirmDiscardIfNeeded()) {
      return;
    }
    dirtyRef.current = false;
    setEditingId(null);
    setPage(next);
  }

  const assignCategory = batchCategory === "__new__" ? batchNewCategory.trim() : batchCategory;
  const canSelectMatching = allPageSelected && selected.length === pageIds.length && total > pageIds.length;
  if (selected.length > 0) {
    lastSelectedCount.current = selected.length;
  }

  async function selectMatchingFilter() {
    setSelectingAll(true);
    setError(null);
    try {
      const params = filterQueryString ? `${filterQueryString}&ids=1` : "ids=1";
      const response = await fetch(`/api/admin/catalogo/productos?${params}`, { credentials: "include" });
      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const body = (await response.json().catch(() => null)) as { ids?: string[]; error?: string } | null;
      if (!response.ok || !Array.isArray(body?.ids)) {
        throw new Error(body?.error || "No pudimos seleccionar todos los del filtro");
      }
      setSelected(body.ids);
    } catch (selectError) {
      setError(selectError instanceof Error ? selectError.message : "Error al seleccionar");
    } finally {
      setSelectingAll(false);
    }
  }

  return (
    <div>
      <style>{`
        .product-row:hover { background-color: #F9FAFB !important; }
        .product-row .row-edit-btn { opacity: 0.32; }
        .product-row:hover .row-edit-btn,
        .product-row:focus-within .row-edit-btn { opacity: 1; }
        .product-row[data-selected="true"] { background-color: rgba(126, 179, 65, 0.08) !important; }
        .product-row[data-selected="true"]:hover { background-color: rgba(126, 179, 65, 0.12) !important; }
        .catalog-batch-dock {
          position: fixed;
          left: 1rem;
          right: 1rem;
          bottom: 0;
          z-index: 40;
          padding-bottom: 1rem;
          pointer-events: none;
        }
        @media (min-width: 768px) {
          .catalog-batch-dock {
            left: calc(232px + 1.5rem);
            right: 1.5rem;
          }
        }
        .catalog-batch-panel {
          pointer-events: auto;
          transform: translateY(120%);
          opacity: 0;
          transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease;
        }
        .catalog-batch-dock.is-open .catalog-batch-panel {
          transform: translateY(0);
          opacity: 1;
        }
        @media (prefers-reduced-motion: reduce) {
          .catalog-batch-panel {
            transform: none;
            transition: opacity 160ms ease;
          }
        }
      `}</style>
      <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Catálogo</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Productos</h1>
          <p className="mt-1 max-w-xl text-sm text-brand-muted">
            Usa el lápiz para editar nombre, marca, categoría o precio. El catálogo público solo muestra productos
            activos.
          </p>
        </div>
        <button
          type="button"
          disabled={exporting || loading || total === 0}
          onClick={() => void exportWorkbook()}
          className="inline-flex items-center gap-2 rounded-full px-4 text-sm font-bold disabled:opacity-40"
          style={{ minHeight: 44, backgroundColor: "#F3F4F6", color: brand.ink }}
        >
          <DownloadIcon />
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
              className="mt-1 h-11 w-full rounded-xl border bg-white px-3 text-sm font-semibold outline-none focus:border-[#7EB341]"
              style={{ borderColor: "#E5E7EB", color: brand.ink }}
            />
          </label>
          <label className="block text-xs font-bold text-brand-muted">
            Categoría
            <span className="relative mt-1 block">
              <select
                value={categoria}
                onChange={(event) => {
                  if (!confirmDiscardIfNeeded()) {
                    return;
                  }
                  dirtyRef.current = false;
                  setEditingId(null);
                  setCategoria(event.target.value);
                  setPage(1);
                }}
                className="h-11 w-full appearance-none rounded-xl border bg-white px-3 pr-9 text-sm font-semibold outline-none focus:border-[#7EB341]"
                style={{ borderColor: "#E5E7EB", color: brand.ink }}
              >
                <option value="">Todas</option>
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {isUncategorized(item) ? "Sin categoría (All)" : item}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-brand-muted">
                <ChevronIcon />
              </span>
            </span>
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
                  if (!confirmDiscardIfNeeded()) {
                    return;
                  }
                  dirtyRef.current = false;
                  setEditingId(null);
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

      <div className="mt-6" style={{ paddingBottom: barMounted ? 168 : undefined }}>
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
          <div>
            <div className="overflow-x-auto rounded-[24px] border" style={{ borderColor: "#E5E7EB" }}>
              <table className="w-full min-w-[1180px] text-left text-sm">
                <thead>
                  <tr
                    className="text-xs font-bold uppercase tracking-wide text-brand-muted"
                    style={{ backgroundColor: "#F8FAF7" }}
                  >
                    <th className="w-10 px-3 py-3">
                      <BrandCheckbox
                        checked={allPageSelected}
                        indeterminate={somePageSelected}
                        onChange={togglePage}
                        label="Seleccionar todos los visibles"
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
                    <th className="w-28 px-3 py-3">
                      <span className="sr-only">Editar</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product, index) => (
                    <ProductRow
                      key={product.id}
                      product={product}
                      zebra={index % 2 === 1}
                      selected={selected.includes(product.id)}
                      editing={editingId === product.id}
                      savedFlash={savedId === product.id}
                      categories={usableCategories}
                      onToggle={(checked) => toggleRow(product.id, checked)}
                      onStartEdit={() => startEdit(product.id)}
                      onCancelEdit={cancelEdit}
                      onDirtyChange={(dirty) => {
                        if (editingId === product.id) {
                          dirtyRef.current = dirty;
                        }
                      }}
                      onSaved={() => finishSave(product.id)}
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
                  onClick={() => changePage(Math.max(1, page - 1))}
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
                  onClick={() => changePage(Math.min(pageCount, page + 1))}
                  className="rounded-full px-4 text-sm font-bold disabled:opacity-40"
                  style={{ minHeight: 40, backgroundColor: "#F3F4F6" }}
                >
                  Siguiente
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {barMounted && typeof document !== "undefined"
        ? createPortal(
            <div className={`catalog-batch-dock${barOpen ? " is-open" : ""}`} role="region" aria-label="Acciones de selección">
              <div
                className="catalog-batch-panel flex flex-col gap-2 rounded-[24px] border border-t px-4 py-3"
                style={{
                  backgroundColor: "#FFFFFF",
                  borderColor: "#E5E7EB",
                  boxShadow: "0 -16px 40px rgba(26, 26, 26, 0.16)",
                  color: brand.ink,
                }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="mr-1 text-sm font-bold">
                    {selected.length || lastSelectedCount.current} seleccionados
                  </p>
                  <button
                    type="button"
                    disabled={batchBusy}
                    onClick={() => void runBatch({ activo: true })}
                    className="rounded-full px-3.5 text-sm font-bold text-white disabled:opacity-40"
                    style={{ minHeight: 40, backgroundColor: brand.green }}
                  >
                    Activar
                  </button>
                  <button
                    type="button"
                    disabled={batchBusy}
                    onClick={() => void runBatch({ activo: false })}
                    className="rounded-full border px-3.5 text-sm font-bold disabled:opacity-40"
                    style={{ minHeight: 40, borderColor: "#FECACA", backgroundColor: "#FFF7F7", color: "#B42318" }}
                  >
                    Desactivar
                  </button>
                  <button
                    type="button"
                    disabled={exporting || batchBusy}
                    onClick={() => void exportWorkbook(selected)}
                    className="inline-flex items-center gap-1.5 rounded-full border px-3.5 text-sm font-bold disabled:opacity-40"
                    style={{ minHeight: 40, borderColor: "#E5E7EB", backgroundColor: "#FFFFFF", color: brand.ink }}
                  >
                    <DownloadIcon />
                    Exportar seleccionados
                  </button>
                  <div
                    className="flex min-h-10 items-stretch overflow-hidden rounded-full border"
                    style={{ borderColor: "#E5E7EB" }}
                  >
                    <select
                      value={batchCategory}
                      disabled={batchBusy}
                      onChange={(event) => setBatchCategory(event.target.value)}
                      className="h-10 min-w-[10rem] border-0 bg-white px-3 text-sm font-semibold outline-none"
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
                        placeholder="Nombre"
                        className="h-10 w-36 border-l bg-white px-3 text-sm font-semibold outline-none"
                        style={{ borderColor: "#E5E7EB", color: brand.ink }}
                      />
                    ) : null}
                    <button
                      type="button"
                      disabled={batchBusy || !assignCategory}
                      onClick={() => void runBatch({ categoria: assignCategory })}
                      className="h-10 px-4 text-sm font-bold disabled:cursor-not-allowed"
                      style={{
                        backgroundColor: assignCategory && !batchBusy ? brand.green : "#E5E7EB",
                        color: assignCategory && !batchBusy ? "#FFFFFF" : brand.muted,
                      }}
                    >
                      Aplicar
                    </button>
                  </div>
                </div>
                {canSelectMatching ? (
                  <p className="text-xs text-brand-muted">
                    Seleccionados los {pageIds.length} de esta página ·{" "}
                    <button
                      type="button"
                      disabled={selectingAll || batchBusy}
                      onClick={() => void selectMatchingFilter()}
                      className="font-bold underline decoration-transparent hover:decoration-current disabled:opacity-40"
                      style={{ color: brand.green }}
                    >
                      {selectingAll
                        ? "Seleccionando…"
                        : `Seleccionar los ${total.toLocaleString("es-DO")} que coinciden con el filtro`}
                    </button>
                  </p>
                ) : null}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

function BrandCheckbox({
  checked,
  indeterminate = false,
  onChange,
  label,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);
  const on = checked || indeterminate;
  return (
    <label className="inline-flex cursor-pointer items-center">
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        aria-label={label}
        className="sr-only"
      />
      <span
        className="flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border"
        style={{
          borderColor: on ? brand.green : "#D1D5DB",
          backgroundColor: on ? brand.green : "#FFFFFF",
        }}
      >
        {checked ? (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path d="M2 5.2 4.1 7.3 8 2.8" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : indeterminate ? (
          <span className="block h-0.5 w-2.5 rounded-full bg-white" />
        ) : null}
      </span>
    </label>
  );
}

function ProductRow({
  product,
  zebra,
  selected,
  editing,
  savedFlash,
  categories,
  onToggle,
  onStartEdit,
  onCancelEdit,
  onDirtyChange,
  onSaved,
  onPatch,
  onError,
}: {
  product: AdminCatalogProduct;
  zebra: boolean;
  selected: boolean;
  editing: boolean;
  savedFlash: boolean;
  categories: string[];
  onToggle: (checked: boolean) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onSaved: () => void;
  onPatch: (id: string, payload: PatchPayload) => Promise<AdminCatalogProduct>;
  onError: (message: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftNombre, setDraftNombre] = useState(product.nombre);
  const [draftMarca, setDraftMarca] = useState(product.marca || "");
  const [draftCategoria, setDraftCategoria] = useState(isUncategorized(product.categoria) ? "" : product.categoria);
  const [categoryMode, setCategoryMode] = useState<"select" | "new">("select");
  const [draftNewCategoria, setDraftNewCategoria] = useState("");
  const [draftPrecio, setDraftPrecio] = useState(String(product.precio));
  const nombreRef = useRef<HTMLInputElement | null>(null);
  const missingCategory = isUncategorized(product.categoria);

  useEffect(() => {
    if (!editing) {
      return;
    }
    setDraftNombre(product.nombre);
    setDraftMarca(product.marca || "");
    setDraftCategoria(isUncategorized(product.categoria) ? "" : product.categoria);
    setCategoryMode("select");
    setDraftNewCategoria("");
    setDraftPrecio(String(product.precio));
    window.requestAnimationFrame(() => nombreRef.current?.focus());
  }, [editing, product.id]);

  const resolvedCategoria = categoryMode === "new" ? draftNewCategoria.trim() : draftCategoria.trim();
  const originalCategoria = missingCategory ? "" : product.categoria;
  const parsedPrecio = parsePriceDraft(draftPrecio);
  const dirty =
    editing &&
    (draftNombre.trim() !== product.nombre.trim() ||
      draftMarca.trim() !== (product.marca || "") ||
      resolvedCategoria !== originalCategoria ||
      (parsedPrecio == null ? draftPrecio.trim() !== String(product.precio) : parsedPrecio !== product.precio));

  useEffect(() => {
    if (editing) {
      onDirtyChange(dirty);
    }
  }, [dirty, editing, onDirtyChange]);

  useEffect(() => {
    if (!editing) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCancelEdit();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, onCancelEdit]);

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

  async function saveRow() {
    const nombre = draftNombre.trim();
    if (!nombre) {
      onError("El nombre no puede quedar vacío");
      return;
    }
    if (!resolvedCategoria) {
      onError("La categoría no puede quedar vacía");
      return;
    }
    if (parsedPrecio == null) {
      onError("Precio inválido");
      return;
    }
    const payload: PatchPayload = {};
    if (nombre !== product.nombre.trim()) {
      payload.nombre = nombre;
    }
    if (draftMarca.trim() !== (product.marca || "")) {
      payload.marca = draftMarca.trim() || null;
    }
    if (resolvedCategoria !== originalCategoria) {
      payload.categoria = resolvedCategoria;
    }
    if (parsedPrecio !== product.precio) {
      payload.precio = parsedPrecio;
    }
    if (Object.keys(payload).length === 0) {
      onCancelEdit();
      return;
    }
    setSaving(true);
    try {
      await onPatch(product.id, payload);
      onError(null);
      onSaved();
    } catch (saveError) {
      onError(saveError instanceof Error ? saveError.message : "No pudimos guardar");
    } finally {
      setSaving(false);
    }
  }

  const fieldClass = "h-8 w-full min-w-[7rem] rounded-lg border bg-white px-2 text-sm font-semibold outline-none";

  return (
    <tr
      className="product-row border-t"
      data-selected={selected ? "true" : "false"}
      data-editing={editing ? "true" : "false"}
      style={{
        borderColor: "#F3F4F6",
        backgroundColor: editing
          ? "rgba(126, 179, 65, 0.06)"
          : selected
            ? "rgba(126, 179, 65, 0.08)"
            : zebra
              ? "#FAFBFA"
              : "#FFFFFF",
        boxShadow: selected || editing ? `inset 3px 0 0 ${brand.green}` : undefined,
        opacity: product.activo ? 1 : 0.72,
      }}
    >
      <td className="px-3 py-2.5">
        <BrandCheckbox
          checked={selected}
          onChange={onToggle}
          label={`Seleccionar ${product.nombre}`}
        />
      </td>
      <td className="px-3 py-2.5">
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
      <td className="max-w-[240px] px-3 py-2.5 font-semibold leading-tight">
        {editing ? (
          <input
            ref={nombreRef}
            value={draftNombre}
            onChange={(event) => setDraftNombre(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void saveRow();
              }
            }}
            className={fieldClass}
            style={{ borderColor: brand.green, color: brand.ink }}
          />
        ) : (
          <span>{product.nombre}</span>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5">
        {editing ? (
          <input
            value={draftMarca}
            onChange={(event) => setDraftMarca(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void saveRow();
              }
            }}
            className={fieldClass}
            style={{ borderColor: brand.green, color: brand.ink }}
          />
        ) : (
          <span className="text-brand-muted">{product.marca || "—"}</span>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5">
        {editing ? (
          categoryMode === "new" ? (
            <input
              value={draftNewCategoria}
              placeholder="Nueva categoría"
              onChange={(event) => setDraftNewCategoria(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void saveRow();
                }
              }}
              className={fieldClass}
              style={{ borderColor: brand.green, color: brand.ink }}
            />
          ) : (
            <select
              value={draftCategoria}
              onChange={(event) => {
                if (event.target.value === "__new__") {
                  setCategoryMode("new");
                  setDraftNewCategoria("");
                  return;
                }
                setDraftCategoria(event.target.value);
              }}
              className={fieldClass}
              style={{ borderColor: brand.green, color: brand.ink }}
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
          )
        ) : missingCategory ? (
          <span
            className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold"
            style={{ backgroundColor: "#FEF3C7", color: "#92400E" }}
          >
            Sin categoría
          </span>
        ) : (
          <span className="text-brand-muted">{product.categoria}</span>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right">
        {editing ? (
          <input
            value={draftPrecio}
            inputMode="decimal"
            onChange={(event) => setDraftPrecio(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void saveRow();
              }
            }}
            className={`${fieldClass} text-right font-bold tabular-nums`}
            style={{ borderColor: brand.green, color: brand.ink, minWidth: "6.5rem" }}
          />
        ) : (
          <span className="font-bold tabular-nums">{formatPrice(product.precio)}</span>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-brand-muted">
        {product.codigoOdoo ? (
          <span className="cursor-help underline decoration-dotted decoration-gray-300" title={product.codigoOdoo}>
            {shortOdooCode(product.codigoOdoo)}
          </span>
        ) : (
          "—"
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-brand-muted">{product.codigoBarras || "—"}</td>
      <td className="px-3 py-2.5">
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
      <td className="whitespace-nowrap px-3 py-2.5">
        {editing ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveRow()}
              className="inline-flex items-center gap-1 rounded-full px-2.5 text-xs font-bold text-white disabled:opacity-40"
              style={{ minHeight: 32, backgroundColor: brand.green }}
            >
              <CheckIcon />
              Guardar
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={onCancelEdit}
              className="inline-flex items-center gap-1 rounded-full border px-2.5 text-xs font-bold disabled:opacity-40"
              style={{ minHeight: 32, borderColor: "#E5E7EB", backgroundColor: "#FFFFFF", color: brand.ink }}
            >
              <CloseIcon />
              Cancelar
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onStartEdit}
              className="row-edit-btn inline-flex h-8 w-8 items-center justify-center rounded-full"
              style={{ color: brand.muted }}
              aria-label={`Editar ${product.nombre}`}
              title="Editar"
            >
              <PencilIcon />
            </button>
            {savedFlash ? <span className="text-sm font-bold" style={{ color: brand.green }}>✓</span> : null}
          </div>
        )}
      </td>
    </tr>
  );
}

function parsePriceDraft(raw: string): number | null {
  const parsed = Number(raw.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return Math.round(parsed * 100) / 100;
}

function PencilIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M11.2 2.6a1.3 1.3 0 0 1 1.8 1.8L5.5 12l-2.3.5.5-2.3 7.5-7.6Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M2.2 6.2 4.6 8.6 9.8 3.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M3 3l6 6M9 3 3 9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 3v7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M5.2 7.8 8 10.6l2.8-2.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 13h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M3.5 5.2 7 8.7l3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
