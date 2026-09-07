"use client";

import { useEffect, useState } from "react";
import { CatalogProductPhoto } from "@/components/catalog/CatalogProductPhoto";
import { fetchCatalogProductsPage } from "@/lib/catalog-products-client";
import { formatPrice } from "@/lib/money";
import { brand } from "@/lib/theme";
import type { Product } from "@/lib/types";

const RELATED_LIMIT = 8;

type ProductDetailSheetProps = {
  product: Product;
  sessionId: string;
  cartQuantity: number;
  relatedSeed?: Product[];
  onClose: () => void;
  onQuantityChange: (productId: string, cantidad: number) => void;
  onSelectRelated: (product: Product) => void;
  onRelatedLoaded?: (products: Product[]) => void;
};

export function ProductDetailSheet({
  product,
  sessionId,
  cartQuantity,
  relatedSeed = [],
  onClose,
  onQuantityChange,
  onSelectRelated,
  onRelatedLoaded,
}: ProductDetailSheetProps) {
  const [qty, setQty] = useState(() => Math.max(cartQuantity, 1));
  const [related, setRelated] = useState(() => excludeProduct(relatedSeed, product.id));

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!product.categoria) {
      return;
    }
    const controller = new AbortController();
    void fetchCatalogProductsPage({
      sessionId,
      categoria: product.categoria,
      limit: 12,
      signal: controller.signal,
    })
      .then((page) => {
        onRelatedLoaded?.(page.products);
        setRelated(excludeProduct(page.products, product.id).slice(0, RELATED_LIMIT));
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setRelated((current) => excludeProduct(current, product.id));
        }
      });
    return () => controller.abort();
  }, [onRelatedLoaded, product.categoria, product.id, sessionId]);

  const alreadyInCart = cartQuantity > 0 && qty === cartQuantity;
  const buttonLabel = cartQuantity === 0 ? "Agregar" : alreadyInCart ? "Agregado" : "Actualizar";

  function handleAdd() {
    if (!alreadyInCart) {
      onQuantityChange(product.id, qty);
    }
    onClose();
  }

  const subtitle = [product.marca, product.categoria].filter(Boolean).join(" · ");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="Cerrar producto"
        className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-detail-title"
        className="relative z-10 flex h-[min(96vh,52rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_-24px_80px_rgba(0,0,0,0.35)]"
      >
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="relative bg-white px-4 pb-2 pt-3">
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="absolute left-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-[#F3F4F6] text-brand-ink"
            >
              <CloseIcon />
            </button>
            <div className="mx-auto mt-6 flex h-56 w-full items-center justify-center sm:h-64">
              <CatalogProductPhoto
                product={product}
                className="h-full w-full"
                sizes="(min-width: 512px) 512px, 100vw"
                roundedClassName="rounded-none"
                objectFit="contain"
              />
            </div>
          </div>

          <div className="px-5 pb-6 pt-2">
            <p className="font-display text-[2rem] font-bold leading-none text-brand-ink">
              {formatPrice(product.precio)}
            </p>
            <h2 id="product-detail-title" className="font-display mt-3 text-2xl font-bold leading-tight text-brand-ink">
              {product.nombre}
            </h2>
            {subtitle ? <p className="mt-1.5 text-sm text-brand-muted">{subtitle}</p> : null}

            <div className="mt-5">
              <span
                className="inline-flex rounded-full border px-3.5 py-1.5 text-sm font-bold"
                style={{ borderColor: "rgba(0,0,0,0.12)", backgroundColor: "#F3F4F6" }}
              >
                Detalles
              </span>
              <p className="mt-3 text-sm leading-relaxed text-brand-ink">
                {product.descripcion?.trim() ||
                  `Producto de ${product.categoria || "catálogo"}${product.marca ? ` · ${product.marca}` : ""}.`}
              </p>
            </div>

            {related.length > 0 ? (
              <div className="mt-8">
                <h3 className="font-display text-xl font-bold text-brand-ink">Productos relacionados</h3>
                <div
                  className="-mx-5 mt-3 flex gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  role="list"
                >
                  {related.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="listitem"
                      onClick={() => onSelectRelated(item)}
                      className="w-[38%] shrink-0 overflow-hidden rounded-[22px] border border-black/[0.06] bg-white text-left"
                    >
                      <CatalogProductPhoto
                        product={item}
                        className="h-24 w-full"
                        sizes="38vw"
                        roundedClassName="rounded-none"
                      />
                      <span className="block px-2.5 pb-2.5 pt-2">
                        <span className="line-clamp-2 min-h-[2.4rem] text-[13px] font-bold leading-tight text-brand-ink">
                          {item.nombre}
                        </span>
                        <span className="mt-1 block font-display text-sm font-bold" style={{ color: brand.orange }}>
                          {formatPrice(item.precio)}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-black/[0.06] bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <div
            className="inline-flex h-12 shrink-0 items-center rounded-full border bg-white"
            style={{ borderColor: "rgba(0,0,0,0.12)" }}
          >
            <button
              type="button"
              aria-label="Quitar uno"
              disabled={qty <= 1}
              onClick={() => setQty((current) => Math.max(1, current - 1))}
              className="h-12 w-11 text-xl font-bold disabled:opacity-30"
              style={{ color: brand.ink }}
            >
              −
            </button>
            <span className="min-w-6 text-center text-base font-bold tabular-nums">{qty}</span>
            <button
              type="button"
              aria-label="Agregar uno"
              onClick={() => setQty((current) => Math.min(99, current + 1))}
              className="h-12 w-11 text-xl font-bold"
              style={{ color: brand.ink }}
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={handleAdd}
            className="h-12 min-w-0 flex-1 rounded-full text-base font-bold text-white"
            style={{ backgroundColor: brand.green }}
          >
            {buttonLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

function excludeProduct(products: Product[], productId: string): Product[] {
  return products.filter((item) => item.id !== productId).slice(0, RELATED_LIMIT);
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}
