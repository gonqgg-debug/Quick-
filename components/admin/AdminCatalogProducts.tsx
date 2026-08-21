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
  const editingProductRef = useRef<AdminCatalogProduct | null>(null);

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
      return window.confirm("Hay cambios sin guardar. ¿Descartarlos?");
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
    editingProductRef.current = products.find((item) => item.id === id) ?? null;
  }

  function cancelEdit() {
    dirtyRef.current = false;
    setEditingId(null);
    editingProductRef.current = null;
  }

  function finishSave(id: string) {
    dirtyRef.current = false;
    setEditingId(null);
    editingProductRef.current = null;
    setSavedId(id);
    window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setSavedId(null), 1400);
  }

  function applyFotoUrl(id: string, fotoUrl: string) {
    setProducts((current) => current.map((item) => (item.id === id ? { ...item, fotoUrl } : item)));
    if (editingProductRef.current?.id === id) {
      editingProductRef.current = { ...editingProductRef.current, fotoUrl };
    }
  }

  function changePage(next: number) {
    if (!confirmDiscardIfNeeded()) {
      return;
    }
    dirtyRef.current = false;
    setEditingId(null);
    editingProductRef.current = null;
    setPage(next);
  }

  const assignCategory = batchCategory === "__new__" ? batchNewCategory.trim() : batchCategory;
  const canSelectMatching = allPageSelected && selected.length === pageIds.length && total > pageIds.length;
  const editingProduct =
    products.find((item) => item.id === editingId) ??
    (editingId && editingProductRef.current?.id === editingId ? editingProductRef.current : null);
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
            Usa el lápiz para abrir la ficha del producto. El catálogo público solo muestra productos activos.
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
                  editingProductRef.current = null;
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
                  editingProductRef.current = null;
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
                    <th className="w-12 px-3 py-3">
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
                      savedFlash={savedId === product.id}
                      onToggle={(checked) => toggleRow(product.id, checked)}
                      onStartEdit={() => startEdit(product.id)}
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

      {editingProduct && typeof document !== "undefined"
        ? createPortal(
            <ProductEditModal
              key={editingProduct.id}
              product={editingProduct}
              categories={usableCategories}
              onDirtyChange={(dirty) => {
                dirtyRef.current = dirty;
              }}
              onCancel={cancelEdit}
              onSaved={() => finishSave(editingProduct.id)}
              onFotoSaved={(fotoUrl) => applyFotoUrl(editingProduct.id, fotoUrl)}
              onPatch={patchProduct}
            />,
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
  savedFlash,
  onToggle,
  onStartEdit,
  onPatch,
  onError,
}: {
  product: AdminCatalogProduct;
  zebra: boolean;
  selected: boolean;
  savedFlash: boolean;
  onToggle: (checked: boolean) => void;
  onStartEdit: () => void;
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
      className="product-row border-t"
      data-selected={selected ? "true" : "false"}
      style={{
        borderColor: "#F3F4F6",
        backgroundColor: selected ? "rgba(126, 179, 65, 0.08)" : zebra ? "#FAFBFA" : "#FFFFFF",
        boxShadow: selected ? `inset 3px 0 0 ${brand.green}` : undefined,
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
      <td className="max-w-[240px] px-3 py-2.5 font-semibold leading-tight">{product.nombre}</td>
      <td className="whitespace-nowrap px-3 py-2.5 text-brand-muted">{product.marca || "—"}</td>
      <td className="whitespace-nowrap px-3 py-2.5">
        {missingCategory ? (
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
      <td className="whitespace-nowrap px-3 py-2.5 text-right font-bold tabular-nums">{formatPrice(product.precio)}</td>
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
        <ActivoSwitch activo={product.activo} disabled={busy} onToggle={() => void toggleActivo()} />
      </td>
      <td className="whitespace-nowrap px-3 py-2.5">
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
          {savedFlash ? (
            <span className="text-sm font-bold" style={{ color: brand.green }}>
              ✓
            </span>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const PHOTO_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

function ProductEditModal({
  product,
  categories,
  onDirtyChange,
  onCancel,
  onSaved,
  onFotoSaved,
  onPatch,
}: {
  product: AdminCatalogProduct;
  categories: string[];
  onDirtyChange: (dirty: boolean) => void;
  onCancel: () => void;
  onSaved: () => void;
  onFotoSaved: (fotoUrl: string) => void;
  onPatch: (id: string, payload: PatchPayload) => Promise<AdminCatalogProduct>;
}) {
  const [draftNombre, setDraftNombre] = useState(product.nombre);
  const [draftMarca, setDraftMarca] = useState(product.marca || "");
  const [draftCategoria, setDraftCategoria] = useState(isUncategorized(product.categoria) ? "" : product.categoria);
  const [categoryMode, setCategoryMode] = useState<"select" | "new">("select");
  const [draftNewCategoria, setDraftNewCategoria] = useState("");
  const [draftPrecio, setDraftPrecio] = useState(String(product.precio));
  const [draftActivo, setDraftActivo] = useState(product.activo);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const nombreRef = useRef<HTMLInputElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const resolvedCategoria = categoryMode === "new" ? draftNewCategoria.trim() : draftCategoria.trim();
  const originalCategoria = isUncategorized(product.categoria) ? "" : product.categoria;
  const parsedPrecio = parsePriceDraft(draftPrecio);
  const dirty =
    Boolean(imageFile) ||
    draftNombre.trim() !== product.nombre.trim() ||
    draftMarca.trim() !== (product.marca || "") ||
    resolvedCategoria !== originalCategoria ||
    (parsedPrecio == null ? draftPrecio.trim() !== String(product.precio) : parsedPrecio !== product.precio) ||
    draftActivo !== product.activo;

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => nombreRef.current?.focus());
    return () => {
      document.body.style.overflow = previous;
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function requestClose() {
    if (dirty && !window.confirm("Hay cambios sin guardar. ¿Descartarlos?")) {
      return;
    }
    onDirtyChange(false);
    onCancel();
  }

  function acceptFile(file: File | undefined) {
    if (!file) {
      return;
    }
    const mime = file.type === "image/jpg" ? "image/jpeg" : file.type;
    if (!PHOTO_TYPES.has(mime)) {
      setFormError("Usa JPG, PNG o WebP");
      return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
      setFormError("La imagen pesa más de 5 MB");
      return;
    }
    setFormError(null);
    setImagePreview((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      const next = URL.createObjectURL(file);
      previewUrlRef.current = next;
      return next;
    });
    setImageFile(file);
  }

  async function save() {
    const nombre = draftNombre.trim();
    if (!nombre) {
      setFormError("El nombre no puede quedar vacío");
      return;
    }
    if (!resolvedCategoria) {
      setFormError("La categoría no puede quedar vacía");
      return;
    }
    if (parsedPrecio == null) {
      setFormError("Precio inválido");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (imageFile) {
        const body = new FormData();
        body.append("productId", product.id);
        body.append("file", imageFile);
        const response = await fetch("/api/admin/catalogo/imagenes/upload", {
          method: "POST",
          credentials: "include",
          body,
        });
        const payload = (await response.json().catch(() => null)) as { fotoUrl?: string; error?: string } | null;
        if (!response.ok || !payload?.fotoUrl) {
          throw new Error(payload?.error || "No pudimos subir la imagen");
        }
        onFotoSaved(payload.fotoUrl);
      }
      const patch: PatchPayload = {};
      if (nombre !== product.nombre.trim()) {
        patch.nombre = nombre;
      }
      if (draftMarca.trim() !== (product.marca || "")) {
        patch.marca = draftMarca.trim() || null;
      }
      if (resolvedCategoria !== originalCategoria) {
        patch.categoria = resolvedCategoria;
      }
      if (parsedPrecio !== product.precio) {
        patch.precio = parsedPrecio;
      }
      if (draftActivo !== product.activo) {
        patch.activo = draftActivo;
      }
      if (Object.keys(patch).length > 0) {
        await onPatch(product.id, patch);
      }
      onDirtyChange(false);
      onSaved();
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : "No pudimos guardar");
    } finally {
      setSaving(false);
    }
  }

  const previewSrc = imagePreview || product.fotoUrl;
  const fieldClass =
    "mt-1 h-11 w-full rounded-xl border bg-white px-3 text-sm font-semibold outline-none focus:border-[#7EB341]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Cerrar"
        onClick={requestClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-edit-title"
        className="relative z-10 flex max-h-[calc(100vh-3rem)] w-full max-w-lg flex-col overflow-hidden rounded-[28px] bg-white"
        style={{ boxShadow: "0 24px 64px rgba(26, 26, 26, 0.22)", color: brand.ink }}
      >
        <div className="overflow-y-auto px-6 py-6">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Editar producto</p>
          <h2 id="product-edit-title" className="mt-1 font-display text-2xl font-bold leading-tight">
            {product.nombre}
          </h2>

          <div className="mt-5 flex flex-col items-center">
            <div
              className="flex items-center justify-center overflow-hidden rounded-3xl"
              style={{ width: 200, height: 200, backgroundColor: "#F3F4F6" }}
            >
              {previewSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewSrc} alt="" className="h-full w-full object-contain" />
              ) : (
                <span className="text-sm text-brand-muted">Sin imagen</span>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => {
                acceptFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragOver(false);
                acceptFile(event.dataTransfer.files[0]);
              }}
              className="mt-3 rounded-full border px-4 text-sm font-bold"
              style={{
                minHeight: 40,
                borderColor: dragOver ? brand.green : "#E5E7EB",
                backgroundColor: dragOver ? "rgba(126, 179, 65, 0.08)" : "#FFFFFF",
                color: brand.ink,
              }}
            >
              Cambiar imagen
            </button>
            <p className="mt-1.5 text-xs text-brand-muted">JPG, PNG o WebP · máx. 5 MB · o arrastra aquí</p>
          </div>

          <div className="mt-6 space-y-4">
            <label className="block text-xs font-bold text-brand-muted">
              Nombre
              <input
                ref={nombreRef}
                value={draftNombre}
                onChange={(event) => setDraftNombre(event.target.value)}
                className={fieldClass}
                style={{ borderColor: "#E5E7EB", color: brand.ink }}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-xs font-bold text-brand-muted">
                Marca
                <input
                  value={draftMarca}
                  onChange={(event) => setDraftMarca(event.target.value)}
                  className={fieldClass}
                  style={{ borderColor: "#E5E7EB", color: brand.ink }}
                />
              </label>
              <label className="block text-xs font-bold text-brand-muted">
                Categoría
                {categoryMode === "new" ? (
                  <input
                    value={draftNewCategoria}
                    placeholder="Nueva categoría"
                    onChange={(event) => setDraftNewCategoria(event.target.value)}
                    className={fieldClass}
                    style={{ borderColor: "#E5E7EB", color: brand.ink }}
                  />
                ) : (
                  <span className="relative mt-1 block">
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
                      className="h-11 w-full appearance-none rounded-xl border bg-white px-3 pr-9 text-sm font-semibold outline-none focus:border-[#7EB341]"
                      style={{ borderColor: "#E5E7EB", color: brand.ink }}
                    >
                      <option value="" disabled>
                        Elegir…
                      </option>
                      {categories.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                      <option value="__new__">Crear nueva…</option>
                    </select>
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-brand-muted">
                      <ChevronIcon />
                    </span>
                  </span>
                )}
              </label>
            </div>
            <label className="block text-xs font-bold text-brand-muted">
              Precio
              <span className="relative mt-1 block">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-bold" style={{ color: brand.orange }}>
                  RD$
                </span>
                <input
                  value={draftPrecio}
                  inputMode="decimal"
                  onChange={(event) => setDraftPrecio(event.target.value)}
                  className="h-11 w-full rounded-xl border bg-white pl-12 pr-3 text-sm font-bold tabular-nums outline-none focus:border-[#7EB341]"
                  style={{ borderColor: "#E5E7EB", color: brand.ink }}
                />
              </span>
            </label>
            <div className="grid gap-3 rounded-2xl px-4 py-3 sm:grid-cols-2" style={{ backgroundColor: "#F8FAF7" }}>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-brand-muted">Código Odoo</p>
                <p className="mt-1 break-all font-mono text-xs text-brand-muted">{product.codigoOdoo || "—"}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-brand-muted">Código de barras</p>
                <p className="mt-1 font-mono text-xs text-brand-muted">{product.codigoBarras || "—"}</p>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-2xl border px-4 py-3" style={{ borderColor: "#E5E7EB" }}>
              <p className="text-sm font-bold">Visible en el catálogo</p>
              <ActivoSwitch activo={draftActivo} onToggle={() => setDraftActivo((current) => !current)} />
            </div>
          </div>

          {formError ? (
            <p className="mt-4 rounded-2xl px-3 py-2 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>
              {formError}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t px-6 py-4" style={{ borderColor: "#F3F4F6" }}>
          <button
            type="button"
            disabled={saving}
            onClick={requestClose}
            className="rounded-full border px-4 text-sm font-bold disabled:opacity-40"
            style={{ minHeight: 44, borderColor: "#E5E7EB", backgroundColor: "#FFFFFF", color: brand.ink }}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="rounded-full px-5 text-sm font-bold text-white disabled:opacity-40"
            style={{ minHeight: 44, backgroundColor: brand.green }}
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ActivoSwitch({
  activo,
  disabled = false,
  onToggle,
}: {
  activo: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      disabled={disabled}
      onClick={onToggle}
      className="inline-flex items-center gap-2 disabled:opacity-40"
    >
      <span
        className="relative inline-block h-5 w-9 rounded-full"
        style={{ backgroundColor: activo ? brand.green : "#D1D5DB" }}
      >
        <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white" style={{ left: activo ? 16 : 2 }} />
      </span>
      <span className="text-xs font-bold" style={{ color: activo ? brand.green : brand.muted }}>
        {activo ? "Activo" : "Inactivo"}
      </span>
    </button>
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
