"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatPrice } from "@/lib/money";
import { brand } from "@/lib/theme";
import { AdminInput, AdminSelect } from "@/components/admin/AdminField";
import { DataTable, DataTableCell, DataTableHead, DataTableRow, DataTableTh } from "@/components/admin/DataTable";
import { guardarListaProductos } from "@/components/admin/catalogo/lista-guardada";
import {
  BrandCheckbox,
  EstadoProducto,
  CostoProducto,
  FotoProducto,
  MargenProducto,
  ProveedoresProducto,
  lineaSecundaria,
} from "@/components/admin/catalogo/producto-ui";
import { Aviso, TONO } from "@/components/admin/facturas/ui";
import {
  CATALOG_PRODUCTS_PAGE_SIZE,
  catalogProductsQueryString,
  isUncategorized,
  type AdminCatalogConteos,
  type AdminCatalogProduct,
  type AdminCatalogProductList,
  type CatalogoEstado,
} from "@/lib/admin-catalog-products-shared";

type Presentacion = "lista" | "bloques";

const ESTADOS: Array<{ id: CatalogoEstado; label: string }> = [
  { id: "activo", label: "Activos" },
  { id: "inactivo", label: "Inactivos" },
  { id: "sin_costo", label: "Sin costo" },
  { id: "todos", label: "Todos" },
];

const BATCH_CONFIRM = 20;

function estadoDesde(value: string | null): CatalogoEstado {
  return ESTADOS.some((item) => item.id === value) ? (value as CatalogoEstado) : "activo";
}

function presentacionDesde(value: string | null): Presentacion {
  return value === "bloques" ? "bloques" : "lista";
}

function conteoDe(estado: CatalogoEstado, conteos: AdminCatalogConteos | null): number | null {
  if (!conteos) {
    return null;
  }
  if (estado === "activo") {
    return conteos.activos;
  }
  if (estado === "inactivo") {
    return conteos.inactivos;
  }
  if (estado === "sin_costo") {
    return conteos.sinCosto;
  }
  return conteos.todos;
}

