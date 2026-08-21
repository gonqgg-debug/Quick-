"use client";

import { useEffect, useId, useRef, useState } from "react";
import { formatPrice } from "@/lib/money";
import {
  rankSearchSuggestions,
  SEARCH_DEBOUNCE_MS,
  SEARCH_SUGGESTION_MIN_CHARS,
} from "@/lib/catalog-search";
import { brand } from "@/lib/theme";
import type { Product } from "@/lib/types";

type CatalogSearchProps = {
  query: string;
  products: Product[];
  onQueryChange: (value: string) => void;
  onSelectProduct: (product: Product) => void;
  onRequestProduct: (query: string) => void;
};

export function CatalogSearch({
  query,
  products,
  onQueryChange,
  onSelectProduct,
  onRequestProduct,
}: CatalogSearchProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const ready = debouncedQuery.length >= SEARCH_SUGGESTION_MIN_CHARS;
  const suggestions = ready ? rankSearchSuggestions(products, debouncedQuery) : [];
  const showDropdown = open && query.trim().length >= SEARCH_SUGGESTION_MIN_CHARS && ready;

  return (
    <div ref={rootRef} className="relative mt-3">
      <label className="relative block">
        <span className="sr-only">Buscar productos</span>
        <SearchIcon />
        <input
          value={query}
          onChange={(event) => {
            onQueryChange(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar producto, marca o categoría"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-autocomplete="list"
          autoComplete="off"
          className="w-full rounded-full border bg-white py-2.5 pl-11 pr-4 text-sm text-brand-ink outline-none placeholder:text-brand-muted"
          style={{ borderColor: query ? brand.green : `${brand.muted}40` }}
        />
      </label>

      {showDropdown ? (
        <div
          id={listboxId}
          role="listbox"
          className="absolute inset-x-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-3xl border bg-white shadow-[0_16px_40px_rgba(26,26,26,0.14)]"
          style={{ borderColor: "rgba(0,0,0,0.06)" }}
        >
          {suggestions.length > 0 ? (
            <ul>
              {suggestions.map((product) => (
                <li key={product.id} role="option" aria-selected="false">
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onSelectProduct(product);
                    }}
                    className="flex w-full items-center gap-3 border-b px-3 py-2.5 text-left last:border-b-0 hover:bg-black/[0.03] active:bg-black/[0.05]"
                    style={{ borderColor: "rgba(0,0,0,0.04)" }}
                  >
                    <SuggestionPhoto product={product} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-brand-ink">{product.nombre}</span>
                      {product.marca ? (
                        <span className="mt-0.5 block truncate text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
                          {product.marca}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 font-display text-sm font-bold" style={{ color: brand.orange }}>
                      {formatPrice(product.precio)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <ProductRequestEmpty
              query={debouncedQuery}
              compact
              onRequest={() => {
                setOpen(false);
                onRequestProduct(debouncedQuery);
              }}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}

export function ProductRequestEmpty({
  query,
  compact = false,
  onRequest,
}: {
  query: string;
  compact?: boolean;
  onRequest: () => void;
}) {
  return (
    <div className={compact ? "px-4 py-4" : "mt-8 rounded-3xl border border-dashed px-5 py-10 text-center"} style={compact ? undefined : { borderColor: `${brand.muted}40` }}>
      <p className={`text-brand-muted ${compact ? "text-sm" : "text-base"}`}>
        No encontramos “{query}”.
      </p>
      <button
        type="button"
        onClick={onRequest}
        className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-bold text-white ${compact ? "mt-3" : "mt-5"}`}
        style={{ backgroundColor: brand.green }}
      >
        Solicitar este producto
      </button>
    </div>
  );
}

function SuggestionPhoto({ product }: { product: Product }) {
  if (product.foto_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={product.foto_url}
        alt=""
        className="h-11 w-11 shrink-0 rounded-xl object-cover"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl font-display text-base font-bold"
      style={{ backgroundColor: `${brand.green}18`, color: brand.green }}
    >
      {product.nombre.slice(0, 1).toUpperCase()}
    </span>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2"
      fill="none"
      stroke={brand.muted}
      strokeWidth="2.2"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.2-3.2" strokeLinecap="round" />
    </svg>
  );
}
