"use client";

import { CatalogProductPhoto } from "@/components/catalog/CatalogProductPhoto";
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

const RAIL_TRACK =
  "-mx-4 mt-3 flex h-auto gap-3 overflow-x-auto overflow-y-clip overscroll-x-contain overscroll-y-auto scroll-pl-4 scroll-pr-4 px-4 pb-1 snap-x snap-mandatory select-none [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [touch-action:pan-x_pan-y] [&::-webkit-scrollbar]:hidden";

const RAIL_CARD =
  "w-[42%] shrink-0 snap-start overflow-clip rounded-[22px] border border-black/[0.06] bg-white";

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
    <div className="mt-5 space-y-7">
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
        <RepeatLastOrderCard
          lastOrder={lastOrder}
          cart={cart}
          onQuantityChange={onQuantityChange}
          onRepeat={onRepeatLastOrder}
        />
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
      <h2 className="font-display text-2xl font-bold text-brand-ink">{title}</h2>
      <p className="mt-0.5 text-sm text-brand-muted">{subtitle}</p>
      <ProductCarouselTrack products={products} cart={cart} onQuantityChange={onQuantityChange} />
    </section>
  );
}

function ProductCarouselTrack({
  products,
  cart,
  onQuantityChange,
}: {
  products: Product[];
  cart: Record<string, number>;
  onQuantityChange: (productId: string, cantidad: number) => void;
}) {
  if (products.length === 0) {
    return null;
  }

  return (
    <div
      className={RAIL_TRACK}
      role="list"
      style={{ touchAction: "pan-x pan-y", overscrollBehaviorX: "contain" }}
    >
      {products.map((product) => (
        <article key={product.id} role="listitem" className={RAIL_CARD}>
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
  );
}

function RepeatLastOrderCard({
  lastOrder,
  cart,
  onQuantityChange,
  onRepeat,
}: {
  lastOrder: RepeatLastOrder;
  cart: Record<string, number>;
  onQuantityChange: (productId: string, cantidad: number) => void;
  onRepeat: () => void;
}) {
  return (
    <section>
      <h2 className="font-display text-2xl font-bold text-brand-ink">Pedir de nuevo</h2>
      <p className="mt-0.5 text-sm text-brand-muted">
        Tu pedido más reciente · {formatCustomerOrderDate(lastOrder.createdAt)}
      </p>
      <ProductCarouselTrack products={lastOrder.products} cart={cart} onQuantityChange={onQuantityChange} />
      <button
        type="button"
        onClick={onRepeat}
        className="mt-3 w-full rounded-full py-3 text-sm font-bold text-white"
        style={{ backgroundColor: brand.orange, minHeight: 44 }}
      >
        Repetir tu último pedido
      </button>
    </section>
  );
}

function RailPhoto({ product }: { product: Product }) {
  return (
    <CatalogProductPhoto
      product={product}
      className="h-28 w-full"
      sizes="42vw"
      roundedClassName="rounded-none"
    />
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
