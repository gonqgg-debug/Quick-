"use client";

import { formatCustomerOrderDate } from "@/lib/customer-orders-shared";
import { formatPrice } from "@/lib/money";
import { brand } from "@/lib/theme";
import type { CatalogRecommendations, RepeatLastOrder } from "@/lib/catalog-recommendations";
import type { Product } from "@/lib/types";

type CatalogRecommendationsProps = {
  recommendations: CatalogRecommendations;
  cart: Record<string, number>;
  onQuantityChange: (productId: string, cantidad: number) => void;
  onRepeatLastOrder: () => void;
};

export function CatalogRecommendations({
  recommendations,
  cart,
  onQuantityChange,
  onRepeatLastOrder,
}: CatalogRecommendationsProps) {
  const { bestSellers, lastOrder, favorites } = recommendations;
  const showRepeat = Boolean(lastOrder?.items.length);
  const showFavorites = favorites.length > 0;

  if (bestSellers.length === 0 && !showRepeat && !showFavorites) {
    return null;
  }

  return (
    <div className="mt-5 space-y-6">
      {bestSellers.length > 0 ? (
        <ProductRail
          title="Lo más pedido en Quick!"
          subtitle="Los favoritos de todos en el residencial"
          products={bestSellers}
          cart={cart}
          onQuantityChange={onQuantityChange}
        />
      ) : null}

      {showRepeat && lastOrder ? (
        <RepeatLastOrderCard lastOrder={lastOrder} onRepeat={onRepeatLastOrder} />
      ) : null}

      {showFavorites ? (
        <ProductRail
          title="Tus favoritos"
          subtitle="Lo que más pides vos"
          products={favorites}
          cart={cart}
          onQuantityChange={onQuantityChange}
        />
      ) : null}
    </div>
  );
}

function ProductRail({
  title,
  subtitle,
  products,
  cart,
  onQuantityChange,
}: {
  title: string;
  subtitle: string;
  products: Product[];
  cart: Record<string, number>;
  onQuantityChange: (productId: string, cantidad: number) => void;
}) {
  return (
    <section>
      <div className="px-0">
        <h2 className="font-display text-2xl font-bold text-brand-ink">{title}</h2>
        <p className="mt-0.5 text-sm text-brand-muted">{subtitle}</p>
      </div>
      <div
        className="-mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="list"
      >
        {products.map((product) => (
          <article
            key={product.id}
            role="listitem"
            className="w-[9.75rem] shrink-0 overflow-hidden rounded-[22px] border border-black/[0.06] bg-white"
          >
            <RailPhoto product={product} />
            <div className="px-2.5 pb-2.5 pt-2">
              <h3 className="line-clamp-2 min-h-[2.5rem] text-[13px] font-bold leading-tight text-brand-ink">
                {product.nombre}
              </h3>
              <p className="mt-1 font-display text-sm font-bold" style={{ color: brand.orange }}>
                {formatPrice(product.precio)}
              </p>
              <div className="mt-2">
                <MiniStepper
                  value={cart[product.id] ?? 0}
                  onChange={(cantidad) => onQuantityChange(product.id, cantidad)}
                />
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function RepeatLastOrderCard({
  lastOrder,
  onRepeat,
}: {
  lastOrder: RepeatLastOrder;
  onRepeat: () => void;
}) {
  const preview = lastOrder.items
    .slice(0, 4)
    .map((item) => `${item.cantidad}× ${item.nombre}`)
    .join(" · ");
  const extra = lastOrder.items.length > 4 ? ` y ${lastOrder.items.length - 4} más` : "";

  return (
    <section>
      <h2 className="font-display text-2xl font-bold text-brand-ink">Pedir de nuevo</h2>
      <p className="mt-0.5 text-sm text-brand-muted">Tu pedido más reciente, en un toque</p>
      <div
        className="mt-3 overflow-hidden rounded-[24px] border bg-white p-4"
        style={{ borderColor: `${brand.orange}40` }}
      >
        <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: brand.orange }}>
          Último pedido · {formatCustomerOrderDate(lastOrder.createdAt)}
        </p>
        <p className="mt-1 text-sm font-semibold leading-snug text-brand-ink">
          {preview}
          {extra}
        </p>
        <button
          type="button"
          onClick={onRepeat}
          className="mt-4 w-full rounded-full py-3 text-sm font-bold text-white"
          style={{ backgroundColor: brand.orange, minHeight: 44 }}
        >
          Repetir tu último pedido
        </button>
      </div>
    </section>
  );
}

function RailPhoto({ product }: { product: Product }) {
  if (product.foto_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={product.foto_url} alt="" className="h-28 w-full object-cover" />
    );
  }
  return (
    <div
      className="flex h-28 items-center justify-center font-display text-3xl font-bold"
      style={{ backgroundColor: `${brand.green}18`, color: brand.green }}
    >
      {product.nombre.slice(0, 1).toUpperCase()}
    </div>
  );
}

function MiniStepper({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  if (value === 0) {
    return (
      <button
        type="button"
        onClick={() => onChange(1)}
        className="w-full rounded-full py-1.5 text-xs font-bold text-white"
        style={{ backgroundColor: brand.green }}
      >
        Agregar
      </button>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-full border" style={{ borderColor: brand.green }}>
      <button
        type="button"
        aria-label="Quitar uno"
        onClick={() => onChange(value - 1)}
        className="h-7 w-7 text-base font-bold"
        style={{ color: brand.green }}
      >
        −
      </button>
      <span className="text-xs font-bold tabular-nums">{value}</span>
      <button
        type="button"
        aria-label="Agregar uno"
        onClick={() => onChange(value + 1)}
        className="h-7 w-7 text-base font-bold"
        style={{ color: brand.green }}
      >
        +
      </button>
    </div>
  );
}
