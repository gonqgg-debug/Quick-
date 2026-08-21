"use client";

import { useEffect, useMemo, useState } from "react";
import { CustomerRegisterForm } from "@/components/catalog/CustomerRegisterForm";
import { DeliveryAddressFields } from "@/components/catalog/DeliveryAddressFields";
import { MyOrders, orderMetodoPago, orderToCart } from "@/components/catalog/MyOrders";
import { MyProfile } from "@/components/catalog/MyProfile";
import { CatalogRecommendations } from "@/components/catalog/CatalogRecommendations";
import { CatalogSearch, ProductRequestEmpty } from "@/components/catalog/CatalogSearch";
import { ProductRequestSheet } from "@/components/catalog/ProductRequestSheet";
import { PromoBanner } from "@/components/catalog/PromoBanner";
import { Badge } from "@/components/brand/Badge";
import { CartIcon } from "@/components/brand/CartIcon";
import { Logo } from "@/components/brand/Logo";
import { CATALOG_PROMO_BANNERS } from "@/lib/catalog-promo";
import { productAnchor } from "@/lib/catalog-search";
import { MY_ORDERS_HASH, MY_PROFILE_HASH, type CustomerOrder } from "@/lib/customer-orders-shared";
import type { CatalogRecommendations as CatalogRecommendationsData } from "@/lib/catalog-recommendations";
import {
  ADDRESS_LABELS,
  EMPTY_ADDRESS_DRAFT,
  addressDraftToFields,
  isAddressDraftComplete,
  type AddressDraft,
  type AddressLabel,
  type CatalogCustomer,
  type CustomerAddress,
} from "@/lib/customers";
import { formatPrice } from "@/lib/money";
import { brand, brandChipColor, categoryEmoji, isPharmaCategory } from "@/lib/theme";
import type { CreateOrderPayload, MetodoPago, OrderDraft, Product } from "@/lib/types";

type CatalogExperienceProps = {
  sessionId: string;
  products: Product[];
  editOrder?: OrderDraft | null;
  customer?: CatalogCustomer | null;
  recommendations?: CatalogRecommendationsData;
};

type Step = "register" | "catalog" | "checkout" | "success";
type CatalogView = "shop" | "orders" | "profile";
type CartMap = Record<string, number>;
type CartLine = { product: Product; cantidad: number; subtotal: number };

function cartStorageKey(sessionId: string) {
  return `quick-orders:cart:${sessionId}`;
}

function readCart(sessionId: string): CartMap | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(cartStorageKey(sessionId));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as CartMap;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function cartFromDraft(editOrder: OrderDraft | null | undefined): CartMap {
  if (!editOrder) {
    return {};
  }
  const next: CartMap = {};
  for (const item of editOrder.items) {
    next[item.productId] = item.cantidad;
  }
  return next;
}

function categoryAnchor(categoria: string) {
  return `cat-${categoria.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}`;
}

