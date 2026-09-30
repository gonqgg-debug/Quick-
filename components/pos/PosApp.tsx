"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { PosCart } from "@/components/pos/PosCart";
import { PosCheckout } from "@/components/pos/PosCheckout";
import { PosDiscount } from "@/components/pos/PosDiscount";
import { PosQuickcoins, type PosCoinsAccount } from "@/components/pos/PosQuickcoins";
import { PosTicketPreview } from "@/components/pos/PosTicketPreview";
import { PosCloseShift, PosOpenShift } from "@/components/pos/PosShift";
import { StaffLogin, staffLogout } from "@/components/staff/StaffLogin";
import {
  countPendingPosWork,
  readOpenShift,
  readPosCatalog,
  readShiftSales,
  saveLocalSale,
  saveLocalShift,
} from "@/lib/pos-db";
import { formatPrice } from "@/lib/money";
import {
  POS_CATALOG_REFRESH_MS,
  POS_SYNC_INTERVAL_MS,
  POS_SIN_DESCUENTO,
  addProductToCart,
  buildOpenShift,
  buildSale,
  buildShiftClose,
  cartAmountDue,
  centsToMoney,
  findProductsByBarcode,
  isPosSaleDraft,
  isPosShiftRecord,
  manualDiscountWithinCap,
  posCategories,
  priceCart,
  quickcoinsDiscountCents,
  setLineDiscount,
  productInitials,
  productMatchesQuery,
  setCartQty,
  stockBadge,
  type CartLine,
  type PosDescuento,
  type PosMetodoPago,
  type PosProduct,
  type PosSaleDraft,
  type PosShiftRecord,
} from "@/lib/pos";
import { looksLikeBarcode } from "@/lib/barcode";
import { printPosTicket, printTicketInBrowser } from "@/lib/pos-print";
import { refreshCatalogFromNetwork, syncPendingSales } from "@/lib/pos-sync";
import { brand, categoryEmoji } from "@/lib/theme";

type Phase = "loading" | "login" | "ready";
type Connection = "online" | "offline" | "syncing";

type SuccessSale = {
  total: number;
  cambio: number | null;
  metodo: PosMetodoPago;
  sale: PosSaleDraft;
  printNote: string | null;
};

