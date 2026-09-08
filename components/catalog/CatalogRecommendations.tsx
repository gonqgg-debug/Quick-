"use client";

import { CatalogProductPhoto } from "@/components/catalog/CatalogProductPhoto";
import type { CatalogCollectionRail } from "@/lib/catalog-collections-shared";
import type { CatalogRecommendations, RepeatLastOrder } from "@/lib/catalog-recommendations";
import { formatCustomerOrderDate } from "@/lib/customer-orders-shared";
import { formatPrice } from "@/lib/money";
import { brand } from "@/lib/theme";
import type { Product } from "@/lib/types";

export type CatalogViewAllTarget = { type: "all" } | { type: "collection"; id: string };

type CatalogRecommendationsProps = {
  recommendations: CatalogRecommendations;
  collections?: CatalogCollectionRail[];
  cart: Record<string, number>;
  onQuantityChange: (productId: string, cantidad: number) => void;
  onSelectProduct: (product: Product) => void;
  onRepeatLastOrder: () => void;
  onViewAll?: (target: CatalogViewAllTarget) => void;
};

const RAIL_TRACK =
  "relative z-0 -mx-4 mt-3 flex h-auto gap-3 overflow-x-auto overflow-y-clip overscroll-x-contain scroll-pl-4 scroll-pr-4 px-4 pb-1 snap-x snap-mandatory select-none [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [touch-action:pan-x] [&::-webkit-scrollbar]:hidden";

const RAIL_CARD =
  "w-[42%] shrink-0 snap-start overflow-clip rounded-[22px] border border-black/[0.06] bg-white";

export function CatalogRecommendations({
  recommendations,
  collections = [],
  cart,
  onQuantityChange,
  onSelectProduct,
  onRepeatLastOrder,
  onViewAll,
}: CatalogRecommendationsProps) {
  const { bestSellers, lastOrder, favorites } = recommendations;
  const showRepeat = Boolean(lastOrder?.items.length);
  const showFavorites = favorites.length > 0;
  const visibleCollections = collections.filter((collection) => collection.products.length > 0);

  if (bestSellers.length === 0 && !showRepeat && !showFavorites && visibleCollections.length === 0) {
    return null;
  }

  return (
    <div className="relative z-0 isolate mt-7 space-y-7">
      {showRepeat && lastOrder ? (
        <RepeatLastOrderCard
          lastOrder={lastOrder}
          cart={cart}
          onQuantityChange={onQuantityChange}
          onSelectProduct={onSelectProduct}
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
          onSelectProduct={onSelectProduct}
        />
      ) : null}

      {bestSellers.length > 0 ? (
        <ProductRail
          title="Lo más pedido en Quick!"
          subtitle="Los favoritos de todos en el residencial"
          products={bestSellers}
          cart={cart}
          onQuantityChange={onQuantityChange}
          onSelectProduct={onSelectProduct}
          onViewAll={onViewAll ? () => onViewAll({ type: "all" }) : undefined}
        />
      ) : null}

      {visibleCollections.map((collection) => (
        <ProductRail
          key={collection.id}
          title={collection.title}
          subtitle={collection.subtitle}
          products={collection.products}
          cart={cart}
          onQuantityChange={onQuantityChange}
          onSelectProduct={onSelectProduct}
          onViewAll={onViewAll ? () => onViewAll({ type: "collection", id: collection.id }) : undefined}
        />
      ))}
    </div>
  );
}

function ProductRail({
  title,
  subtitle,
  products,
  cart,
  onQuantityChange,
  onSelectProduct,
  onViewAll,
}: {
  title: string;
  subtitle: string;
  products: Product[];
  cart: Record<string, number>;
  onQuantityChange: (productId: string, cantidad: number) => void;
  onSelectProduct: (product: Product) => void;
  onViewAll?: () => void;
}) {
  return (
    <section>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-bold text-brand-ink">{title}</h2>
          <p className="mt-0.5 text-sm text-brand-muted">{subtitle}</p>
        </div>
        {onViewAll ? (
          <button
            type="button"
            onClick={onViewAll}
            className="shrink-0 pb-0.5 text-sm font-bold"
            style={{ color: brand.blue }}
          >
            Ver todos
          </button>
        ) : null}
      </div>
      <ProductCarouselTrack
        products={products}
        cart={cart}
        onQuantityChange={onQuantityChange}
        onSelectProduct={onSelectProduct}
      />
    </section>
  );
}

function ProductCarouselTrack({
  products,
  cart,
  onQuantityChange,
  onSelectProduct,
}: {
  products: Product[];
  cart: Record<string, number>;
  onQuantityChange: (productId: string, cantidad: number) => void;
  onSelectProduct: (product: Product) => void;
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
        <article key={product.id} role="listitem" className={`relative ${RAIL_CARD}`}>
          <button
            type="button"
            onClick={() => onSelectProduct(product)}
            className="absolute inset-0 z-10"
            aria-label={`Ver ${product.nombre}`}
          />
          <div className="pointer-events-none relative">
            <RailPhoto product={product} />
            <div className="px-2.5 pb-2.5 pt-2">
              <h3 className="line-clamp-2 min-h-[2.5rem] text-[13px] font-bold leading-tight text-brand-ink">
                {product.nombre}
              </h3>
              <p className="mt-1 font-display text-sm font-bold" style={{ color: brand.orange }}>
                {formatPrice(product.precio)}
              </p>
              <div className="pointer-events-auto mt-2">
                <MiniStepper
                  value={cart[product.id] ?? 0}
                  onChange={(cantidad) => onQuantityChange(product.id, cantidad)}
                />
              </div>
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
  onSelectProduct,
  onRepeat,
}: {
  lastOrder: RepeatLastOrder;
  cart: Record<string, number>;
  onQuantityChange: (productId: string, cantidad: number) => void;
  onSelectProduct: (product: Product) => void;
  onRepeat: () => void;
}) {
  return (
    <section>
      <h2 className="font-display text-2xl font-bold text-brand-ink">Pedir de nuevo</h2>
      <p className="mt-0.5 text-sm text-brand-muted">
        Tu pedido más reciente · {formatCustomerOrderDate(lastOrder.createdAt)}
      </p>
      <ProductCarouselTrack
        products={lastOrder.products}
        cart={cart}
        onQuantityChange={onQuantityChange}
        onSelectProduct={onSelectProduct}
      />
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