export function AdminCatalogProducts() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const presentacion = presentacionDesde(searchParams.get("presentacion"));
  const estado = estadoDesde(searchParams.get("estado"));
  const qUrl = searchParams.get("q") ?? "";
  const categoria = searchParams.get("categoria") ?? "";
  const pageRaw = Number(searchParams.get("page") || "1");
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  const [q, setQ] = useState(qUrl);
  const [products, setProducts] = useState<AdminCatalogProduct[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [conteos, setConteos] = useState<AdminCatalogConteos | null>(null);
  const [total, setTotal] = useState(0);
  const [booting, setBooting] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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

  const listQuery = searchParams.toString();
  const queryString = useMemo(
    () => catalogProductsQueryString({ q: qUrl, categoria, estado, page }),
    [qUrl, categoria, estado, page]
  );
  const filterQueryString = useMemo(
    () => catalogProductsQueryString({ q: qUrl, categoria, estado, page: 1 }),
    [qUrl, categoria, estado]
  );

  function setUrl(next: { presentacion?: Presentacion; estado?: CatalogoEstado; q?: string; categoria?: string; page?: number }) {
    const params = new URLSearchParams(searchParams.toString());
    const nextPresentacion = next.presentacion ?? presentacion;
    const nextEstado = next.estado ?? estado;
    const nextQ = next.q ?? qUrl;
    const nextCategoria = next.categoria ?? categoria;
    const nextPage = next.page ?? (next.estado || next.q != null || next.categoria != null ? 1 : page);
    if (nextPresentacion === "bloques") {
      params.set("presentacion", "bloques");
    } else {
      params.delete("presentacion");
    }
    if (nextEstado === "activo") {
      params.delete("estado");
    } else {
      params.set("estado", nextEstado);
    }
    if (nextQ.trim()) {
      params.set("q", nextQ.trim());
    } else {
      params.delete("q");
    }
    if (nextCategoria) {
      params.set("categoria", nextCategoria);
    } else {
      params.delete("categoria");
    }
    if (nextPage > 1) {
      params.set("page", String(nextPage));
    } else {
      params.delete("page");
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  const setUrlRef = useRef(setUrl);
  setUrlRef.current = setUrl;

  useEffect(() => {
    setQ(qUrl);
  }, [qUrl]);

  useEffect(() => {
    if (q.trim() === qUrl.trim()) {
      return;
    }
    const handle = window.setTimeout(() => setUrlRef.current({ q, page: 1 }), 300);
    return () => window.clearTimeout(handle);
  }, [q, qUrl]);

  useEffect(() => {
    setSelected([]);
  }, [qUrl, categoria, estado]);

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
    const rows = body?.products ?? [];
    setProducts(rows);
    setTotal(body?.total ?? 0);
    setCategories(body?.categories ?? []);
    setConteos(body?.conteos ?? null);
  }, [queryString, router]);

  useEffect(() => {
    if (booting) {
      return;
    }
    guardarListaProductos({ ids: products.map((row) => row.id), query: listQuery });
  }, [products, listQuery, booting]);

  useEffect(() => {
    let cancelled = false;
    setRefreshing(true);
    (async () => {
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
          setBooting(false);
          setRefreshing(false);
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

  async function runBatch(payload: { activo?: boolean; categoria?: string }) {
    if (selected.length === 0) {
      return;
    }
    const needsConfirm = selected.length > BATCH_CONFIRM && (payload.activo !== undefined || Boolean(payload.categoria));
    if (needsConfirm) {
      const action = payload.activo === true ? "activar" : payload.activo === false ? "desactivar" : "cambiar de categoría";
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
      link.href = url;
      link.download = `catalogo-productos-${new Date().toISOString().slice(0, 10)}.xlsx`;
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
  const assignCategory = batchCategory === "__new__" ? batchNewCategory.trim() : batchCategory;
  const canSelectMatching = allPageSelected && selected.length === pageIds.length && total > pageIds.length;
  if (selected.length > 0) {
    lastSelectedCount.current = selected.length;
  }

  function hrefDe(id: string) {
    return `/admin/catalogo/productos/${id}${listQuery ? `?${listQuery}` : ""}`;
  }

  function abrir(id: string) {
    router.push(hrefDe(id));
  }

  function togglePage(checked: boolean) {
    setSelected((current) => (checked ? Array.from(new Set([...current, ...pageIds])) : current.filter((id) => !pageIds.includes(id))));
  }

  function toggleRow(id: string, checked: boolean) {
    setSelected((current) => (checked ? Array.from(new Set([...current, id])) : current.filter((item) => item !== id)));
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
    <div style={{ paddingBottom: barMounted ? 168 : undefined }}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Productos</h1>
          <p className="mt-1 max-w-2xl text-sm text-brand-muted">
            La lista sirve para comparar y actuar en lote. Los bloques muestran foto, descripción, precio, costo y proveedores sin abrir cada producto.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border border-[#E7EBE4] bg-white p-1" role="group" aria-label="Presentación del catálogo">
            {(
              [
                { id: "lista", label: "Lista" },
                { id: "bloques", label: "Bloques" },
              ] as const
            ).map((item) => {
              const activa = presentacion === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={activa}
                  onClick={() => setUrl({ presentacion: item.id })}
                  className="rounded-full px-3 text-sm font-bold"
                  style={{
                    minHeight: 36,
                    backgroundColor: activa ? brand.paleGreen : "transparent",
                    color: activa ? brand.ink : brand.muted,
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            disabled={exporting || booting || total === 0}
            onClick={() => void exportWorkbook()}
            className="rounded-full px-4 text-sm font-bold disabled:opacity-40"
            style={{ minHeight: 40, backgroundColor: "#F3F4F6", color: brand.ink }}
          >
            {exporting ? "Exportando…" : "Exportar"}
          </button>
        </div>
      </div>

      <div className="mt-5 flex gap-1 overflow-x-auto border-b border-[#E7EBE4]" role="tablist" aria-label="Estado del catálogo">
        {ESTADOS.map((item) => {
          const activa = item.id === estado;
          const n = conteoDe(item.id, conteos);
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={activa}
              onClick={() => setUrl({ estado: item.id, page: 1 })}
              className="flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-semibold"
              style={{ borderColor: activa ? brand.green : "transparent", color: activa ? brand.ink : brand.muted }}
            >
              {item.label}
              {n != null ? (
                <span
                  className="rounded-full px-1.5 text-[11px] font-bold tabular-nums"
                  style={item.id === "sin_costo" && n > 0 ? TONO.naranja : { backgroundColor: "#F3F4F6", color: brand.muted }}
                >
                  {n}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_16rem]">
        <AdminInput bare value={q} onChange={(event) => setQ(event.target.value)} placeholder="Nombre, marca, descripción o código" aria-label="Buscar producto" />
        <AdminSelect
          bare
          value={categoria}
          aria-label="Categoría"
          onChange={(event) => setUrl({ categoria: event.target.value, page: 1 })}
        >
          <option value="">Todas las categorías</option>
          {categories.map((item) => (
            <option key={item} value={item}>
              {isUncategorized(item) ? "Sin categoría" : item}
            </option>
          ))}
        </AdminSelect>
      </div>

      {error ? (
        <div className="mt-4">
          <Aviso>{error}</Aviso>
        </div>
      ) : null}

      <div className="mt-4">
        {booting ? (
          <div className="h-64 animate-pulse rounded-2xl bg-[#F3F4F6]" />
        ) : products.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#E7EBE4] px-6 py-16 text-center">
            <p className="font-display text-lg font-bold">No hay productos con esos filtros</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-brand-muted">Prueba otro texto, otra categoría o la pestaña Todos.</p>
          </div>
        ) : presentacion === "lista" ? (
          <div className={refreshing ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <DataTable tableClassName="min-w-[920px]">
            <DataTableHead>
              <DataTableTh className="w-10">
                <BrandCheckbox checked={allPageSelected} indeterminate={somePageSelected} onChange={togglePage} label="Seleccionar los visibles" />
              </DataTableTh>
              <DataTableTh>Producto</DataTableTh>
              <DataTableTh numeric>Precio</DataTableTh>
              <DataTableTh numeric>Costo</DataTableTh>
              <DataTableTh>Margen</DataTableTh>
              <DataTableTh>Proveedores</DataTableTh>
              <DataTableTh>Estado</DataTableTh>
            </DataTableHead>
            <tbody>
              {products.map((product) => (
                <DataTableRow
                  key={product.id}
                  onClick={() => abrir(product.id)}
                  className={selected.includes(product.id) ? "bg-[#F1F7EA]" : undefined}
                >
                  <DataTableCell onClick={(event) => event.stopPropagation()}>
                    <BrandCheckbox checked={selected.includes(product.id)} onChange={(checked) => toggleRow(product.id, checked)} label={`Seleccionar ${product.nombre}`} />
                  </DataTableCell>
                  <DataTableCell>
                    <div className="flex items-center gap-3">
                      <FotoProducto src={product.fotoUrl} size="lista" />
                      <div className="min-w-0">
                        <Link href={hrefDe(product.id)} className="font-semibold hover:underline" onClick={(event) => event.stopPropagation()}>
                          {product.nombre}
                        </Link>
                        <p className="mt-0.5 truncate text-xs text-brand-muted">{lineaSecundaria(product) || "Sin marca ni código"}</p>
                      </div>
                    </div>
                  </DataTableCell>
                  <DataTableCell numeric className="font-semibold">
                    {formatPrice(product.precio)}
                  </DataTableCell>
                  <DataTableCell numeric>
                    <CostoProducto costo={product.costo} fuente={product.costoFuente} />
                  </DataTableCell>
                  <DataTableCell>
                    <MargenProducto margen={product.margen} />
                  </DataTableCell>
                  <DataTableCell>
                    <ProveedoresProducto proveedores={product.proveedores} />
                  </DataTableCell>
                  <DataTableCell>
                    <EstadoProducto activo={product.activo} />
                  </DataTableCell>
                </DataTableRow>
              ))}
            </tbody>
          </DataTable>
          </div>
        ) : (
          <div className={refreshing ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <div className="mb-3 flex items-center gap-2">
            <BrandCheckbox checked={allPageSelected} indeterminate={somePageSelected} onChange={togglePage} label="Seleccionar los visibles" />
            <span className="text-sm text-brand-muted">Seleccionar los de esta página</span>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => (
              <li key={product.id} className="relative rounded-2xl border border-[#E7EBE4] bg-white p-4">
                <div className="absolute right-3 top-3 z-10">
                  <BrandCheckbox checked={selected.includes(product.id)} onChange={(checked) => toggleRow(product.id, checked)} label={`Seleccionar ${product.nombre}`} />
                </div>
                <Link href={hrefDe(product.id)} className="block">
                  <FotoProducto src={product.fotoUrl} size="bloque" />
                  <div className="mt-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-display text-lg font-bold leading-tight">{product.nombre}</p>
                      <p className="mt-0.5 truncate text-xs text-brand-muted">{lineaSecundaria(product) || "Sin marca ni código"}</p>
                    </div>
                    <EstadoProducto activo={product.activo} />
                  </div>
                  <p className="mt-2 line-clamp-2 min-h-10 whitespace-pre-line text-sm text-brand-muted">
                    {product.descripcion || "Sin descripción"}
                  </p>
                  <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-[#E7EBE4] pt-3 text-sm">
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">Precio</dt>
                      <dd className="mt-0.5 font-bold tabular-nums">{formatPrice(product.precio)}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">Costo</dt>
                      <dd className="mt-0.5 tabular-nums">
                        <CostoProducto costo={product.costo} fuente={product.costoFuente} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">Margen</dt>
                      <dd className="mt-0.5">
                        <MargenProducto margen={product.margen} />
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-3">
                    <ProveedoresProducto proveedores={product.proveedores} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          </div>
        )}
      </div>

      {products.length > 0 || total > 0 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-brand-muted">
            {fromRow}–{toRow} de {total.toLocaleString("es-DO")}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setUrl({ page: Math.max(1, page - 1) })}
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
              onClick={() => setUrl({ page: Math.min(pageCount, page + 1) })}
              className="rounded-full px-4 text-sm font-bold disabled:opacity-40"
              style={{ minHeight: 40, backgroundColor: "#F3F4F6" }}
            >
              Siguiente
            </button>
          </div>
        </div>
      ) : null}

      {barMounted && typeof document !== "undefined"
        ? createPortal(
            <div className={`catalog-batch-dock${barOpen ? " is-open" : ""}`} role="region" aria-label="Acciones de selección">
              <style>{`
                .catalog-batch-dock { position: fixed; left: 1rem; right: 1rem; bottom: 0; z-index: 40; padding-bottom: 1rem; pointer-events: none; }
                @media (min-width: 768px) { .catalog-batch-dock { left: calc(232px + 1.5rem); right: 1.5rem; } }
                .catalog-batch-panel { pointer-events: auto; transform: translateY(120%); opacity: 0; transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease; }
                .catalog-batch-dock.is-open .catalog-batch-panel { transform: translateY(0); opacity: 1; }
                @media (prefers-reduced-motion: reduce) { .catalog-batch-panel { transform: none; transition: opacity 160ms ease; } }
              `}</style>
              <div className="catalog-batch-panel flex flex-col gap-2 rounded-2xl border border-[#E7EBE4] bg-white px-4 py-3 shadow-[0_-16px_40px_rgba(26,26,26,0.12)]">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="mr-1 text-sm font-bold">{selected.length || lastSelectedCount.current} seleccionados</p>
                  <button type="button" disabled={batchBusy} onClick={() => void runBatch({ activo: true })} className="rounded-full px-3.5 text-sm font-bold text-white disabled:opacity-40" style={{ minHeight: 40, backgroundColor: brand.green }}>
                    Activar
                  </button>
                  <button type="button" disabled={batchBusy} onClick={() => void runBatch({ activo: false })} className="rounded-full border px-3.5 text-sm font-bold disabled:opacity-40" style={{ minHeight: 40, borderColor: "#FECACA", backgroundColor: "#FFF7F7", color: "#B42318" }}>
                    Desactivar
                  </button>
                  <button type="button" disabled={exporting || batchBusy} onClick={() => void exportWorkbook(selected)} className="rounded-full border px-3.5 text-sm font-bold disabled:opacity-40" style={{ minHeight: 40, borderColor: "#E5E7EB", backgroundColor: "#FFFFFF" }}>
                    Exportar seleccionados
                  </button>
                  <div className="flex min-h-10 items-stretch overflow-hidden rounded-full border border-[#E5E7EB]">
                    <select value={batchCategory} disabled={batchBusy} onChange={(event) => setBatchCategory(event.target.value)} className="h-10 min-w-[10rem] border-0 bg-white px-3 text-sm font-semibold outline-none" style={{ color: brand.ink }}>
                      <option value="">Asignar categoría</option>
                      {usableCategories.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                      <option value="__new__">Nueva categoría…</option>
                    </select>
                    {batchCategory === "__new__" ? (
                      <input value={batchNewCategory} disabled={batchBusy} onChange={(event) => setBatchNewCategory(event.target.value)} placeholder="Nombre" className="h-10 w-36 border-l border-[#E5E7EB] bg-white px-3 text-sm font-semibold outline-none" />
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
                    <button type="button" disabled={selectingAll || batchBusy} onClick={() => void selectMatchingFilter()} className="font-bold underline disabled:opacity-40" style={{ color: brand.green }}>
                      {selectingAll ? "Seleccionando…" : `Seleccionar los ${total.toLocaleString("es-DO")} que coinciden con el filtro`}
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
