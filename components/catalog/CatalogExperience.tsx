"use client";

import { useEffect, useMemo, useState } from "react";
import { CustomerRegisterForm } from "@/components/catalog/CustomerRegisterForm";
import { Badge } from "@/components/brand/Badge";
import { CartIcon } from "@/components/brand/CartIcon";
import { Logo } from "@/components/brand/Logo";
import { ADDRESS_LABELS, type AddressLabel, type CatalogCustomer, type CustomerAddress } from "@/lib/customers";
import { formatPrice } from "@/lib/money";
import { brand, brandChipColor, isPharmaCategory } from "@/lib/theme";
import type { CreateOrderPayload, MetodoPago, OrderDraft, Product } from "@/lib/types";

type CatalogExperienceProps = {
  sessionId: string;
  products: Product[];
  editOrder?: OrderDraft | null;
  customer?: CatalogCustomer | null;
};

type Step = "register" | "catalog" | "checkout" | "success";
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

export function CatalogExperience({
  sessionId,
  products,
  editOrder = null,
  customer: initialCustomer = null,
}: CatalogExperienceProps) {
  const isEditing = Boolean(editOrder);
  const [customer, setCustomer] = useState<CatalogCustomer | null>(initialCustomer);
  const [step, setStep] = useState<Step>(initialCustomer ? "catalog" : "register");
  const [cart, setCart] = useState<CartMap>(() => cartFromDraft(editOrder));
  const [cartOpen, setCartOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [query, setQuery] = useState("");
  const [direccion, setDireccion] = useState(
    editOrder?.direccion ?? defaultAddress(initialCustomer)?.direccion ?? ""
  );
  const [selectedAddressId, setSelectedAddressId] = useState<string | "new">(
    defaultAddress(initialCustomer)?.id ?? "new"
  );
  const [newEtiqueta, setNewEtiqueta] = useState<AddressLabel>("Casa");
  const [metodoPago, setMetodoPago] = useState<MetodoPago | null>(editOrder?.metodoPago ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);

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

  async function confirmOrder() {
    const usingNewAddress = Boolean(customer && selectedAddressId === "new");
    const delivery = usingNewAddress ? direccion.trim() : direccion.trim();
    if (!metodoPago || delivery.length < 6 || lines.length === 0) {
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
      nuevaDireccion:
        usingNewAddress && customer
          ? { direccion: delivery, etiqueta: newEtiqueta }
          : null,
    };

    setSubmitting(true);
    setSubmitError(null);

    try {
      const endpoint = isEditing && editOrder ? `/api/orders/${editOrder.orderId}` : "/api/orders";
      const response = await fetch(endpoint, {
        method: isEditing ? "PATCH" : "POST",
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
            (isEditing
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
        isEditing
          ? "No pudimos guardar los cambios. Revisa tu conexión."
          : "No pudimos confirmar el pedido. Revisa tu conexión."
      );
    } finally {
      setSubmitting(false);
    }
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
    return <SuccessScreen orderId={orderId} isEditing={isEditing} />;
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
        onDireccionChange={setDireccion}
        onSelectAddress={(id, value) => {
          setSelectedAddressId(id);
          if (id === "new") {
            setDireccion("");
            return;
          }
          setDireccion(value);
        }}
        onNewEtiquetaChange={setNewEtiqueta}
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
            <Logo />
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="relative flex h-11 w-11 items-center justify-center rounded-full"
              style={{ backgroundColor: `${brand.orange}18` }}
              aria-label="Ver carrito"
            >
              <CartIcon className="h-6 w-6" color={brand.orange} />
              {itemCount > 0 ? (
                <span
                  className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                  style={{ backgroundColor: brand.orange }}
                >
                  {itemCount}
                </span>
              ) : null}
            </button>
          </div>

          <label className="relative mt-3 block">
            <span className="sr-only">Buscar productos</span>
            <SearchIcon />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar producto, marca o categoría"
              className="w-full rounded-full border bg-white py-2.5 pl-11 pr-4 text-sm text-brand-ink outline-none placeholder:text-brand-muted"
              style={{ borderColor: query ? brand.green : `${brand.muted}40` }}
            />
          </label>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 pb-32 pt-4">
        <p className="text-sm leading-relaxed text-brand-muted">
          {isEditing
            ? "Ya cargamos tu pedido. Cambia lo que necesites y guarda los cambios."
            : "Elige lo que necesitas. Te lo preparamos y te confirmamos por WhatsApp."}
        </p>

        {chipCategories.length > 0 ? (
          <nav
            className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            aria-label="Categorías"
          >
            {chipCategories.map(([categoria], index) => {
              const color = brandChipColor(index);
              return (
                <a
                  key={categoria}
                  href={`#${categoryAnchor(categoria)}`}
                  className="shrink-0 rounded-full border-2 bg-white px-3.5 py-1.5 text-sm font-bold"
                  style={{ borderColor: color, color }}
                >
                  {categoria}
                </a>
              );
            })}
          </nav>
        ) : null}

        {visibleProducts.length === 0 ? (
          <p className="mt-8 rounded-3xl border border-dashed px-5 py-10 text-center text-brand-muted" style={{ borderColor: `${brand.muted}40` }}>
            No encontramos resultados para “{query}”.
          </p>
        ) : (
          <div className="mt-6 space-y-8">
            {marketGroups.map(([categoria, items]) => (
              <CategorySection
                key={categoria}
                categoria={categoria}
                items={items}
                cart={cart}
                onQuantityChange={setQuantity}
              />
            ))}

            {pharmaGroups.length > 0 ? (
              <div className="space-y-4">
                <div className="overflow-hidden rounded-3xl text-white" style={{ backgroundColor: brand.blue }}>
                  <div className="px-4 py-4">
                    <Logo variant="pharma" onDark />
                    <p className="mt-2 text-sm text-white/90">Farmacia y cuidado personal</p>
                  </div>
                </div>
                {pharmaGroups.map(([categoria, items]) => (
                  <CategorySection
                    key={categoria}
                    categoria={categoria}
                    items={items}
                    cart={cart}
                    onQuantityChange={setQuantity}
                    pharma
                  />
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {itemCount > 0 && !cartOpen ? (
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
    </div>
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

function CategorySection({
  categoria,
  items,
  cart,
  onQuantityChange,
  pharma = false,
}: {
  categoria: string;
  items: Product[];
  cart: CartMap;
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
  onQuantityChange,
}: {
  product: Product;
  cantidad: number;
  onQuantityChange: (cantidad: number) => void;
}) {
  return (
    <article className="overflow-hidden rounded-3xl border border-black/[0.06] bg-white shadow-[0_8px_24px_rgba(26,26,26,0.06)]">
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
  onDireccionChange,
  onSelectAddress,
  onNewEtiquetaChange,
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
  onDireccionChange: (value: string) => void;
  onSelectAddress: (id: string | "new", direccion: string) => void;
  onNewEtiquetaChange: (value: AddressLabel) => void;
  onMetodoPagoChange: (value: MetodoPago) => void;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const addingNew = selectedAddressId === "new" || addresses.length === 0;
  const canConfirm = direccion.trim().length >= 6 && metodoPago !== null && !submitting;

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
      ) : (
        <label className="mt-8 block">
          <span className="text-sm font-bold text-brand-ink">Dirección de entrega</span>
          <textarea
            value={direccion}
            onChange={(event) => onDireccionChange(event.target.value)}
            rows={3}
            placeholder="Calle, número, piso, referencias..."
            className="mt-2 w-full resize-none rounded-2xl border bg-white px-4 py-3 text-base text-brand-ink outline-none placeholder:text-brand-muted"
            style={{ borderColor: `${brand.muted}40` }}
          />
        </label>
      )}

      {addresses.length > 0 && addingNew ? (
        <div className="mt-4">
          <label className="block">
            <span className="text-sm font-bold text-brand-ink">Nueva dirección</span>
            <textarea
              value={direccion}
              onChange={(event) => onDireccionChange(event.target.value)}
              rows={3}
              placeholder="Calle, número, piso, referencias..."
              className="mt-2 w-full resize-none rounded-2xl border bg-white px-4 py-3 text-base text-brand-ink outline-none placeholder:text-brand-muted"
              style={{ borderColor: `${brand.muted}40` }}
            />
          </label>
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

function SuccessScreen({ orderId, isEditing }: { orderId: string | null; isEditing: boolean }) {
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
      </section>
    </main>
  );
}
