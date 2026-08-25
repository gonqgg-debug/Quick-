"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { CatalogProductPhoto } from "@/components/catalog/CatalogProductPhoto";
import { productAnchor } from "@/lib/catalog-search";
import { formatPrice } from "@/lib/money";
import { brand } from "@/lib/theme";
import type { Product } from "@/lib/types";

type CatalogProductListProps = {
  products: Product[];
  cart: Record<string, number>;
  highlightedProductId: string | null;
  showCategory: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onQuantityChange: (productId: string, cantidad: number) => void;
};

export function CatalogProductList({
  products,
  cart,
  highlightedProductId,
  showCategory,
  hasMore,
  loadingMore,
  onLoadMore,
  onQuantityChange,
}: CatalogProductListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    function update() {
      setScrollMargin(listRef.current?.offsetTop ?? 0);
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [products.length]);

  const virtualizer = useWindowVirtualizer({
    count: products.length,
    estimateSize: () => 152,
    overscan: 8,
    gap: 12,
    scrollMargin,
    getItemKey: (index) => products[index]?.id ?? index,
  });

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onLoadMore();
        }
      },
      { root: null, rootMargin: "480px 0px", threshold: 0 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore, products.length]);

  return (
    <div>
      <div ref={listRef}>
        <div
          className="relative w-full"
          style={{ height: `${virtualizer.getTotalSize()}px` }}
        >
          {virtualizer.getVirtualItems().map((item) => {
            const product = products[item.index];
            if (!product) {
              return null;
            }
            return (
              <div
                key={product.id}
                data-index={item.index}
                ref={virtualizer.measureElement}
                className="absolute left-0 top-0 w-full"
                style={{
                  transform: `translateY(${item.start - virtualizer.options.scrollMargin}px)`,
                }}
              >
                <CatalogProductCard
                  product={product}
                  cantidad={cart[product.id] ?? 0}
                  highlighted={highlightedProductId === product.id}
                  showCategory={showCategory}
                  onQuantityChange={onQuantityChange}
                />
              </div>
            );
          })}
        </div>
      </div>

      {loadingMore ? <CatalogPageSpinner /> : null}

      {hasMore ? (
        <div ref={sentinelRef} className="h-8 w-full" aria-hidden="true" />
      ) : null}
    </div>
  );
}

export function CatalogProductSkeletons({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="h-[9.5rem] animate-pulse rounded-3xl bg-gray-100"
        />
      ))}
    </div>
  );
}

function CatalogPageSpinner() {
  return (
    <div className="flex items-center justify-center gap-2 py-4" role="status" aria-live="polite">
      <span
        className="h-5 w-5 animate-spin rounded-full border-2 border-transparent"
        style={{ borderTopColor: brand.green, borderRightColor: brand.green }}
      />
      <span className="text-xs font-semibold text-brand-muted">Cargando más productos…</span>
    </div>
  );
}

const CatalogProductCard = memo(function CatalogProductCard({
  product,
  cantidad,
  highlighted,
  showCategory,
  onQuantityChange,
}: {
  product: Product;
  cantidad: number;
  highlighted: boolean;
  showCategory: boolean;
  onQuantityChange: (productId: string, cantidad: number) => void;
}) {
  const handleQuantity = useCallback(
    (next: number) => {
      onQuantityChange(product.id, next);
    },
    [onQuantityChange, product.id]
  );

  return (
    <article
      id={productAnchor(product.id)}
      className="scroll-mt-36 overflow-hidden rounded-3xl border bg-white shadow-[0_8px_24px_rgba(26,26,26,0.06)] transition-[box-shadow,border-color] duration-300"
      style={{
        borderColor: highlighted ? brand.orange : "rgba(26,26,26,0.06)",
        boxShadow: highlighted
          ? `0 0 0 3px ${brand.orange}55, 0 8px 24px rgba(26,26,26,0.06)`
          : "0 8px 24px rgba(26,26,26,0.06)",
      }}
    >
      <div className="flex gap-3 p-3">
        <CatalogProductPhoto
          product={product}
          className="h-[7.25rem] w-[7.25rem]"
          sizes="116px"
        />
        <div className="min-w-0 flex-1">
          {showCategory ? (
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-muted">
              {product.categoria}
            </p>
          ) : null}
          {product.marca ? (
            <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: brand.blue }}>
              {product.marca}
            </p>
          ) : null}
          <h3 className="font-display mt-0.5 text-[1.15rem] font-bold leading-tight text-brand-ink">
            {product.nombre}
          </h3>
          {product.descripcion ? (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-brand-muted">
              {product.descripcion}
            </p>
          ) : null}
          <div className="mt-3 flex items-end justify-between gap-2">
            <p className="font-display text-lg font-bold" style={{ color: brand.orange }}>
              {formatPrice(product.precio)}
            </p>
            <QuantityStepper value={cantidad} onChange={handleQuantity} />
          </div>
        </div>
      </div>
    </article>
  );
});

function QuantityStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  if (value === 0) {
    return (
      <button
        type="button"
        onClick={() => onChange(1)}
        className="rounded-full px-3.5 py-1.5 text-sm font-bold text-white"
        style={{ backgroundColor: brand.green }}
      >
        Agregar
      </button>
    );
  }

  return (
    <div className="inline-flex items-center rounded-full border bg-white" style={{ borderColor: brand.green }}>
      <button
        type="button"
        aria-label="Quitar uno"
        onClick={() => onChange(value - 1)}
        className="h-8 w-8 text-lg font-bold"
        style={{ color: brand.green }}
      >
        −
      </button>
      <span className="min-w-6 text-center text-sm font-bold tabular-nums" style={{ color: brand.ink }}>
        {value}
      </span>
      <button
        type="button"
        aria-label="Agregar uno"
        onClick={() => onChange(value + 1)}
        className="h-8 w-8 text-lg font-bold"
        style={{ color: brand.green }}
      >
        +
      </button>
    </div>
  );
}
