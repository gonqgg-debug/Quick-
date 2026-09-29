"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { StaffLogin } from "@/components/staff/StaffLogin";
import { PosCart } from "@/components/pos/PosCart";
import { PosCatalog } from "@/components/pos/PosCatalog";
import { PosOpenShift } from "@/components/pos/PosOpenShift";
import { PosPayDialog } from "@/components/pos/PosPayDialog";
import { pullCatalog, queuePosSale, syncPendingSales } from "@/components/pos/pos-sync";
import {
  clearShift,
  countPendingSales,
  readLocalProducts,
  readShift,
  salesSince,
  saveShift,
  type PosShift,
} from "@/lib/pos-db";
import { formatPrice } from "@/lib/money";
import { saleTotal, type PosMetodoPago, type PosProduct, type PosSaleItem } from "@/lib/pos-shared";
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
  const [lines, setLines] = useState<PosSaleItem[]>([]);
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
    setLines((current) => {
      const existing = current.find((line) => line.productoId === product.id);
      if (!existing) {
        return [
          ...current,
          { productoId: product.id, nombre: product.nombre, cantidad: 1, precioUnitario: product.precio },
        ];
      }
      return current.map((line) =>
        line.productoId === product.id ? { ...line, cantidad: Math.min(999, line.cantidad + 1) } : line
      );
    });
    setFlashId(product.id);
    window.setTimeout(() => setFlashId((current) => (current === product.id ? null : current)), 180);
  }

  function changeQty(productoId: string, cantidad: number) {
    setLines((current) => {
      if (cantidad <= 0) {
        return current.filter((line) => line.productoId !== productoId);
      }
      return current.map((line) =>
        line.productoId === productoId ? { ...line, cantidad: Math.min(999, Math.floor(cantidad)) } : line
      );
    });
  }

  async function confirmSale(metodo: PosMetodoPago, montoRecibido: number | null) {
    const snapshot = lines;
    if (snapshot.length === 0) {
      return;
    }
    const clientId = crypto.randomUUID();
    const total = saleTotal(snapshot);
    try {
      const record = await queuePosSale({
        clientId,
        createdAt: new Date().toISOString(),
        items: snapshot,
        metodoPago: metodo,
        montoRecibido,
      });
      setProducts(await readLocalProducts());
      setLines([]);
      setPayOpen(false);
      setCartOpen(false);
      await refreshPending();
      const cambio = record.cambio ?? 0;
      toast.success("Venta guardada", {
        description:
          metodo === "efectivo"
            ? `${formatPrice(total)} · Cambio ${formatPrice(cambio)}`
            : formatPrice(total),
        duration: 3500,
      });
    } catch (error) {
      console.error("[pos] no se pudo guardar la venta local", error);
      toast.error("No se pudo guardar la venta en este equipo. Inténtalo otra vez.");
      return;
    }
    void syncNow();
  }

  const total = useMemo(() => saleTotal(lines), [lines]);

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
    <div className="fixed inset-0 flex flex-col bg-background text-foreground">
      <Toaster theme="light" position="top-center" />
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
          />
        </div>
        <aside className="hidden h-full w-[34%] min-w-[320px] max-w-[440px] border-l border-border lg:block">
          <PosCart
            lines={lines}
            onChangeQty={changeQty}
            onRemove={(id) => changeQty(id, 0)}
            onClear={() => setClearOpen(true)}
            onCharge={() => setPayOpen(true)}
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
        <DialogContent className="bottom-0 left-0 top-auto flex h-[88dvh] max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-b-none rounded-t-2xl p-0 sm:bottom-0 sm:rounded-b-none sm:rounded-t-2xl">
          <DialogTitle className="sr-only">Carrito</DialogTitle>
          <DialogDescription className="sr-only">Productos de esta venta y el botón de cobrar.</DialogDescription>
          <PosCart
            lines={lines}
            onChangeQty={changeQty}
            onRemove={(id) => changeQty(id, 0)}
            onClear={() => setClearOpen(true)}
            onCharge={() => setPayOpen(true)}
          />
        </DialogContent>
      </Dialog>

      <PosPayDialog open={payOpen} lines={lines} onOpenChange={setPayOpen} onConfirm={(metodo, monto) => void confirmSale(metodo, monto)} />

      <Dialog open={closeShiftOpen} onOpenChange={setCloseShiftOpen}>
        <DialogContent>
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
                  setLines([]);
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
        <DialogContent>
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
                setLines([]);
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
