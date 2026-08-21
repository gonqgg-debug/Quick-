"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/lib/money";
import { brand } from "@/lib/theme";
import {
  CATALOG_PRODUCTS_PAGE_SIZE,
  catalogProductsQueryString,
  type AdminCatalogProduct,
  type AdminCatalogProductList,
} from "@/lib/admin-catalog-products-shared";

const ESTADO_FILTERS: Array<{ id: "todos" | "activo" | "inactivo"; label: string }> = [
  { id: "todos", label: "Todos" },
  { id: "activo", label: "Activos" },
  { id: "inactivo", label: "Inactivos" },
];

export function AdminCatalogProducts() {
  const router = useRouter();
  const [products, setProducts] = useState<AdminCatalogProduct[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const queryString = useMemo(
    () => catalogProductsQueryString({ q: query, categoria, estado, page }),
    [query, categoria, estado, page]
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

  async function patchProduct(id: string, payload: { precio?: number; activo?: boolean }) {
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

  const pageCount = Math.max(1, Math.ceil(total / CATALOG_PRODUCTS_PAGE_SIZE));
  const fromRow = total === 0 ? 0 : (page - 1) * CATALOG_PRODUCTS_PAGE_SIZE + 1;
  const toRow = Math.min(page * CATALOG_PRODUCTS_PAGE_SIZE, total);

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Catálogo</p>
      <div className="mt-1">
        <h1 className="font-display text-2xl font-bold">Productos</h1>
        <p className="mt-1 max-w-xl text-sm text-brand-muted">
          Lista completa para revisar precios y desactivar lo que ya no se vende. El catálogo público solo muestra
          productos activos.
        </p>
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
                  {item === "All" ? "Sin categoría (All)" : item}
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
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead>
                  <tr
                    className="text-xs font-bold uppercase tracking-wide text-brand-muted"
                    style={{ backgroundColor: "#F8FAF7" }}
                  >
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
    </div>
  );
}

function ProductRow({
  product,
  zebra,
  onPatch,
  onError,
}: {
  product: AdminCatalogProduct;
  zebra: boolean;
  onPatch: (id: string, payload: { precio?: number; activo?: boolean }) => Promise<AdminCatalogProduct>;
  onError: (message: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(product.precio));
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const savingRef = useRef(false);
  const categoryLabel = !product.categoria || /^(all|todos)$/i.test(product.categoria) ? "Sin categoría" : product.categoria;

  useEffect(() => {
    if (!editing) {
      setDraft(String(product.precio));
    }
  }, [product.precio, editing]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  async function savePrice() {
    if (savingRef.current) {
      return;
    }
    const parsed = Number(draft.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < 0) {
      onError("Precio inválido");
      setDraft(String(product.precio));
      setEditing(false);
      return;
    }
    const next = Math.round(parsed * 100) / 100;
    if (next === product.precio) {
      setEditing(false);
      return;
    }
    savingRef.current = true;
    setBusy(true);
    try {
      await onPatch(product.id, { precio: next });
      onError(null);
      setEditing(false);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1400);
    } catch (saveError) {
      onError(saveError instanceof Error ? saveError.message : "No pudimos guardar el precio");
      setDraft(String(product.precio));
      setEditing(false);
    } finally {
      savingRef.current = false;
      setBusy(false);
    }
  }

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
        backgroundColor: zebra ? "#FAFBFA" : "#FFFFFF",
        opacity: product.activo ? 1 : 0.72,
      }}
    >
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
      <td className="max-w-[220px] px-3 py-1.5 font-semibold leading-tight">{product.nombre}</td>
      <td className="whitespace-nowrap px-3 py-1.5 text-brand-muted">{product.marca || "—"}</td>
      <td className="whitespace-nowrap px-3 py-1.5 text-brand-muted">{categoryLabel}</td>
      <td className="whitespace-nowrap px-3 py-1.5 text-right">
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            disabled={busy}
            inputMode="decimal"
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => void savePrice()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void savePrice();
              }
              if (event.key === "Escape") {
                setDraft(String(product.precio));
                setEditing(false);
              }
            }}
            className="h-8 w-[7.5rem] rounded-lg border px-2 text-right text-sm font-bold tabular-nums"
            style={{ borderColor: brand.green }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center justify-end gap-1 font-bold tabular-nums"
            title="Editar precio"
          >
            {formatPrice(product.precio)}
            {saved ? <span style={{ color: brand.green }}>✓</span> : null}
          </button>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-1.5 font-mono text-xs text-brand-muted">{product.codigoOdoo || "—"}</td>
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
