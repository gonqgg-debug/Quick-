"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { StaffLogin } from "@/components/staff/StaffLogin";
import { PosCart } from "@/components/pos/PosCart";
import { PosCatalog } from "@/components/pos/PosCatalog";
import { PosDiscount } from "@/components/pos/PosDiscount";
import { PosOpenShift } from "@/components/pos/PosOpenShift";
import { PosPayDialog } from "@/components/pos/PosPayDialog";
import { PosQuickcoins, type PosCoinsAccount } from "@/components/pos/PosQuickcoins";
import { PosTicketPreview } from "@/components/pos/PosTicketPreview";
import { pullCatalog, queuePosSale, syncPendingSales } from "@/components/pos/pos-sync";
import {
  clearShift,
  countPendingSales,
  readLocalProducts,
  readShift,
  salesSince,
  saveShift,
  type PosSaleRecord,
  type PosShift,
} from "@/lib/pos-db";
import { findProductsByBarcode } from "@/lib/pos";
import { formatPrice } from "@/lib/money";
import { printPosTicket, printTicketInBrowser } from "@/lib/pos-print";
import {
  POS_SIN_DESCUENTO,
  QUICKCOINS_VALOR_COIN,
  addProductToCart,
  cartAmountDue,
  centsToMoney,
  manualDiscountWithinCap,
  moneyCents,
  priceCart,
  quickcoinsDiscountCents,
  quickcoinsEarn,
  setCartQty,
  setLineDiscount,
  type CartLine,
  type PosDescuento,
} from "@/lib/pos";
import { type PosMetodoPago, type PosProduct } from "@/lib/pos-shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";

type Gate = "loading" | "login" | "ready";
type LinkState = "online" | "offline" | "syncing" | "unauthorized";

