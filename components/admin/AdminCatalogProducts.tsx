"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AdminSelect } from "@/components/admin/AdminField";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  stock?: number | null;
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
        <Button
          type="button"
          variant="secondary"
          disabled={exporting || loading || total === 0}
          onClick={() => void exportWorkbook()}
        >
          <DownloadIcon />
          {exporting ? "Exportando..." : "Exportar a Excel"}
        </Button>
      </div>

      <div className="mt-5 space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-sm font-medium text-foreground">
            Buscar
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Nombre, marca o código"
              className="mt-1.5"
            />
          </label>
          <label className="block text-sm font-medium text-foreground">
            Categoría
            <AdminSelect
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
            >
              <option value="">Todas</option>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {isUncategorized(item) ? "Sin categoría (All)" : item}
                </option>
              ))}
            </AdminSelect>
          </label>
        </div>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar por estado">
          {ESTADO_FILTERS.map((filter) => {
            const active = estado === filter.id;
            return (
              <Button
                key={filter.id}
                type="button"
                role="tab"
                aria-selected={active}
                variant={active ? "default" : "secondary"}
                size="sm"
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
              >
                {filter.label}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="mt-6" style={{ paddingBottom: barMounted ? 168 : undefined }}>
        {error ? (
          <p className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {loading ? (
          <Skeleton className="h-64 w-full" />
        ) : products.length === 0 ? (
          <Card className="px-5 py-14 text-center shadow-sm">
            <p className="font-display text-xl font-bold">No hay productos con esos filtros</p>
            <p className="mt-2 text-sm text-muted-foreground">Prueba otro texto, categoría o estado.</p>
          </Card>
        ) : (
          <div>
            <Card className="overflow-hidden shadow-sm">
              <Table className="min-w-[1180px]">
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="w-10">
                      <BrandCheckbox
                        checked={allPageSelected}
                        indeterminate={somePageSelected}
                        onChange={togglePage}
                        label="Seleccionar todos los visibles"
                      />
                    </TableHead>
                    <TableHead>Foto</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Marca</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead>Cód. Odoo</TableHead>
                    <TableHead>Barras</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="w-12">
                      <span className="sr-only">Editar</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <ProductRow
                      key={product.id}
                      product={product}
                      selected={selected.includes(product.id)}
                      savedFlash={savedId === product.id}
                      onToggle={(checked) => toggleRow(product.id, checked)}
                      onStartEdit={() => startEdit(product.id)}
                      onPatch={patchProduct}
                      onError={setError}
                    />
                  ))}
                </TableBody>
              </Table>
            </Card>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {fromRow}–{toRow} de {total.toLocaleString("es-DO")}
              </p>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => changePage(Math.max(1, page - 1))}>
                  Anterior
                </Button>
                <p className="text-sm font-medium tabular-nums">
                  {page} / {pageCount}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= pageCount}
                  onClick={() => changePage(Math.min(pageCount, page + 1))}
                >
                  Siguiente
                </Button>
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
                  <Button type="button" size="sm" disabled={batchBusy} onClick={() => void runBatch({ activo: true })}>
                    Activar
                  </Button>
                  <Button type="button" size="sm" variant="destructive" disabled={batchBusy} onClick={() => void runBatch({ activo: false })}>
                    Desactivar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={exporting || batchBusy}
                    onClick={() => void exportWorkbook(selected)}
                  >
                    <DownloadIcon />
                    Exportar seleccionados
                  </Button>
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
  selected,
  savedFlash,
  onToggle,
  onStartEdit,
  onPatch,
  onError,
}: {
  product: AdminCatalogProduct;
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
    <TableRow
      className="product-row data-[inactive=true]:opacity-70 data-[selected=true]:bg-primary/10"
      data-selected={selected ? "true" : "false"}
      data-inactive={product.activo ? "false" : "true"}
    >
      <TableCell>
        <BrandCheckbox
          checked={selected}
          onChange={onToggle}
          label={`Seleccionar ${product.nombre}`}
        />
      </TableCell>
      <TableCell>
        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-md bg-muted">
          {product.fotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.fotoUrl} alt="" className="h-full w-full object-contain" />
          ) : (
            <span className="text-[10px] text-muted-foreground">—</span>
          )}
        </div>
      </TableCell>
      <TableCell className="max-w-[240px] font-medium leading-tight">{product.nombre}</TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">{product.marca || "—"}</TableCell>
      <TableCell className="whitespace-nowrap">
        {missingCategory ? (
          <Badge variant="warning">Sin categoría</Badge>
        ) : (
          <span className="text-muted-foreground">{product.categoria}</span>
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap text-right font-medium tabular-nums">{formatPrice(product.precio)}</TableCell>
      <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
        {product.codigoOdoo ? (
          <span className="cursor-help underline decoration-dotted decoration-border" title={product.codigoOdoo}>
            {shortOdooCode(product.codigoOdoo)}
          </span>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">{product.codigoBarras || "—"}</TableCell>
      <TableCell>
        <ActivoSwitch activo={product.activo} disabled={busy} onToggle={() => void toggleActivo()} />
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onStartEdit}
            className="row-edit-btn h-8 w-8"
            aria-label={`Editar ${product.nombre}`}
            title="Editar"
          >
            <PencilIcon />
          </Button>
          {savedFlash ? <span className="text-sm font-bold text-primary">✓</span> : null}
        </div>
      </TableCell>
    </TableRow>
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
  const [draftStock, setDraftStock] = useState(product.stock == null ? "" : String(product.stock));
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
  const parsedStock = parseStockDraft(draftStock);
  const dirty =
    Boolean(imageFile) ||
    draftNombre.trim() !== product.nombre.trim() ||
    draftMarca.trim() !== (product.marca || "") ||
    resolvedCategoria !== originalCategoria ||
    (parsedPrecio == null ? draftPrecio.trim() !== String(product.precio) : parsedPrecio !== product.precio) ||
    (parsedStock.ok ? parsedStock.stock !== product.stock : true) ||
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

  async function deactivate() {
    if (!window.confirm("Este producto dejará de verse en el catálogo público. ¿Desactivar?")) {
      return;
    }
    setDraftActivo(false);
    await save(false);
  }

  async function save(activoOverride?: boolean) {
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
    if (!parsedStock.ok) {
      setFormError("Stock inválido");
      return;
    }
    const nextActivo = activoOverride ?? draftActivo;
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
      if (parsedStock.stock !== product.stock) {
        patch.stock = parsedStock.stock;
      }
      if (nextActivo !== product.activo) {
        patch.activo = nextActivo;
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
  const displayName = draftNombre.trim() || product.nombre;
  const displayMarca = draftMarca.trim() || "Sin marca";
  const displayCategoria = resolvedCategoria || "Sin categoría";
  const labelClass = "block text-sm font-medium leading-none text-foreground";

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
        className="relative z-10 flex max-h-[calc(100vh-3rem)] w-full max-w-xl flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-lg"
      >
        <div className="overflow-y-auto">
          <div className="h-[128px] w-full bg-muted" />
          <div className="px-6 pb-8">
            <div className="-mt-[60px] flex flex-col items-center text-center">
              <div className="flex h-[120px] w-[120px] items-center justify-center overflow-hidden rounded-lg border-4 border-card bg-muted shadow-md">
                {previewSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewSrc} alt="" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-xs text-brand-muted">Sin imagen</span>
                )}
              </div>
              <h2 id="product-edit-title" className="mt-4 max-w-full px-2 font-display text-xl font-bold leading-tight">
                {displayName}
              </h2>
              <p className="mt-1 text-sm text-brand-muted">
                {displayMarca} · {displayCategoria}
              </p>
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
              <Button
                type="button"
                variant="outline"
                className={dragOver ? "mt-4 border-primary bg-accent" : "mt-4"}
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
              >
                Cambiar imagen
              </Button>
            </div>

            <div className="mt-8 space-y-6">
              <label className={labelClass}>
                Nombre
                <Input
                  ref={nombreRef}
                  value={draftNombre}
                  onChange={(event) => setDraftNombre(event.target.value)}
                  className="mt-1.5"
                />
              </label>
              <div className="grid gap-6 sm:grid-cols-2">
                <label className={labelClass}>
                  Marca
                  <Input value={draftMarca} onChange={(event) => setDraftMarca(event.target.value)} className="mt-1.5" />
                </label>
                <label className={labelClass}>
                  Categoría
                  {categoryMode === "new" ? (
                    <Input
                      value={draftNewCategoria}
                      placeholder="Nueva categoría"
                      onChange={(event) => setDraftNewCategoria(event.target.value)}
                      className="mt-1.5"
                    />
                  ) : (
                    <AdminSelect
                      value={draftCategoria}
                      onChange={(event) => {
                        if (event.target.value === "__new__") {
                          setCategoryMode("new");
                          setDraftNewCategoria("");
                          return;
                        }
                        setDraftCategoria(event.target.value);
                      }}
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
                    </AdminSelect>
                  )}
                </label>
              </div>
              <label className={labelClass}>
                Stock
                <Input
                  value={draftStock}
                  inputMode="numeric"
                  placeholder="Sin conteo"
                  onChange={(event) => setDraftStock(event.target.value.replace(/[^\d-]/g, "").slice(0, 7))}
                  className="mt-1.5"
                />
                <span className="mt-1 block text-xs font-normal text-muted-foreground">
                  Vacío = sin conteo. El cobro no se bloquea si llega a 0.
                </span>
              </label>
              <label className={labelClass}>
                Precio
                <span className="relative mt-1.5 block">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-medium text-warning">
                    RD$
                  </span>
                  <Input
                    value={draftPrecio}
                    inputMode="decimal"
                    onChange={(event) => setDraftPrecio(event.target.value)}
                    className="pl-12 font-medium tabular-nums"
                  />
                </span>
              </label>
              <div className="grid gap-4 rounded-lg bg-muted px-4 py-3.5 sm:grid-cols-2">
                <div className="min-w-0">
                  <p className={labelClass}>Código Odoo</p>
                  <p
                    className="mt-1.5 truncate font-mono text-sm text-brand-muted"
                    title={product.codigoOdoo || undefined}
                  >
                    {product.codigoOdoo ? shortOdooCode(product.codigoOdoo) : "—"}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className={labelClass}>Código de barras</p>
                  <p className="mt-1.5 truncate font-mono text-sm text-brand-muted" title={product.codigoBarras || undefined}>
                    {product.codigoBarras || "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <p className={labelClass}>Estado</p>
                <ActivoSwitch activo={draftActivo} onToggle={() => setDraftActivo((current) => !current)} />
              </div>
            </div>

            {formError ? (
              <p className="mt-6 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {formError}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4">
          {draftActivo ? (
            <Button type="button" variant="destructive" disabled={saving} onClick={() => void deactivate()}>
              Desactivar producto
            </Button>
          ) : (
            <span />
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" disabled={saving} onClick={requestClose}>
              Cancelar
            </Button>
            <Button type="button" disabled={saving} onClick={() => void save()}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
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

function parseStockDraft(raw: string): { ok: true; stock: number | null } | { ok: false; stock: null } {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "-") {
    return { ok: true, stock: null };
  }
  if (!/^-?\d+$/.test(trimmed)) {
    return { ok: false, stock: null };
  }
  const stock = Number(trimmed);
  if (!Number.isSafeInteger(stock) || stock < -100000 || stock > 1000000) {
    return { ok: false, stock: null };
  }
  return { ok: true, stock };
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