export function PosApp() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [catalogNote, setCatalogNote] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Todos");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [brokenImages, setBrokenImages] = useState<Set<string>>(() => new Set());
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<SuccessSale | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [sessionNote, setSessionNote] = useState<string | null>(null);
  const [shift, setShift] = useState<PosShiftRecord | null>(null);
  const [closeSales, setCloseSales] = useState<PosSaleDraft[]>([]);
  const [closeOpen, setCloseOpen] = useState(false);
  const [ticketDiscount, setTicketDiscount] = useState<PosDescuento>(POS_SIN_DESCUENTO);
  const [discountTarget, setDiscountTarget] = useState<"ticket" | string | null>(null);
  const [scanNote, setScanNote] = useState<string | null>(null);
  const [coinsOpen, setCoinsOpen] = useState(false);
  const [coinsAccount, setCoinsAccount] = useState<PosCoinsAccount | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const reloadLocal = useCallback(async () => {
    const [catalog, queued, open] = await Promise.all([readPosCatalog(), countPendingPosWork(), readOpenShift()]);
    setProducts(catalog);
    setPending(queued);
    setShift(open);
    return catalog;
  }, []);

  const pullCatalog = useCallback(async (quiet = false) => {
    const result = await refreshCatalogFromNetwork();
    if (result.status === "unauthorized") {
      if (quiet) {
        setSessionNote("La sesión venció. Entra de nuevo para subir las ventas guardadas.");
        return;
      }
      setPhase("login");
      setSessionNote(null);
      return;
    }
    if (result.status === "ok") {
      setCatalogNote(null);
      setSessionNote(null);
      await reloadLocal();
      setPhase("ready");
      return;
    }
    const local = await reloadLocal();
    if (local.length > 0) {
      setCatalogNote(result.status === "offline" ? null : "Mostrando el catálogo guardado en esta caja.");
      setPhase("ready");
      return;
    }
    setCatalogNote(
      result.status === "offline"
        ? "Sin conexión y sin catálogo guardado. Conéctate una vez para abrir la caja."
        : result.message
    );
    setPhase("ready");
  }, [reloadLocal]);

  const runSync = useCallback(async () => {
    setSyncing(true);
    try {
      const result = await syncPendingSales();
      setPending(result.pending);
      if (result.needsLogin) {
        setSessionNote("La sesión venció. Entra de nuevo para subir las ventas guardadas.");
      } else if (result.synced > 0) {
        setSessionNote(null);
        if (typeof navigator !== "undefined" && navigator.onLine) {
          const refreshed = await refreshCatalogFromNetwork();
          if (refreshed.status === "ok") {
            await reloadLocal();
          }
        }
      }
    } finally {
      setSyncing(false);
    }
  }, [reloadLocal]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const local = await readPosCatalog();
        if (cancelled) return;
        if (local.length > 0) {
          setProducts(local);
          if (!navigator.onLine) {
            setPhase("ready");
          }
        }
        const [queued, open] = await Promise.all([countPendingPosWork(), readOpenShift()]);
        if (!cancelled) {
          setPending(queued);
          setShift(open);
        }
      } catch {
        if (!cancelled) {
          setCatalogNote("Este navegador no permite guardar la caja en el dispositivo.");
          setPhase("ready");
        }
      }
      if (!cancelled) {
        await pullCatalog();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pullCatalog]);

  useEffect(() => {
    function updateOnline() {
      setOnline(navigator.onLine);
    }
    updateOnline();
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  useEffect(() => {
    if (phase !== "ready" || !online) {
      return;
    }
    void runSync();
    const syncTimer = window.setInterval(() => void runSync(), POS_SYNC_INTERVAL_MS);
    const catalogTimer = window.setInterval(() => void pullCatalog(true), POS_CATALOG_REFRESH_MS);
    return () => {
      window.clearInterval(syncTimer);
      window.clearInterval(catalogTimer);
    };
  }, [phase, online, runSync, pullCatalog]);

  useEffect(() => {
    if (!success) {
      return;
    }
    const timer = window.setTimeout(() => setSuccess(null), 4000);
    return () => window.clearTimeout(timer);
  }, [success]);

  const categories = useMemo(() => ["Todos", ...posCategories(products)], [products]);
  useEffect(() => {
    if (category !== "Todos" && !categories.includes(category)) {
      setCategory("Todos");
    }
  }, [categories, category]);
  const visible = useMemo(
    () =>
      products.filter((product) => {
        if (query.trim()) {
          return productMatchesQuery(product, query);
        }
        return category === "Todos" || product.categoria === category;
      }),
    [products, category, query]
  );
  const units = cart.reduce((sum, line) => sum + line.cantidad, 0);
  const coinCents = quickcoinsDiscountCents(coinsAccount?.canjePuntos ?? 0);
  const priced = useMemo(() => priceCart(cart, ticketDiscount, coinCents), [cart, ticketDiscount, coinCents]);
  const subtotal = "error" in priced ? 0 : centsToMoney(priced.listCents);
  const descuento = "error" in priced ? 0 : centsToMoney(priced.lineDiscountCents + priced.ticketDiscountCents);
  const coinsMoney = "error" in priced ? 0 : centsToMoney(priced.coinDiscountCents);
  const total = cartAmountDue(cart, ticketDiscount, coinCents);

  function applyDiscount(descuento: PosDescuento) {
    if (discountTarget == null) return;
    if (discountTarget === "ticket") {
      if (!manualDiscountWithinCap(cart, descuento)) {
        setFormError(`El descuento pasa del 20%`);
        return;
      }
      setTicketDiscount(descuento);
    } else {
      const next = setLineDiscount(cart, discountTarget, descuento, ticketDiscount);
      if ("error" in next) {
        setFormError(next.error);
        return;
      }
      setCart(next);
    }
    setFormError(null);
    setDiscountTarget(null);
  }

  function onSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (!looksLikeBarcode(query)) return;
    const matches = findProductsByBarcode(products, query);
    if (matches.length === 1) {
      addProduct(matches[0]);
      setScanNote(null);
    } else {
      setScanNote(matches.length === 0 ? "No está en el catálogo" : "Hay más de un producto con ese código");
    }
    setQuery("");
    searchRef.current?.focus();
  }

  function addProduct(product: PosProduct) {
    setCart((current) => addProductToCart(current, product));
    setFlashId(product.id);
    window.setTimeout(() => {
      setFlashId((current) => (current === product.id ? null : current));
    }, 220);
    setFormError(null);
  }

  async function openShift(abiertoPor: string, fondoInicial: number) {
    const next = buildOpenShift({
      clientId: crypto.randomUUID(),
      abiertoEn: new Date().toISOString(),
      abiertoPor,
      fondoInicial,
    });
    if (!isPosShiftRecord(next)) {
      setFormError(next.error);
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await saveLocalShift(next);
      setShift(next);
      setPending(await countPendingPosWork());
      void runSync();
    } catch {
      setFormError("No pudimos guardar la apertura en este dispositivo.");
    } finally {
      setSaving(false);
    }
  }

  async function requestClose() {
    if (!shift) return;
    if (cart.length > 0) {
      setFormError("Cobra o vacía el carrito antes de cerrar el turno.");
      return;
    }
    setFormError(null);
    const sales = await readShiftSales(shift.clientId);
    setCloseSales(sales);
    setCloseOpen(true);
  }

  async function confirmClose(efectivoContado: number, notas: string) {
    if (!shift) return;
    const closed = buildShiftClose({
      shift,
      sales: closeSales,
      efectivoContado,
      notas,
      cerradoEn: new Date().toISOString(),
    });
    if ("error" in closed) {
      setFormError(closed.error);
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await saveLocalShift(closed.shift);
      setShift(null);
      setCloseOpen(false);
      setCloseSales([]);
      setPending(await countPendingPosWork());
      void runSync();
    } catch {
      setFormError("No pudimos guardar el cierre en este dispositivo.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmSale(metodo: PosMetodoPago, montoRecibido: number | null) {
    if (!shift) {
      setFormError("Abre un turno antes de cobrar.");
      return;
    }
    const sale = buildSale({
      clientId: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      lines: cart,
      metodoPago: metodo,
      montoRecibido,
      turnoClientId: shift.clientId,
      cajero: shift.abiertoPor,
      ticket: ticketDiscount,
      quickcoins: coinsAccount
        ? {
            telefono: coinsAccount.telefono,
            nombre: coinsAccount.nombre,
            canjePuntos: coinsAccount.canjePuntos,
            ganarPuntos: 0,
            descuentoCanje: coinsMoney,
            coinsSync: "pendiente_sync",
          }
        : null,
    });
    if (!isPosSaleDraft(sale)) {
      setFormError(sale.error);
      return;
    }
    if ((sale.quickcoins?.canjePuntos ?? 0) > 0 && (typeof navigator === "undefined" || !navigator.onLine)) {
      setFormError("Sin conexión, no se pueden canjear QuickCoins");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      let stored = sale;
      if ((sale.quickcoins?.canjePuntos ?? 0) > 0) {
        const response = await fetch("/api/pos/venta", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: sale.clientId,
            fecha: sale.createdAt,
            metodo_pago: sale.metodoPago,
            monto_recibido: sale.montoRecibido,
            turno_client_id: sale.turnoClientId,
            creado_por: sale.cajero,
            descuento_ticket: sale.descuentoTicket ?? 0,
            descuento_total: sale.descuentoTotal ?? 0,
            quickcoins: {
              telefono: sale.quickcoins?.telefono,
              nombre: sale.quickcoins?.nombre,
              canje_puntos: sale.quickcoins?.canjePuntos,
              ganar_puntos: sale.quickcoins?.ganarPuntos,
            },
            items: sale.items.map((item) => ({
              producto_id: item.productoId,
              nombre: item.nombre,
              cantidad: item.cantidad,
              precio_unitario: item.precioUnitario,
              precio_lista: item.precioLista,
              descuento: item.descuento ?? 0,
            })),
          }),
        });
        const body = (await response.json().catch(() => null)) as { error?: string; stockAdvertencia?: boolean } | null;
        if (!response.ok) {
          setFormError(body?.error || "No pudimos canjear QuickCoins");
          return;
        }
        stored = {
          ...sale,
          status: "sincronizada",
          stockAdvertencia: Boolean(body?.stockAdvertencia),
          quickcoins: sale.quickcoins ? { ...sale.quickcoins, coinsSync: "sincronizada" } : null,
        };
      }
      const next = await saveLocalSale(stored);
      setProducts(next);
      setPending(await countPendingPosWork());
      setCart([]);
      setTicketDiscount(POS_SIN_DESCUENTO);
      setCoinsAccount(null);
      setCheckoutOpen(false);
      setCartOpen(false);
      setSuccess({
        total: stored.total,
        cambio: stored.cambio,
        metodo: stored.metodoPago,
        sale: stored,
        printNote: null,
      });
      void runSync();
    } catch {
      setFormError("No pudimos guardar la venta en este dispositivo.");
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await staffLogout();
    setPhase("login");
  }

  if (phase === "loading") {
    return (
      <main className="flex h-full items-center justify-center bg-white">
        <p className="text-lg font-semibold text-brand-muted">Abriendo caja…</p>
      </main>
    );
  }

  if (phase === "login") {
    return (
      <StaffLogin
        heading="Caja"
        description="Usa la misma contraseña del personal de tienda."
        onSuccess={() => void pullCatalog()}
      />
    );
  }

  const connection: Connection = !online ? "offline" : syncing || pending > 0 ? "syncing" : "online";

  return (
    <main className="flex h-full min-h-0 flex-col" style={{ backgroundColor: "#F4F6F3", color: brand.ink }}>
      <header className="flex shrink-0 items-center gap-3 border-b bg-white px-3 py-2" style={{ borderColor: "#E5E7EB" }}>
        <Logo className="h-8 max-w-[140px]" />
        <p className="hidden font-display text-lg font-extrabold sm:block">Caja</p>
        <ConnectionPill connection={connection} pending={pending} />
        <div className="ml-auto flex items-center gap-1">
          {shift ? (
            <button
              type="button"
              onClick={() => void requestClose()}
              className="flex h-11 max-w-[42vw] items-center truncate rounded-full px-3 text-sm font-extrabold"
              style={{ backgroundColor: brand.paleOrange, color: brand.ink }}
            >
              Cerrar · {shift.abiertoPor}
            </button>
          ) : null}
          <a href="/staff" className="flex h-11 items-center px-3 text-sm font-bold text-brand-muted">
            Pedidos
          </a>
          <button type="button" onClick={() => void logout()} className="flex h-11 items-center px-3 text-sm font-bold">
            Salir
          </button>
        </div>
      </header>
      {sessionNote ? (
        <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-2 text-sm font-semibold" style={{ backgroundColor: "#FEF3C7", color: "#92400E" }}>
          <p>{sessionNote}</p>
          <button type="button" onClick={() => setPhase("login")} className="min-h-11 shrink-0 font-extrabold underline">
            Entrar
          </button>
        </div>
      ) : null}
      {catalogNote ? (
        <p className="shrink-0 px-4 py-2 text-sm font-semibold" style={{ backgroundColor: "#EAF4FB", color: brand.navy }}>
          {catalogNote}
        </p>
      ) : null}

      {!shift ? (
        <PosOpenShift busy={saving} onOpen={(nombre, fondo) => void openShift(nombre, fondo)} />
      ) : (
      <div className="flex min-h-0 flex-1">
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="shrink-0 space-y-2 px-3 pb-2 pt-3">
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setScanNote(null);
              }}
              onKeyDown={onSearchKeyDown}
              placeholder="Buscar producto o escanear"
              aria-label="Buscar producto"
              className="h-12 w-full rounded-2xl border bg-white px-4 text-base font-medium outline-none"
              style={{ borderColor: "#D1D5DB" }}
            />
            <div className="flex gap-2 overflow-x-auto pb-1">
              {categories.map((item) => {
                const selected = category === item;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCategory(item)}
                    className="h-11 shrink-0 rounded-full px-4 text-sm font-bold"
                    style={{
                      backgroundColor: selected ? brand.green : "#FFFFFF",
                      color: selected ? "#FFFFFF" : brand.ink,
                      border: `1px solid ${selected ? brand.green : "#E5E7EB"}`,
                    }}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
            {scanNote ? <p className="text-sm font-bold" style={{ color: brand.error }}>{scanNote}</p> : null}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-28 lg:pb-4">
            {visible.length === 0 ? (
              <p className="px-2 py-16 text-center text-base font-semibold text-brand-muted">
                {products.length === 0 ? "Todavía no hay productos en esta caja." : "Nada con ese nombre."}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {visible.map((product) => {
                  const badge = stockBadge(product.stock);
                  const showImage = Boolean(product.fotoUrl) && !brokenImages.has(product.id);
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => addProduct(product)}
                      className={`pos-card relative flex min-h-[168px] flex-col rounded-2xl border bg-white p-3 text-left ${
                        flashId === product.id ? "pos-tap" : ""
                      }`}
                      style={{ borderColor: "#E5E7EB" }}
                    >
                      <div
                        className="flex h-24 items-center justify-center overflow-hidden rounded-xl"
                        style={{ backgroundColor: brand.cream }}
                      >
                        {showImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={product.fotoUrl ?? ""}
                            alt=""
                            className="h-full w-full object-contain"
                            onError={() =>
                              setBrokenImages((current) => {
                                const next = new Set(current);
                                next.add(product.id);
                                return next;
                              })
                            }
                          />
                        ) : (
                          <span className="flex flex-col items-center gap-1">
                            <span className="text-3xl" aria-hidden="true">
                              {categoryEmoji(product.categoria)}
                            </span>
                            <span className="text-sm font-extrabold text-brand-muted">{productInitials(product.nombre)}</span>
                          </span>
                        )}
                      </div>
                      {badge ? (
                        <span
                          className="absolute right-4 top-4 rounded-full px-2 py-0.5 text-[11px] font-extrabold"
                          style={{
                            backgroundColor: badge.tone === "negative" ? "#FEF3C7" : "#F1F7EA",
                            color: badge.tone === "negative" ? "#92400E" : "#3F6212",
                          }}
                        >
                          {badge.label}
                        </span>
                      ) : null}
                      <p className="mt-2 line-clamp-2 text-sm font-bold leading-tight">{product.nombre}</p>
                      <p className="mt-auto pt-1 text-lg font-extrabold tabular-nums" style={{ color: brand.orange }}>
                        {formatPrice(product.precio)}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <aside className="hidden h-full w-[34%] min-w-[320px] max-w-[440px] shrink-0 border-l lg:block" style={{ borderColor: "#E5E7EB" }}>
          <PosCart
            lines={cart}
            subtotal={subtotal}
            descuento={descuento}
            coins={coinsMoney}
            total={total}
            onQty={(productoId, cantidad) => setCart((current) => setCartQty(current, productoId, cantidad))}
            onRemove={(productoId) => setCart((current) => current.filter((line) => line.productoId !== productoId))}
            onClear={() => {
              setCart([]);
              setTicketDiscount(POS_SIN_DESCUENTO);
            }}
            onCheckout={() => setCheckoutOpen(true)}
            onDiscountLine={(productoId) => setDiscountTarget(productoId)}
            onDiscountTicket={() => setDiscountTarget("ticket")}
            onQuickcoins={() => setCoinsOpen(true)}
          />
        </aside>
      </div>
      )}

      {shift && units > 0 && !cartOpen && !checkoutOpen ? (
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="fixed inset-x-4 z-30 flex h-14 items-center justify-center rounded-2xl text-base font-extrabold text-white shadow-lg lg:hidden"
          style={{ backgroundColor: brand.navy, bottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          Ver carrito ({units}) — {formatPrice(total)}
        </button>
      ) : null}

      {cartOpen ? (
        <div className="fixed inset-0 z-40 flex items-end bg-black/45 lg:hidden">
          <button type="button" className="absolute inset-0" aria-label="Cerrar carrito" onClick={() => setCartOpen(false)} />
          <div className="relative flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white">
            <PosCart
              lines={cart}
              subtotal={subtotal}
              descuento={descuento}
              coins={coinsMoney}
              total={total}
              onQty={(productoId, cantidad) => setCart((current) => setCartQty(current, productoId, cantidad))}
              onRemove={(productoId) => setCart((current) => current.filter((line) => line.productoId !== productoId))}
              onClear={() => {
                setCart([]);
                setTicketDiscount(POS_SIN_DESCUENTO);
              }}
              onCheckout={() => {
                setCartOpen(false);
                setCheckoutOpen(true);
              }}
              onDiscountLine={(productoId) => setDiscountTarget(productoId)}
              onDiscountTicket={() => setDiscountTarget("ticket")}
              onQuickcoins={() => setCoinsOpen(true)}
            />
          </div>
        </div>
      ) : null}

      {closeOpen && shift ? (
        <PosCloseShift
          abiertoPor={shift.abiertoPor}
          fondoInicial={shift.fondoInicial}
          sales={closeSales}
          busy={saving}
          onClose={() => setCloseOpen(false)}
          onConfirm={(contado, notas) => void confirmClose(contado, notas)}
        />
      ) : null}

      {coinsOpen ? (
        <PosQuickcoins
          online={online}
          lines={cart}
          ticket={ticketDiscount}
          current={coinsAccount}
          onClose={() => setCoinsOpen(false)}
          onApply={(account) => {
            if (account && account.canjePuntos > 0 && !online) {
              setFormError("Sin conexión, no se pueden canjear QuickCoins");
              return;
            }
            setCoinsAccount(account);
            setCoinsOpen(false);
            setFormError(null);
          }}
        />
      ) : null}

      {discountTarget != null ? (
        <PosDiscount
          title={discountTarget === "ticket" ? "Descuento del ticket" : "Descuento de línea"}
          onClose={() => setDiscountTarget(null)}
          onApply={applyDiscount}
        />
      ) : null}

      {checkoutOpen ? (
        <PosCheckout
          total={total}
          busy={saving}
          onClose={() => {
            setCheckoutOpen(false);
            setFormError(null);
          }}
          onConfirm={(metodo, monto) => void confirmSale(metodo, monto)}
        />
      ) : null}
      {formError ? (
        <p className="fixed inset-x-4 bottom-4 z-[60] rounded-2xl px-4 py-3 text-center text-sm font-bold text-white" style={{ backgroundColor: brand.error }}>
          {formError}
        </p>
      ) : null}

      {success ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 p-4 sm:items-center">
          <div className="flex max-h-[94dvh] w-full max-w-md flex-col rounded-3xl bg-white px-6 py-6 text-center shadow-2xl" style={{ backgroundColor: "#F4F6F3" }}>
            <div className="min-h-0 flex-1 overflow-y-auto">
            <div
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl font-extrabold text-white"
              style={{ backgroundColor: brand.green }}
            >
              ✓
            </div>
            <p className="mt-2 text-lg font-bold">Cobrado</p>
            {success.metodo === "efectivo" && success.cambio != null ? (
              <p className="text-xl font-extrabold" style={{ color: brand.green }}>
                Cambio {formatPrice(success.cambio)}
              </p>
            ) : null}
            <PosTicketPreview sale={success.sale} />
            {success.printNote ? <p className="mt-3 text-sm font-semibold text-brand-muted">{success.printNote}</p> : null}
            </div>
            <button
              type="button"
              onClick={() =>
                void printPosTicket(success.sale, {
                  openDrawer: success.sale.metodoPago === "efectivo",
                  request: true,
                }).then((result) => {
                  setSuccess((current) => (current ? { ...current, printNote: result.ok ? "Ticket enviado" : result.message } : current));
                })
              }
              className="mt-6 flex h-14 w-full items-center justify-center rounded-2xl text-lg font-extrabold text-white"
              style={{ backgroundColor: brand.navy }}
            >
              {success.sale.metodoPago === "efectivo" ? "Imprimir y abrir caja" : "Imprimir"}
            </button>
            <button
              type="button"
              onClick={() => printTicketInBrowser(success.sale)}
              className="mt-2 flex h-11 w-full items-center justify-center text-sm font-bold text-brand-muted"
            >
              Imprimir en este navegador
            </button>
            <button
              type="button"
              onClick={() => setSuccess(null)}
              className="mt-2 flex h-14 w-full items-center justify-center rounded-2xl text-lg font-extrabold text-white"
              style={{ backgroundColor: brand.green }}
            >
              Nueva venta
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function ConnectionPill({ connection, pending }: { connection: Connection; pending: number }) {
  const offlineLabel =
    pending > 0 ? `Sin conexión — guardando local (${pending})` : "Sin conexión — guardando local";
  const styles = {
    online: { background: "#F1F7EA", color: "#3F6212", label: "En línea" },
    offline: { background: "#FFEDD5", color: "#9A3412", label: offlineLabel },
    syncing: {
      background: "#EAF4FB",
      color: "#123B7A",
      label: `Sincronizando (${pending} ${pending === 1 ? "pendiente" : "pendientes"})`,
    },
  }[connection];
  const short = {
    online: "En línea",
    offline: "Sin conexión",
    syncing: `Sync (${pending})`,
  }[connection];
  return (
    <span
      className="inline-flex h-9 max-w-[46vw] items-center rounded-full px-3 text-xs font-extrabold sm:max-w-none sm:text-sm"
      style={{ backgroundColor: styles.background, color: styles.color }}
      role="status"
    >
      <span className="sm:hidden">{short}</span>
      <span className="hidden truncate sm:inline">{styles.label}</span>
    </span>
  );
}
