"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CatalogProductPhoto } from "@/components/catalog/CatalogProductPhoto";
import { formatPrice } from "@/lib/money";
import { SEARCH_DEBOUNCE_MS } from "@/lib/catalog-search";
import { brand } from "@/lib/theme";
import type { Product } from "@/lib/types";

type EditorItem = {
  productId: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  estado: string;
  fotoUrl?: string | null;
};

type StaffOrderEditorProps = {
  orderId: string;
  orderNumber: string;
  items: EditorItem[];
  onClose: () => void;
  onSaved: () => void;
  onUnauthorized?: () => void;
};

export function StaffOrderEditor({
  orderId,
  orderNumber,
  items,
  onClose,
  onSaved,
  onUnauthorized,
}: StaffOrderEditorProps) {
  const [draft, setDraft] = useState<Record<string, EditorItem>>(() => itemsFromOrder(items));
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSearching(true);
      try {
        const response = await fetch(
          `/api/staff/products?q=${encodeURIComponent(debounced)}`,
          { credentials: "include" }
        );
        if (response.status === 401) {
          onUnauthorized?.();
          return;
        }
        const body = (await response.json()) as { products?: Product[]; error?: string };
        if (!response.ok) {
          throw new Error(body.error || "No pudimos buscar productos");
        }
        if (!cancelled) {
          setResults(body.products ?? []);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Error al buscar");
        }
      } finally {
        if (!cancelled) {
          setSearching(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debounced, onUnauthorized]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const lines = useMemo(
    () => Object.values(draft).filter((item) => item.cantidad > 0),
    [draft]
  );
  const total = useMemo(
    () => lines.reduce((sum, item) => sum + item.precioUnitario * item.cantidad, 0),
    [lines]
  );

  const setQuantity = useCallback((item: EditorItem, cantidad: number) => {
    setDraft((current) => {
      const next = { ...current };
      if (cantidad <= 0) {
        delete next[item.productId];
      } else {
        next[item.productId] = { ...item, cantidad };
      }
      return next;
    });
  }, []);

  function addProduct(product: Product) {
    setDraft((current) => {
      const existing = current[product.id];
      if (existing) {
        return {
          ...current,
          [product.id]: { ...existing, cantidad: existing.cantidad + 1 },
        };
      }
      return {
        ...current,
        [product.id]: {
          productId: product.id,
          nombre: product.nombre,
          cantidad: 1,
          precioUnitario: product.precio,
          estado: "ok",
          fotoUrl: product.foto_url,
        },
      };
    });
  }

  async function handleSave() {
    if (saving || lines.length === 0) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/staff/orders/${orderId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines.map((item) => ({
            productId: item.productId,
            cantidad: item.cantidad,
          })),
        }),
      });
      if (response.status === 401) {
        onUnauthorized?.();
        return;
      }
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(body?.error || "No pudimos guardar el pedido");
      }
      onSaved();
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        className="absolute inset-0 bg-black/35"
        aria-label="Cerrar editor"
        onClick={onClose}
      />
      <aside
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-[-12px_0_40px_rgba(26,26,26,0.18)]"
        role="dialog"
        aria-modal="true"
        aria-label="Editar pedido"
      >
        <div className="flex items-start justify-between gap-2 border-b px-4 py-3" style={{ borderColor: "#F3F4F6" }}>
          <div className="min-w-0">
            <p className="font-display text-lg font-bold">Editar pedido #{orderNumber}</p>
            <p className="text-xs text-brand-muted">Agrega o quita productos y avisa al cliente.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-bold"
            style={{ backgroundColor: "#F3F4F6", color: brand.muted }}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        {error ? (
          <p className="mx-4 mt-3 rounded-2xl px-3 py-2 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>
            {error}
          </p>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <ul className="space-y-2">
            {lines.length === 0 ? (
              <li className="py-4 text-center text-sm text-brand-muted">El pedido no puede quedar vacío.</li>
            ) : (
              lines.map((item) => (
                <li key={item.productId} className="flex items-center gap-2 rounded-2xl px-3 py-2" style={{ backgroundColor: "#F8FAF7" }}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{item.nombre}</p>
                    <p className="text-xs text-brand-muted">{formatPrice(item.precioUnitario * item.cantidad)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="flex h-9 w-9 items-center justify-center rounded-full text-lg font-bold"
                      style={{ backgroundColor: "#FFFFFF", color: brand.ink }}
                      onClick={() => setQuantity(item, item.cantidad - 1)}
                      aria-label={`Quitar ${item.nombre}`}
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm font-bold">{item.cantidad}</span>
                    <button
                      type="button"
                      className="flex h-9 w-9 items-center justify-center rounded-full text-lg font-bold text-white"
                      style={{ backgroundColor: brand.green }}
                      onClick={() => setQuantity(item, item.cantidad + 1)}
                      aria-label={`Agregar ${item.nombre}`}
                    >
                      +
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>

          <label className="mt-5 block text-xs font-bold uppercase tracking-wide text-brand-muted">
            Agregar producto
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar en el catálogo"
              className="mt-2 w-full rounded-full border px-4 py-3 text-sm outline-none"
              style={{ borderColor: "#E5E7EB", fontSize: 16, minHeight: 48 }}
            />
          </label>
          {searching ? <p className="mt-2 text-xs text-brand-muted">Buscando...</p> : null}
          <ul className="mt-2 space-y-1">
            {results.map((product) => (
              <li key={product.id}>
                <button
                  type="button"
                  onClick={() => addProduct(product)}
                  className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left"
                >
                  <CatalogProductPhoto product={product} className="h-10 w-10" sizes="40px" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{product.nombre}</span>
                    <span className="text-xs text-brand-muted">{formatPrice(product.precio)}</span>
                  </span>
                  <span className="text-lg font-bold" style={{ color: brand.green }}>
                    +
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div
          className="border-t px-4 py-3"
          style={{ borderColor: "#F3F4F6", paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-bold text-brand-muted">Nuevo total</span>
            <span className="font-display text-xl font-bold">{formatPrice(total)}</span>
          </div>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || lines.length === 0}
            className="w-full rounded-full text-sm font-bold text-white disabled:opacity-50"
            style={{ backgroundColor: brand.orange, minHeight: 48 }}
          >
            {saving ? "Guardando..." : "Guardar y avisar al cliente"}
          </button>
        </div>
      </aside>
    </div>
  );
}

function itemsFromOrder(items: EditorItem[]): Record<string, EditorItem> {
  const next: Record<string, EditorItem> = {};
  for (const item of items) {
    if (item.estado === "eliminado" || item.estado === "faltante") {
      continue;
    }
    const existing = next[item.productId];
    if (existing) {
      next[item.productId] = { ...existing, cantidad: existing.cantidad + item.cantidad };
    } else {
      next[item.productId] = { ...item };
    }
  }
  return next;
}
