"use client";

import { useState } from "react";
import { formatPrice } from "@/lib/money";
import {
  QUICKCOINS_MINIMO_CANJE,
  QUICKCOINS_VALOR_COIN,
  cartAmountDue,
  centsToMoney,
  moneyCents,
  quickcoinsDiscountCents,
  quickcoinsEarn,
  type CartLine,
  type PosDescuento,
} from "@/lib/pos";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export type PosCoinsAccount = {
  telefono: string;
  nombre: string;
  saldo: number;
  canjePuntos: number;
};

type CuentaResponse = {
  telefono?: string;
  nombre?: string;
  saldo?: number;
  encontrado?: boolean;
  error?: string;
  minimoCanje?: number;
};

export function PosQuickcoins({
  open,
  online,
  lines,
  ticket,
  current,
  onClose,
  onApply,
}: {
  open: boolean;
  online: boolean;
  lines: CartLine[];
  ticket: PosDescuento;
  current: PosCoinsAccount | null;
  onClose: () => void;
  onApply: (account: PosCoinsAccount | null) => void;
}) {
  const [telefono, setTelefono] = useState(current?.telefono ?? "");
  const [nombre, setNombre] = useState("");
  const [cuenta, setCuenta] = useState<CuentaResponse | null>(
    current ? { telefono: current.telefono, nombre: current.nombre, saldo: current.saldo, encontrado: true } : null
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const minimo = cuenta?.minimoCanje ?? QUICKCOINS_MINIMO_CANJE;
  const dueCents = moneyCents(cartAmountDue(lines, ticket, 0));
  const coinValue = Math.max(1, moneyCents(QUICKCOINS_VALOR_COIN));
  const maxCoins = Math.floor(dueCents / coinValue);
  const saldo = cuenta?.saldo ?? 0;
  const canjeable = Math.min(saldo, maxCoins);
  const canRedeem = online && saldo >= minimo && maxCoins >= minimo;
  const previewEarn = cuenta?.encontrado
    ? quickcoinsEarn(moneyCents(cartAmountDue(lines, ticket, quickcoinsDiscountCents(canjeable))))
    : 0;

  async function buscar() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/pos/quickcoins?telefono=${encodeURIComponent(telefono)}`, {
        credentials: "include",
        cache: "no-store",
      });
      const body = (await response.json().catch(() => null)) as CuentaResponse | null;
      if (!response.ok) {
        setError(body?.error || "No pudimos buscar el teléfono");
        return;
      }
      setCuenta(body);
    } catch {
      setError("Sin conexión, no se pueden canjear QuickCoins");
    } finally {
      setBusy(false);
    }
  }

  async function crear() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/pos/quickcoins", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telefono, nombre }),
      });
      const body = (await response.json().catch(() => null)) as CuentaResponse | null;
      if (!response.ok) {
        setError(body?.error || "No pudimos crear el cliente");
        return;
      }
      setCuenta(body);
    } catch {
      setError("Sin conexión");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-h-[92dvh] overflow-y-auto font-display">
        <DialogHeader>
          <DialogTitle>QuickCoins</DialogTitle>
          <DialogDescription>1 coin = {formatPrice(1)}. El mínimo para canjear es {minimo}.</DialogDescription>
        </DialogHeader>
        {online ? null : (
          <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
            Sin conexión, no se pueden canjear QuickCoins. La compra igual puede sumar puntos cuando vuelva la red.
          </p>
        )}
        <label className="text-sm font-medium" htmlFor="pos-coins-tel">
          Teléfono
        </label>
        <Input
          id="pos-coins-tel"
          inputMode="tel"
          value={telefono}
          onChange={(event) => setTelefono(event.target.value)}
          className="h-14 text-2xl font-semibold"
        />
        <Button
          type="button"
          size="touch"
          disabled={busy || telefono.replace(/\D/g, "").length < 10}
          onClick={() => void buscar()}
        >
          Buscar
        </Button>
        {cuenta && !cuenta.encontrado ? (
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="pos-coins-nombre">
              Nombre para crear la cuenta
            </label>
            <Input id="pos-coins-nombre" value={nombre} onChange={(event) => setNombre(event.target.value)} className="h-14" />
            <Button type="button" size="touch" variant="outline" disabled={busy || nombre.trim().length === 0} onClick={() => void crear()}>
              Crear cliente
            </Button>
          </div>
        ) : null}
        {cuenta?.encontrado ? (
          <div className="rounded-md bg-accent px-4 py-3">
            <p className="font-semibold">{cuenta.nombre || "Cliente"}</p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-warning">{saldo} coins</p>
            <p className="mt-1 text-sm text-muted-foreground">Ganará {previewEarn}</p>
          </div>
        ) : null}
        {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
        <Button
          type="button"
          size="touch"
          className="h-14 w-full text-lg"
          disabled={!canRedeem}
          onClick={() => {
            if (!cuenta?.telefono || !canRedeem) return;
            onApply({
              telefono: cuenta.telefono,
              nombre: cuenta.nombre || nombre || "Cliente",
              saldo,
              canjePuntos: canjeable,
            });
          }}
        >
          {canRedeem ? `Canjear ${canjeable} · ${formatPrice(centsToMoney(quickcoinsDiscountCents(canjeable)))}` : "Canjear"}
        </Button>
        {cuenta?.encontrado ? (
          <Button
            type="button"
            variant="outline"
            size="touch"
            onClick={() =>
              onApply({
                telefono: cuenta.telefono ?? telefono,
                nombre: cuenta.nombre || "Cliente",
                saldo,
                canjePuntos: 0,
              })
            }
          >
            Solo acumular
          </Button>
        ) : null}
        {current ? (
          <Button type="button" variant="ghost" onClick={() => onApply(null)}>
            Quitar QuickCoins
          </Button>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