function matchesQuery(product: Product, query: string) {
  if (!query) {
    return true;
  }
  const haystack = [product.nombre, product.marca, product.descripcion, product.categoria]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function groupProducts(products: Product[]) {
  const groups = new Map<string, Product[]>();
  for (const product of products) {
    const list = groups.get(product.categoria) ?? [];
    list.push(product);
    groups.set(product.categoria, list);
  }
  return Array.from(groups.entries());
}

function defaultAddress(customer: CatalogCustomer | null | undefined): CustomerAddress | null {
  if (!customer?.addresses.length) {
    return null;
  }
  return customer.addresses.find((address) => address.esPredeterminada) ?? customer.addresses[0];
}

const EMPTY_RECOMMENDATIONS: CatalogRecommendationsData = {
  bestSellers: [],
  lastOrder: null,
  favorites: [],
};

export function CatalogExperience({
  sessionId,
  products,
  editOrder = null,
  customer: initialCustomer = null,
  recommendations = EMPTY_RECOMMENDATIONS,
}: CatalogExperienceProps) {
  const [customer, setCustomer] = useState<CatalogCustomer | null>(initialCustomer);
  const [step, setStep] = useState<Step>(initialCustomer ? "catalog" : "register");
  const [view, setView] = useState<CatalogView>("shop");
  const [hashReady, setHashReady] = useState(false);
  const [catalogEditOrderId, setCatalogEditOrderId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartMap>(() => cartFromDraft(editOrder));
  const [cartOpen, setCartOpen] = useState(false);
  const activeEditOrderId = catalogEditOrderId ?? editOrder?.orderId ?? null;
  const isEditing = Boolean(activeEditOrderId);
  const [hydrated, setHydrated] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedProductId, setHighlightedProductId] = useState<string | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestPrefill, setRequestPrefill] = useState("");
  const [direccion, setDireccion] = useState(
    editOrder?.direccion ?? defaultAddress(initialCustomer)?.direccion ?? ""
  );
  const [selectedAddressId, setSelectedAddressId] = useState<string | "new">(
    defaultAddress(initialCustomer)?.id ?? "new"
  );
  const [newEtiqueta, setNewEtiqueta] = useState<AddressLabel>("Casa");
  const [newAddress, setNewAddress] = useState<AddressDraft>(EMPTY_ADDRESS_DRAFT);
  const [metodoPago, setMetodoPago] = useState<MetodoPago | null>(editOrder?.metodoPago ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [reorderNotice, setReorderNotice] = useState<string | null>(null);

  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products]
  );

  const normalizedQuery = query.trim().toLowerCase();
  const visibleProducts = useMemo(
    () => products.filter((product) => matchesQuery(product, normalizedQuery)),
    [products, normalizedQuery]
  );

  const grouped = useMemo(() => groupProducts(visibleProducts), [visibleProducts]);
  const marketGroups = grouped.filter(([categoria]) => !isPharmaCategory(categoria));
  const pharmaGroups = grouped.filter(([categoria]) => isPharmaCategory(categoria));
  const chipCategories = useMemo(() => {
    const all = groupProducts(products);
    return [
      ...all.filter(([categoria]) => !isPharmaCategory(categoria)),
      ...all.filter(([categoria]) => isPharmaCategory(categoria)),
    ];
  }, [products]);

  const lines = useMemo(() => {
    return Object.entries(cart)
      .map(([productId, cantidad]) => {
        const product = productById.get(productId);
        if (!product || cantidad <= 0) {
          return null;
        }
        return { product, cantidad, subtotal: product.precio * cantidad };
      })
      .filter((line): line is CartLine => Boolean(line));
  }, [cart, productById]);

  const itemCount = lines.reduce((sum, line) => sum + line.cantidad, 0);
  const total = lines.reduce((sum, line) => sum + line.subtotal, 0);

  useEffect(() => {
    const stored = readCart(sessionId);
    setCart(stored ?? cartFromDraft(editOrder));
    if (editOrder?.direccion) {
      setDireccion((current) => current || editOrder.direccion);
      const match = customer?.addresses.find((address) => address.direccion === editOrder.direccion);
      if (match) {
        setSelectedAddressId(match.id);
      }
    }
    if (editOrder?.metodoPago) {
      setMetodoPago((current) => current ?? editOrder.metodoPago);
    }
    setHydrated(true);
  }, [sessionId, editOrder, customer]);

  useEffect(() => {
    if (!highlightedProductId) {
      return;
    }
    const id = productAnchor(highlightedProductId);
    const scrollTimer = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
    const clearTimer = window.setTimeout(() => setHighlightedProductId(null), 1800);
    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
    };
  }, [highlightedProductId]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    window.localStorage.setItem(cartStorageKey(sessionId), JSON.stringify(cart));
  }, [cart, hydrated, sessionId]);

  useEffect(() => {
    if (!cartOpen) {
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [cartOpen]);

  useEffect(() => {
    if (step !== "catalog") {
      return;
    }

    function applyHash() {
      const hash = window.location.hash;
      const nextView: CatalogView =
        hash === `#${MY_ORDERS_HASH}` ? "orders" : hash === `#${MY_PROFILE_HASH}` ? "profile" : "shop";
      setView(nextView);
      if (nextView !== "shop") {
        window.scrollTo({ top: 0, left: 0 });
      }
    }

    applyHash();
    setHashReady(true);
    window.addEventListener("hashchange", applyHash);
    window.addEventListener("popstate", applyHash);
    return () => {
      window.removeEventListener("hashchange", applyHash);
      window.removeEventListener("popstate", applyHash);
    };
  }, [step]);

  function setQuantity(productId: string, cantidad: number) {
    setCart((current) => {
      const next = { ...current };
      if (cantidad <= 0) {
        delete next[productId];
      } else {
        next[productId] = cantidad;
      }
      return next;
    });
  }

  function repeatLastOrder() {
    const lastOrder = recommendations.lastOrder;
    if (!lastOrder) {
      return;
    }
    const missing = lastOrder.items
      .filter((item) => !item.available || !productById.has(item.productId))
      .map((item) => item.nombre);
    setCart((current) => {
      const next = { ...current };
      for (const item of lastOrder.items) {
        if (!item.available || !productById.has(item.productId)) {
          continue;
        }
        next[item.productId] = (next[item.productId] ?? 0) + item.cantidad;
      }
      return next;
    });
    if (missing.length > 0) {
      setReorderNotice(`No pudimos agregar: ${missing.join(", ")}.`);
    } else {
      setReorderNotice("Listo, agregamos tu último pedido al carrito.");
    }
    setCartOpen(true);
  }

  async function confirmOrder() {
    const addingNew = !customer || selectedAddressId === "new";
    const newFields = addingNew ? addressDraftToFields(newAddress, newEtiqueta) : null;
    const delivery = addingNew ? newFields?.direccion ?? "" : direccion.trim();
    if (!metodoPago || delivery.length < 6 || lines.length === 0) {
      return;
    }
    if (addingNew && !newFields) {
      return;
    }

    const payload: CreateOrderPayload = {
      sessionId,
      items: lines.map((line) => ({
        productId: line.product.id,
        cantidad: line.cantidad,
      })),
      direccion: delivery,
      metodoPago: metodoPago,
      addressId: customer && selectedAddressId !== "new" ? selectedAddressId : null,
      nuevaDireccion: customer && addingNew && newFields ? newFields : null,
    };

    setSubmitting(true);
    setSubmitError(null);

    try {
      const endpoint = activeEditOrderId ? `/api/orders/${activeEditOrderId}` : "/api/orders";
      const response = await fetch(endpoint, {
        method: activeEditOrderId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as {
        success?: boolean;
        orderId?: string;
        error?: string;
      };

      if (!response.ok || !body.success || !body.orderId) {
        setSubmitError(
          body.error ??
            (activeEditOrderId
              ? "No pudimos guardar los cambios. Inténtalo de nuevo."
              : "No pudimos confirmar el pedido. Inténtalo de nuevo.")
        );
        return;
      }

      setOrderId(body.orderId);
      setCart({});
      window.localStorage.removeItem(cartStorageKey(sessionId));
      setStep("success");
    } catch {
      setSubmitError(
        activeEditOrderId
          ? "No pudimos guardar los cambios. Revisa tu conexión."
          : "No pudimos confirmar el pedido. Revisa tu conexión."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function goToHashView(next: Exclude<CatalogView, "shop">, hash: string) {
    setCartOpen(false);
    setView(next);
    if (window.location.hash !== `#${hash}`) {
      window.location.hash = hash;
    }
    window.scrollTo({ top: 0, left: 0 });
  }

  function goToMyOrders() {
    goToHashView("orders", MY_ORDERS_HASH);
  }

  function goToMyProfile() {
    goToHashView("profile", MY_PROFILE_HASH);
  }

  function goToShop() {
    setView("shop");
    if (window.location.hash === `#${MY_ORDERS_HASH}` || window.location.hash === `#${MY_PROFILE_HASH}`) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
  }

  function openProductRequest(prefill = "") {
    setRequestPrefill(prefill);
    setRequestOpen(true);
  }

  function startModify(order: CustomerOrder) {
    setCatalogEditOrderId(order.id);
    setCart(orderToCart(order));
    setDireccion(order.direccion);
    const match = customer?.addresses.find((address) => address.direccion === order.direccion);
    if (match) {
      setSelectedAddressId(match.id);
    }
    const metodo = orderMetodoPago(order);
    if (metodo) {
      setMetodoPago(metodo);
    }
    goToShop();
    setCartOpen(true);
  }

  if (step === "register") {
    return (
      <CustomerRegisterForm
        sessionId={sessionId}
        onRegistered={(registered) => {
          setCustomer(registered);
          const first = defaultAddress(registered);
          if (first) {
            setDireccion(first.direccion);
            setSelectedAddressId(first.id);
          }
          setStep("catalog");
        }}
      />
    );
  }

  if (step === "success") {
    return (
      <SuccessScreen
        orderId={orderId}
        isEditing={isEditing}
        onViewOrders={() => {
          setCatalogEditOrderId(null);
          setStep("catalog");
          goToMyOrders();
        }}
        onKeepShopping={() => {
          setCatalogEditOrderId(null);
          goToShop();
          setStep("catalog");
        }}
      />
    );
  }

  if (step === "checkout") {
    return (
      <CheckoutScreen
        lines={lines}
        total={total}
        direccion={direccion}
        metodoPago={metodoPago}
        submitting={submitting}
        submitError={submitError}
        isEditing={isEditing}
        addresses={customer?.addresses ?? []}
        selectedAddressId={selectedAddressId}
        newEtiqueta={newEtiqueta}
        newAddress={newAddress}
        onSelectAddress={(id, value) => {
          setSelectedAddressId(id);
          if (id === "new") {
            setNewAddress(EMPTY_ADDRESS_DRAFT);
            return;
          }
          setDireccion(value);
        }}
        onNewEtiquetaChange={setNewEtiqueta}
        onNewAddressChange={setNewAddress}
        onMetodoPagoChange={setMetodoPago}
        onBack={() => {
          setSubmitError(null);
          setStep("catalog");
        }}
        onConfirm={confirmOrder}
      />
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-20 border-b border-black/5 bg-white/95 backdrop-blur-md">
        <div className="mx-auto max-w-lg px-4 pb-3 pt-4">
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={goToShop} className="min-w-0 text-left" aria-label="Ir al catálogo">
              <Logo />
            </button>
            <div className="flex shrink-0 items-center gap-2">
              <a
                href={`#${MY_PROFILE_HASH}`}
                onClick={(event) => {
                  event.preventDefault();
                  goToMyProfile();
                }}
                className="relative flex h-11 w-11 items-center justify-center rounded-full border"
                style={{
                  backgroundColor: view === "profile" ? "#E8E8EA" : "#F4F4F5",
                  borderColor: "rgba(0,0,0,0.06)",
                }}
                aria-label="Mi perfil"
                aria-current={view === "profile" ? "page" : undefined}
              >
                <ProfileIcon className="h-6 w-6" color={brand.ink} />
              </a>
              <a
                href={`#${MY_ORDERS_HASH}`}
                onClick={(event) => {
                  event.preventDefault();
                  goToMyOrders();
                }}
                className="relative flex h-11 w-11 items-center justify-center rounded-full border"
                style={{
                  backgroundColor: view === "orders" ? "#E8E8EA" : "#F4F4F5",
                  borderColor: "rgba(0,0,0,0.06)",
                }}
                aria-label="Mis pedidos"
                aria-current={view === "orders" ? "page" : undefined}
              >
                <OrdersIcon className="h-6 w-6" color={brand.ink} />
              </a>
              <button
                type="button"
                onClick={() => setCartOpen(true)}
                className="relative flex h-11 w-11 items-center justify-center rounded-full"
                style={{ backgroundColor: brand.orange }}
                aria-label="Ver carrito"
              >
                <CartIcon className="h-6 w-6" color="#FFFFFF" />
                {itemCount > 0 ? (
                  <span
                    className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold"
                    style={{ backgroundColor: "#FFFFFF", color: brand.orange }}
                  >
                    {itemCount}
                  </span>
                ) : null}
              </button>
            </div>
          </div>

          {!hashReady ? null : view === "shop" ? (
            <CatalogSearch
              query={query}
              products={products}
              onQueryChange={setQuery}
              onSelectProduct={(product) => {
                setQuery("");
                setHighlightedProductId(product.id);
              }}
              onRequestProduct={(term) => openProductRequest(term)}
            />
          ) : (
            <p className="mt-3 font-display text-xl font-bold text-brand-ink">
              {view === "profile" ? "Mi perfil" : "Mis pedidos"}
            </p>
          )}
        </div>
      </div>

      {!hashReady ? (
        <div className="mx-auto max-w-lg px-4 pb-16 pt-4">
          <div className="h-40 animate-pulse rounded-[24px] bg-gray-100" />
        </div>
      ) : view === "orders" ? (
        <div id="mis-pedidos" className="mx-auto max-w-lg px-4 pb-16 pt-2">
          <p className="text-sm leading-relaxed text-brand-muted">
            Tus pedidos, del más reciente al más antiguo.
          </p>
          <MyOrders sessionId={sessionId} onModify={startModify} onRequestProduct={() => openProductRequest()} />
        </div>
      ) : view === "profile" ? (
        <div id="mi-perfil" className="mx-auto max-w-lg px-4 pb-16 pt-2">
          {customer ? (
            <MyProfile
              sessionId={sessionId}
              customer={customer}
              onRequestProduct={() => openProductRequest()}
              onSaved={(updated) => {
                setCustomer(updated);
                const nextDefault = defaultAddress(updated);
                if (nextDefault) {
                  setDireccion(nextDefault.direccion);
                  setSelectedAddressId(nextDefault.id);
                }
              }}
            />
          ) : (
            <p className="mt-4 text-sm text-brand-muted">No encontramos tus datos. Recarga el catálogo o pide un enlace nuevo.</p>
          )}
        </div>
      ) : (
      <div className="mx-auto max-w-lg px-4 pb-32 pt-4">
        <PromoBanner banners={CATALOG_PROMO_BANNERS} />
        <p className="mt-4 text-sm leading-relaxed text-brand-muted">
          {isEditing
            ? "Ya cargamos tu pedido. Cambia lo que necesites y guarda los cambios."
            : "Elige lo que necesitas. Te lo preparamos y te confirmamos por WhatsApp."}
        </p>

        {reorderNotice ? (
          <p
            className="mt-3 rounded-2xl px-4 py-3 text-sm font-semibold"
            style={{
              backgroundColor: reorderNotice.startsWith("No pudimos") ? "#FEE2E2" : "#EAF6D8",
              color: reorderNotice.startsWith("No pudimos") ? brand.error : "#3F7A12",
            }}
          >
            {reorderNotice}
          </p>
        ) : null}

        {!normalizedQuery ? (
          <CatalogRecommendations
            recommendations={recommendations}
            cart={cart}
            onQuantityChange={setQuantity}
            onRepeatLastOrder={repeatLastOrder}
          />
        ) : null}

        {chipCategories.length > 0 ? (
          <nav
            className="-mx-4 mt-10 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label="Categorías"
          >
            {chipCategories.map(([categoria], index) => {
              const color = brandChipColor(index);
              return (
                <a
                  key={categoria}
                  href={`#${categoryAnchor(categoria)}`}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border-2 bg-white px-3.5 py-1.5 text-sm font-bold"
                  style={{ borderColor: color, color }}
                >
                  <span aria-hidden="true">{categoryEmoji(categoria)}</span>
                  {categoria}
                </a>
              );
            })}
          </nav>
        ) : null}

        {visibleProducts.length === 0 ? (
          <ProductRequestEmpty query={query} onRequest={() => openProductRequest(query)} />
        ) : (
          <div className="mt-6 space-y-8">
            {marketGroups.map(([categoria, items]) => (
              <CategorySection
                key={categoria}
                categoria={categoria}
                items={items}
                cart={cart}
                highlightedProductId={highlightedProductId}
                onQuantityChange={setQuantity}
              />
            ))}

            {pharmaGroups.length > 0 ? (
              <div className="space-y-4">
                <div className="overflow-hidden rounded-3xl text-white" style={{ backgroundColor: brand.blue }}>
                  <div className="px-5 py-6">
                    <Logo variant="pharma" onDark className="h-20 w-auto max-w-full sm:h-24" />
                    <p className="mt-3 text-base text-white/90">Farmacia y cuidado personal</p>
                  </div>
                </div>
                {pharmaGroups.map(([categoria, items]) => (
                  <CategorySection
                    key={categoria}
                    categoria={categoria}
                    items={items}
                    cart={cart}
                    highlightedProductId={highlightedProductId}
                    onQuantityChange={setQuantity}
                    pharma
                  />
                ))}
              </div>
            ) : null}
          </div>
        )}

        <p className="mt-10 pb-4 text-center">
          <button
            type="button"
            onClick={() => openProductRequest(query)}
            className="text-sm font-semibold underline-offset-2 hover:underline"
            style={{ color: brand.muted }}
          >
            ¿No encontraste lo que buscas? Solicitar un producto
          </button>
        </p>
      </div>
      )}

      {itemCount > 0 && !cartOpen && view === "shop" ? (
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="fixed bottom-5 left-1/2 z-30 flex w-[min(92%,28rem)] -translate-x-1/2 items-center justify-between rounded-full px-5 py-3.5 text-white shadow-[0_12px_30px_rgba(247,149,33,0.45)]"
          style={{ backgroundColor: brand.orange }}
        >
          <span className="flex items-center gap-2 font-bold">
            <CartIcon className="h-5 w-5" color="#FFFFFF" />
            Ver carrito
            <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold" style={{ color: brand.orange }}>
              {itemCount}
            </span>
          </span>
          <span className="font-display text-lg font-bold">{formatPrice(total)}</span>
        </button>
      ) : null}

      {cartOpen ? (
        <CartSheet
          lines={lines}
          total={total}
          onClose={() => setCartOpen(false)}
          onQuantityChange={setQuantity}
          onContinue={() => {
            setCartOpen(false);
            setStep("checkout");
          }}
        />
      ) : null}

      {requestOpen ? (
        <ProductRequestSheet
          sessionId={sessionId}
          initialProduct={requestPrefill}
          onClose={() => setRequestOpen(false)}
        />
      ) : null}
    </div>
  );
}

function ProfileIcon({ className, color }: { className?: string; color: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={color} aria-hidden="true">
      <path d="M12 3.6A4.2 4.2 0 1 1 12 12a4.2 4.2 0 0 1 0-8.4zm0 10.1c4.4 0 8 2.6 8 5.7 0 .9-.8 1.6-1.7 1.6H5.7c-.9 0-1.7-.7-1.7-1.6 0-3.1 3.6-5.7 8-5.7z" />
    </svg>
  );
}

function OrdersIcon({ className, color }: { className?: string; color: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={color} aria-hidden="true">
      <path d="M7 3.5A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8.2L14.8 3.5H7zm7.2 1.4 3.1 3.6h-3.1V4.9zM8.5 12a.9.9 0 1 1 0-1.8h7a.9.9 0 1 1 0 1.8h-7zm0 3.2a.9.9 0 1 1 0-1.8h7a.9.9 0 1 1 0 1.8h-7z" />
    </svg>
  );
}

function CategorySection({
  categoria,
  items,
  cart,
  highlightedProductId,
  onQuantityChange,
  pharma = false,
}: {
  categoria: string;
  items: Product[];
  cart: CartMap;
  highlightedProductId: string | null;
  onQuantityChange: (productId: string, cantidad: number) => void;
  pharma?: boolean;
}) {
  return (
    <section id={categoryAnchor(categoria)} className="scroll-mt-28">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="font-display text-2xl font-bold text-brand-ink">{categoria}</h2>
        {pharma ? <Badge variant="blue">PharmaQuick!</Badge> : null}
      </div>
      <ul className="space-y-3">
        {items.map((product) => (
          <li key={product.id}>
            <ProductCard
              product={product}
              cantidad={cart[product.id] ?? 0}
              highlighted={highlightedProductId === product.id}
              onQuantityChange={(cantidad) => onQuantityChange(product.id, cantidad)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ProductCard({
  product,
  cantidad,
  highlighted,
  onQuantityChange,
}: {
  product: Product;
  cantidad: number;
  highlighted: boolean;
  onQuantityChange: (cantidad: number) => void;
}) {
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
        <ProductPhoto product={product} className="h-[7.25rem] w-[7.25rem]" />
        <div className="min-w-0 flex-1">
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
            <QuantityStepper value={cantidad} onChange={onQuantityChange} />
          </div>
        </div>
      </div>
    </article>
  );
}

function ProductPhoto({
  product,
  className = "h-24 w-24",
}: {
  product: Product;
  className?: string;
}) {
  if (product.foto_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={product.foto_url}
        alt={product.nombre}
        className={`shrink-0 rounded-2xl object-cover ${className}`}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-2xl font-display text-3xl font-bold ${className}`}
      style={{ backgroundColor: `${brand.green}18`, color: brand.green }}
    >
      {product.nombre.slice(0, 1).toUpperCase()}
    </div>
  );
}

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

function CartSheet({
  lines,
  total,
  onClose,
  onQuantityChange,
  onContinue,
}: {
  lines: CartLine[];
  total: number;
  onClose: () => void;
  onQuantityChange: (productId: string, cantidad: number) => void;
  onContinue: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="Cerrar carrito"
        className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        className="relative z-10 flex max-h-[88vh] w-full max-w-lg flex-col rounded-t-[28px] bg-white shadow-[0_-24px_80px_rgba(0,0,0,0.35)]"
        style={{ borderTop: `6px solid ${brand.orange}` }}
      >
        <div className="px-4 pt-3">
          <div className="mx-auto h-1.5 w-12 rounded-full" style={{ backgroundColor: `${brand.muted}40` }} />
          <div className="mt-3 flex items-center justify-between pb-3">
            <h2 className="flex items-center gap-2 font-display text-2xl font-bold text-brand-ink">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full"
                style={{ backgroundColor: `${brand.orange}18` }}
              >
                <CartIcon className="h-5 w-5" color={brand.orange} />
              </span>
              Tu carrito
            </h2>
            <button type="button" onClick={onClose} className="text-sm font-bold" style={{ color: brand.blue }}>
              Seguir comprando
            </button>
          </div>
        </div>

        <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-1">
          {lines.length === 0 ? (
            <li className="py-10 text-center text-sm text-brand-muted">Tu carrito está vacío.</li>
          ) : (
            lines.map((line) => (
              <li
                key={line.product.id}
                className="flex items-center gap-3 rounded-2xl border border-black/[0.06] p-2.5"
              >
                <ProductPhoto product={line.product} className="h-16 w-16" />
                <div className="min-w-0 flex-1">
                  {line.product.marca ? (
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: brand.blue }}>
                      {line.product.marca}
                    </p>
                  ) : null}
                  <p className="truncate font-bold text-brand-ink">{line.product.nombre}</p>
                  <p className="text-sm font-bold" style={{ color: brand.orange }}>
                    {formatPrice(line.subtotal)}
                  </p>
                </div>
                <QuantityStepper
                  value={line.cantidad}
                  onChange={(cantidad) => onQuantityChange(line.product.id, cantidad)}
                />
              </li>
            ))
          )}
        </ul>

        <div className="border-t border-black/[0.06] bg-white px-4 pb-6 pt-4 shadow-[0_-8px_24px_rgba(26,26,26,0.06)]">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-brand-muted">Total estimado</span>
            <span className="font-display text-2xl font-bold" style={{ color: brand.orange }}>
              {formatPrice(total)}
            </span>
          </div>
          <button
            type="button"
            onClick={onContinue}
            disabled={lines.length === 0}
            className="mt-4 w-full rounded-full py-3.5 text-base font-bold text-white disabled:opacity-50"
            style={{ backgroundColor: brand.green }}
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckoutScreen({
  lines,
  total,
  direccion,
  metodoPago,
  submitting,
  submitError,
  isEditing,
  addresses,
  selectedAddressId,
  newEtiqueta,
  newAddress,
  onSelectAddress,
  onNewEtiquetaChange,
  onNewAddressChange,
  onMetodoPagoChange,
  onBack,
  onConfirm,
}: {
  lines: CartLine[];
  total: number;
  direccion: string;
  metodoPago: MetodoPago | null;
  submitting: boolean;
  submitError: string | null;
  isEditing: boolean;
  addresses: CustomerAddress[];
  selectedAddressId: string | "new";
  newEtiqueta: AddressLabel;
  newAddress: AddressDraft;
  onSelectAddress: (id: string | "new", direccion: string) => void;
  onNewEtiquetaChange: (value: AddressLabel) => void;
  onNewAddressChange: (value: AddressDraft) => void;
  onMetodoPagoChange: (value: MetodoPago) => void;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const addingNew = selectedAddressId === "new" || addresses.length === 0;
  const addressOk = addingNew ? isAddressDraftComplete(newAddress) : direccion.trim().length >= 6;
  const canConfirm = addressOk && metodoPago !== null && !submitting;

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-white px-4 pb-10 pt-5">
      <button type="button" onClick={onBack} className="text-sm font-bold" style={{ color: brand.blue }}>
        ← Volver al catálogo
      </button>
      <h1 className="font-display mt-4 text-3xl font-bold text-brand-ink">
        {isEditing ? "Guardar cambios" : "Confirmar pedido"}
      </h1>
      <p className="mt-1 text-sm text-brand-muted">
        {lines.length} {lines.length === 1 ? "producto" : "productos"} ·{" "}
        <span className="font-bold" style={{ color: brand.orange }}>
          {formatPrice(total)}
        </span>
      </p>

      <ul className="mt-5 space-y-2">
        {lines.map((line) => (
          <li key={line.product.id} className="flex items-center gap-3 rounded-2xl border border-black/[0.06] p-2">
            <ProductPhoto product={line.product} className="h-12 w-12" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{line.product.nombre}</p>
              <p className="text-xs text-brand-muted">x{line.cantidad}</p>
            </div>
            <p className="text-sm font-bold" style={{ color: brand.orange }}>
              {formatPrice(line.subtotal)}
            </p>
          </li>
        ))}
      </ul>

      {addresses.length > 0 ? (
        <fieldset className="mt-8">
          <legend className="text-sm font-bold text-brand-ink">Dirección de entrega</legend>
          <div className="mt-2 space-y-2">
            {addresses.map((address) => {
              const selected = selectedAddressId === address.id;
              return (
                <button
                  key={address.id}
                  type="button"
                  onClick={() => onSelectAddress(address.id, address.direccion)}
                  className="w-full rounded-2xl border-2 bg-white px-4 py-3 text-left"
                  style={{ borderColor: selected ? brand.green : `${brand.muted}40` }}
                >
                  <span className="block text-xs font-bold" style={{ color: selected ? brand.green : brand.muted }}>
                    {address.etiqueta || "Dirección"}
                    {address.esPredeterminada ? " · habitual" : ""}
                  </span>
                  <span className="mt-0.5 block text-sm font-semibold text-brand-ink">{address.direccion}</span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => onSelectAddress("new", "")}
              className="w-full rounded-2xl border-2 border-dashed bg-white px-4 py-3 text-left text-sm font-bold"
              style={{
                borderColor: selectedAddressId === "new" ? brand.green : `${brand.muted}40`,
                color: selectedAddressId === "new" ? brand.green : brand.ink,
              }}
            >
              + Agregar nueva dirección
            </button>
          </div>
        </fieldset>
      ) : null}

      {addingNew ? (
        <div className={addresses.length > 0 ? "mt-4" : "mt-8"}>
          {addresses.length > 0 ? (
            <p className="mb-3 text-sm font-bold text-brand-ink">Nueva dirección</p>
          ) : (
            <p className="mb-3 text-sm font-bold text-brand-ink">Dirección de entrega</p>
          )}
          <DeliveryAddressFields value={newAddress} onChange={onNewAddressChange} />
          <div className="mt-3 grid grid-cols-3 gap-2">
            {ADDRESS_LABELS.map((label) => {
              const selected = newEtiqueta === label;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => onNewEtiquetaChange(label)}
                  className="rounded-2xl border-2 bg-white py-2.5 text-sm font-bold"
                  style={{
                    borderColor: selected ? brand.green : `${brand.muted}40`,
                    color: selected ? brand.green : brand.ink,
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <fieldset className="mt-6">
        <legend className="text-sm font-bold text-brand-ink">Método de pago</legend>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <PaymentOption
            selected={metodoPago === "efectivo"}
            title="Efectivo"
            subtitle="Al recibir"
            onClick={() => onMetodoPagoChange("efectivo")}
          />
          <PaymentOption
            selected={metodoPago === "tarjeta"}
            title="Tarjeta"
            subtitle="POS en el domicilio"
            onClick={() => onMetodoPagoChange("tarjeta")}
          />
        </div>
      </fieldset>

      {submitError ? (
        <p className="mt-4 rounded-2xl border px-4 py-3 text-sm text-brand-error" style={{ borderColor: `${brand.error}40` }}>
          {submitError}
        </p>
      ) : null}

      <button
        type="button"
        disabled={!canConfirm}
        onClick={onConfirm}
        className="mt-8 w-full rounded-full py-3.5 text-base font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
        style={{ backgroundColor: brand.green }}
      >
        {submitting
          ? isEditing
            ? "Guardando..."
            : "Confirmando..."
          : isEditing
            ? "Guardar cambios"
            : "Confirmar pedido"}
      </button>
    </div>
  );
}

function PaymentOption({
  selected,
  title,
  subtitle,
  onClick,
}: {
  selected: boolean;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border-2 bg-white px-4 py-4 text-left"
      style={{ borderColor: selected ? brand.green : `${brand.muted}40` }}
    >
      <span className="block font-bold text-brand-ink">{title}</span>
      <span className="mt-0.5 block text-xs text-brand-muted">{subtitle}</span>
    </button>
  );
}

function SuccessScreen({
  orderId,
  isEditing,
  onViewOrders,
  onKeepShopping,
}: {
  orderId: string | null;
  isEditing: boolean;
  onViewOrders: () => void;
  onKeepShopping: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-5 py-16">
      <section className="w-full max-w-md rounded-[28px] border border-black/[0.06] bg-white px-6 py-10 text-center shadow-[0_16px_40px_rgba(26,26,26,0.08)]">
        <Logo />
        <p className="mt-4">
          <Badge variant="green">{isEditing ? "Pedido actualizado" : "Pedido recibido"}</Badge>
        </p>
        <h1 className="font-display mt-3 text-3xl font-bold leading-tight text-brand-ink">
          {isEditing
            ? "Guardamos los cambios, te confirmaremos por WhatsApp"
            : "Pedido recibido, te confirmaremos por WhatsApp"}
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-brand-muted">
          {isEditing
            ? "El minimarket ya tiene la versión actualizada. Te escribimos si hace falta ajustar algo más."
            : "Ya llegó al minimarket. En un momento te escribimos para confirmar stock y el horario de entrega."}
        </p>
        {orderId ? (
          <p className="mt-6 text-xs font-bold" style={{ color: brand.blue }}>
            N.º {orderId.slice(0, 8).toUpperCase()}
          </p>
        ) : null}
        <div className="mt-8 space-y-3">
          <button
            type="button"
            onClick={onViewOrders}
            className="w-full rounded-full py-3.5 text-sm font-bold text-white"
            style={{ backgroundColor: brand.green }}
          >
            Ver mis pedidos
          </button>
          <button
            type="button"
            onClick={onKeepShopping}
            className="w-full text-sm font-bold"
            style={{ color: brand.blue }}
          >
            Seguir comprando
          </button>
        </div>
      </section>
    </main>
  );
}