export function PosScreen() {
  const [gate, setGate] = useState<Gate>("loading");
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ticketDiscount, setTicketDiscount] = useState<PosDescuento>(POS_SIN_DESCUENTO);
  const [discountTarget, setDiscountTarget] = useState<"ticket" | string | null>(null);
  const [coins, setCoins] = useState<PosCoinsAccount | null>(null);
  const [coinsOpen, setCoinsOpen] = useState(false);
  const [receipt, setReceipt] = useState<PosSaleRecord | null>(null);
  const [printNote, setPrintNote] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [link, setLink] = useState<LinkState>("online");
  const [pending, setPending] = useState(0);
  const [payOpen, setPayOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [offlineEmpty, setOfflineEmpty] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [shift, setShift] = useState<PosShift | null>(null);
  const [shiftReady, setShiftReady] = useState(false);
  const [closeShiftOpen, setCloseShiftOpen] = useState(false);
  const [shiftSummary, setShiftSummary] = useState({ count: 0, total: 0 });

  const refreshPending = useCallback(async () => {
    setPending(await countPendingSales().catch(() => 0));
  }, []);

  const syncNow = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setLink("offline");
      await refreshPending();
      return;
    }
    setLink("syncing");
    const result = await syncPendingSales();
    setPending(result.pending);
    if (result.stop === "unauthorized") {
      setLink("unauthorized");
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setLink("offline");
      return;
    }
    setLink(result.pending > 0 ? "syncing" : "online");
  }, [refreshPending]);

  const load = useCallback(async () => {
    const result = await pullCatalog();
    setProducts(result.products);
    setOfflineEmpty(result.products.length === 0 && (result.offline || !navigator.onLine));
    setLoadError(result.failed && result.products.length === 0);
    if (result.unauthorized && result.products.length === 0) {
      setGate("login");
      setLink("unauthorized");
      return;
    }
    setGate("ready");
    if (result.offline || !navigator.onLine) {
      setLink("offline");
    } else if (result.unauthorized) {
      setLink("unauthorized");
    } else {
      await syncNow();
    }
    await refreshPending();
  }, [refreshPending, syncNow]);

  useEffect(() => {
    void load();
    void readShift()
      .then(setShift)
      .catch(() => setShift(null))
      .finally(() => setShiftReady(true));
  }, [load]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) {
      return;
    }
    // /pos no entra en un scope /pos/ (hace falta la barra). El script en la raíz
    // sí puede usar el scope /pos, que cubre esta ruta y no el resto del sitio.
    void navigator.serviceWorker.register("/sw.js", { scope: "/pos" }).catch(() => undefined);
  }, []);

  useEffect(() => {
    const onStatus = () => {
      if (!navigator.onLine) {
        setLink("offline");
        return;
      }
      void syncNow();
    };
    window.addEventListener("online", onStatus);
    window.addEventListener("offline", onStatus);
    const timer = window.setInterval(() => {
      if (navigator.onLine) {
        void pullCatalog().then((result) => {
          if (result.products.length > 0) {
            setProducts(result.products);
            setOfflineEmpty(false);
            setLoadError(false);
          }
          void syncNow();
        });
      }
    }, 5 * 60 * 1000);
    return () => {
      window.removeEventListener("online", onStatus);
      window.removeEventListener("offline", onStatus);
      window.clearInterval(timer);
    };
  }, [syncNow]);

  function addProduct(product: PosProduct) {
    setLines((current) => addProductToCart(current, product));
    setFlashId(product.id);
    window.setTimeout(() => setFlashId((current) => (current === product.id ? null : current)), 180);
  }

  function scanCode(code: string) {
    const matches = findProductsByBarcode(products, code);
    if (matches.length === 1) {
      addProduct(matches[0]);
      return;
    }
    toast.error(matches.length === 0 ? "Ese código no está en el catálogo" : "Hay más de un producto con ese código");
  }

  function changeQty(productoId: string, cantidad: number) {
    setLines((current) => setCartQty(current, productoId, cantidad));
  }

  function resetSale() {
    setLines([]);
    setTicketDiscount(POS_SIN_DESCUENTO);
    setCoins(null);
  }

  function applyDiscount(descuento: PosDescuento) {
    if (discountTarget == null) return;
    if (discountTarget === "ticket") {
      if (!manualDiscountWithinCap(lines, descuento)) {
        toast.error("El descuento pasa del 20%");
        return;
      }
      setTicketDiscount(descuento);
    } else {
      const next = setLineDiscount(lines, discountTarget, descuento, ticketDiscount);
      if ("error" in next) {
        toast.error(next.error);
        return;
      }
      setLines(next);
    }
    setDiscountTarget(null);
  }

  const coinCents = quickcoinsDiscountCents(coins?.canjePuntos ?? 0);
  const priced = useMemo(() => priceCart(lines, ticketDiscount, coinCents), [lines, ticketDiscount, coinCents]);
  const priceError = "error" in priced ? priced.error : null;
  const subtotal = "error" in priced ? 0 : centsToMoney(priced.listCents);
  const descuento = "error" in priced ? 0 : centsToMoney(priced.lineDiscountCents + priced.ticketDiscountCents);
  const coinsMoney = "error" in priced ? 0 : centsToMoney(priced.coinDiscountCents);
  const total = cartAmountDue(lines, ticketDiscount, coinCents);

  async function confirmSale(metodo: PosMetodoPago, montoRecibido: number | null) {
    if (lines.length === 0 || priceError || "error" in priced) {
      toast.error(priceError ?? "Revisa el carrito");
      return;
    }
    const canjeAplicado = Math.floor(priced.coinDiscountCents / Math.max(1, moneyCents(QUICKCOINS_VALOR_COIN)));
    if (canjeAplicado > 0 && (typeof navigator === "undefined" || !navigator.onLine)) {
      toast.error("Sin conexión no se pueden canjear QuickCoins");
      return;
    }
    const clientId = crypto.randomUUID();
    const quickcoins = coins
      ? {
          telefono: coins.telefono,
          nombre: coins.nombre,
          canjePuntos: canjeAplicado,
          ganarPuntos: quickcoinsEarn(priced.totalCents),
          descuentoCanje: centsToMoney(priced.coinDiscountCents),
        }
      : null;
    try {
      const record = await queuePosSale({
        clientId,
        createdAt: new Date().toISOString(),
        items: priced.items,
        metodoPago: metodo,
        montoRecibido,
        descuentoTicket: centsToMoney(priced.ticketDiscountCents),
        descuentoTotal: centsToMoney(priced.lineDiscountCents + priced.ticketDiscountCents + priced.coinDiscountCents),
        quickcoins,
        cajero: shift ? `Turno ${shift.periodo}` : null,
      });
      setProducts(await readLocalProducts());
      resetSale();
      setPayOpen(false);
      setCartOpen(false);
      setReceipt(record);
      setPrintNote(null);
      await refreshPending();
    } catch (error) {
      console.error("[pos] no se pudo guardar la venta local", error);
      toast.error("No se pudo guardar la venta en este equipo. Inténtalo otra vez.");
      return;
    }
    void syncNow();
  }

  async function askCloseShift() {
    if (!shift) {
      return;
    }
    setShiftSummary(await salesSince(shift.openedAt).catch(() => ({ count: 0, total: 0 })));
    setCloseShiftOpen(true);
  }

  if (gate === "login") {
    return <StaffLogin onSuccess={() => void load()} />;
  }

  if (gate === "loading" || !shiftReady) {
    return <p className="p-6 text-sm text-muted-foreground">Abriendo el cobro…</p>;
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-background font-display text-foreground">
      <Toaster
        theme="light"
        position="top-center"
        className="toaster group font-display"
        toastOptions={{
          classNames: {
            toast:
              "group toast font-display group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
            description: "group-[.toast]:text-muted-foreground",
            actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
            cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          },
        }}
      />
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2 md:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <p className="shrink-0 text-lg font-semibold">Cobro</p>
          {shift ? (
            <Button type="button" variant="outline" size="touch" className="h-11" onClick={() => void askCloseShift()}>
              Turno {shift.periodo}
            </Button>
          ) : null}
        </div>
        <ConnectionBadge link={link} pending={pending} />
      </header>
      {shift ? (
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          <PosCatalog
            products={products}
            loading={false}
            offlineEmpty={offlineEmpty}
            loadError={loadError}
            flashId={flashId}
            onAdd={addProduct}
            onScan={scanCode}
          />
        </div>
        <aside className="hidden h-full w-[34%] min-w-[320px] max-w-[440px] border-l border-border lg:block">
          <PosCart
            lines={lines}
            subtotal={subtotal}
            descuento={descuento}
            coinsMoney={coinsMoney}
            total={total}
            coinsLabel={coins ? `${coins.canjePuntos || "✓"} coins` : null}
            onChangeQty={changeQty}
            onRemove={(id) => changeQty(id, 0)}
            onClear={() => setClearOpen(true)}
            onCharge={() => setPayOpen(true)}
            onDiscountLine={(id) => setDiscountTarget(id)}
            onDiscountTicket={() => setDiscountTarget("ticket")}
            onQuickcoins={() => setCoinsOpen(true)}
          />
        </aside>
      </div>
      ) : (
        <PosOpenShift
          onOpen={(periodo, fondoInicial) => {
            const next: PosShift = {
              id: "current",
              periodo,
              fondoInicial,
              openedAt: new Date().toISOString(),
            };
            void saveShift(next).then(() => setShift(next));
          }}
        />
      )}

      {shift ? (
      <div className="shrink-0 border-t border-border p-3 lg:hidden">
        <Button type="button" className="h-14 w-full text-lg" onClick={() => setCartOpen(true)}>
          Ver carrito ({lines.reduce((sum, line) => sum + line.cantidad, 0)}) — {formatPrice(total)}
        </Button>
      </div>
      ) : null}

      <Dialog open={cartOpen} onOpenChange={setCartOpen}>
        <DialogContent className="bottom-0 left-0 top-auto flex h-[88dvh] max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-b-none rounded-t-2xl p-0 font-display sm:bottom-0 sm:rounded-b-none sm:rounded-t-2xl">
          <DialogTitle className="sr-only">Carrito</DialogTitle>
          <DialogDescription className="sr-only">Productos de esta venta y el botón de cobrar.</DialogDescription>
          <PosCart
            lines={lines}
            subtotal={subtotal}
            descuento={descuento}
            coinsMoney={coinsMoney}
            total={total}
            coinsLabel={coins ? `${coins.canjePuntos || "✓"} coins` : null}
            onChangeQty={changeQty}
            onRemove={(id) => changeQty(id, 0)}
            onClear={() => setClearOpen(true)}
            onCharge={() => setPayOpen(true)}
            onDiscountLine={(id) => setDiscountTarget(id)}
            onDiscountTicket={() => setDiscountTarget("ticket")}
            onQuickcoins={() => setCoinsOpen(true)}
          />
        </DialogContent>
      </Dialog>

      <PosPayDialog open={payOpen} total={total} onOpenChange={setPayOpen} onConfirm={(metodo, monto) => void confirmSale(metodo, monto)} />

      <PosDiscount
        open={discountTarget != null}
        title={discountTarget === "ticket" ? "Descuento del ticket" : "Descuento de línea"}
        onClose={() => setDiscountTarget(null)}
        onApply={applyDiscount}
      />
      <PosQuickcoins
        open={coinsOpen}
        online={link !== "offline"}
        lines={lines}
        ticket={ticketDiscount}
        current={coins}
        onClose={() => setCoinsOpen(false)}
        onApply={(account) => {
          setCoins(account);
          setCoinsOpen(false);
        }}
      />

      <Dialog
        open={receipt != null}
        onOpenChange={(open) => {
          if (!open) setReceipt(null);
        }}
      >
        <DialogContent className="max-h-[92dvh] overflow-y-auto font-display">
          <DialogHeader>
            <DialogTitle>Recibo</DialogTitle>
            <DialogDescription>Precios con ITBIS incluido.</DialogDescription>
          </DialogHeader>
          {receipt ? <PosTicketPreview sale={receipt} /> : null}
          {printNote ? <p className="text-center text-sm text-muted-foreground">{printNote}</p> : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-12"
              onClick={() => {
                if (!receipt) return;
                printTicketInBrowser(receipt);
              }}
            >
              Imprimir aquí
            </Button>
            <Button
              type="button"
              className="h-12"
              onClick={() => {
                if (!receipt) return;
                void printPosTicket(receipt, { openDrawer: receipt.metodoPago === "efectivo", request: true }).then((result) => {
                  setPrintNote(result.ok ? "Ticket enviado a la impresora" : result.message);
                });
              }}
            >
              Imprimir ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={closeShiftOpen} onOpenChange={setCloseShiftOpen}>
        <DialogContent className="font-display">
          <DialogHeader>
            <DialogTitle>Cerrar turno {shift?.periodo}</DialogTitle>
            <DialogDescription>
              {shiftSummary.count === 0
                ? "Este turno todavía no tiene ventas guardadas en este equipo."
                : `${shiftSummary.count === 1 ? "1 venta" : `${shiftSummary.count} ventas`} · ${formatPrice(shiftSummary.total)}. El fondo inicial era ${formatPrice(shift?.fondoInicial ?? 0)}.`}
              {" "}El cierre contado sigue haciéndose en Administración → Caja → Turnos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" className="h-12" onClick={() => setCloseShiftOpen(false)}>
              Seguir
            </Button>
            <Button
              type="button"
              className="h-12"
              onClick={() => {
                void clearShift().then(() => {
                setShift(null);
                resetSale();
                setCloseShiftOpen(false);
                  setCartOpen(false);
                  setPayOpen(false);
                });
              }}
            >
              Cerrar turno
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={clearOpen} onOpenChange={setClearOpen}>
        <DialogContent className="font-display">
          <DialogHeader>
            <DialogTitle>Vaciar carrito</DialogTitle>
            <DialogDescription>Se quitan todos los productos de esta venta. No se cobra nada.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" className="h-12" onClick={() => setClearOpen(false)}>
              Seguir armando
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-12"
              onClick={() => {
                resetSale();
                setClearOpen(false);
                setCartOpen(false);
              }}
            >
              Vaciar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ConnectionBadge({ link, pending }: { link: LinkState; pending: number }) {
  const className = "h-auto min-h-8 max-w-[68vw] whitespace-normal px-3 py-1 text-center text-xs leading-tight sm:max-w-none sm:text-sm";
  const queued = pending === 1 ? "1 pendiente" : `${pending} pendientes`;
  if (link === "offline") {
    return (
      <Badge variant="warning" className={className}>
        {pending > 0 ? `Sin conexión — ${queued}` : "Sin conexión — guardando local"}
      </Badge>
    );
  }
  if (link === "unauthorized") {
    return (
      <Badge variant="warning" className={className}>
        Sin sesión — las ventas siguen guardadas
      </Badge>
    );
  }
  if (link === "syncing" || pending > 0) {
    return (
      <Badge variant="outline" className={`${className} border-brand-blue/40 text-brand-blue`}>
        Sincronizando ({queued})
      </Badge>
    );
  }
  return (
    <Badge variant="success" className={className}>
      En línea
    </Badge>
  );
}
