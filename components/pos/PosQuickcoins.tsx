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
import { brand } from "@/lib/theme";

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
  online,
  lines,
  ticket,
  current,
  onClose,
  onApply,
}: {
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
  const canRedeem = online && (cuenta?.saldo ?? 0) >= minimo && maxCoins >= minimo;

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

  function canjear() {
    if (!cuenta?.telefono || !canRedeem) return;
    const puntos = Math.min(cuenta.saldo ?? 0, maxCoins);
    onApply({
      telefono: cuenta.telefono,
      nombre: cuenta.nombre || nombre || "Cliente",
      saldo: cuenta.saldo ?? 0,
      canjePuntos: puntos,
    });
  }

  const previewEarn = cuenta?.encontrado
    ? quickcoinsEarn(moneyCents(cartAmountDue(lines, ticket, quickcoinsDiscountCents(Math.min(cuenta.saldo ?? 0, maxCoins)))))
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-6">
      <div className="flex max-h-[94dvh] w-full flex-col rounded-t-3xl bg-white shadow-2xl sm:max-w-md sm:rounded-3xl" role="dialog" aria-modal="true">
        <div className="flex items-center justify-between gap-3 border-b px-5 py-4" style={{ borderColor: "#E5E7EB" }}>
          <h2 className="font-display text-2xl font-extrabold">QuickCoins</h2>
          <button type="button" onClick={onClose} className="h-11 px-2 text-sm font-bold">
            Volver
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {!online ? (
            <p className="rounded-2xl px-3 py-2 text-sm font-semibold" style={{ backgroundColor: "#FFEDD5", color: "#9A3412" }}>
              Sin conexión, no se pueden canjear QuickCoins. La compra igual puede sumar puntos cuando vuelva la red.
            </p>
          ) : null}
          <label className="mt-3 block text-sm font-bold text-brand-muted" htmlFor="pos-coins-tel">
            Teléfono
          </label>
          <input
            id="pos-coins-tel"
            inputMode="tel"
            value={telefono}
            onChange={(event) => setTelefono(event.target.value)}
            className="mt-2 h-14 w-full rounded-2xl border px-4 text-2xl font-extrabold tabular-nums outline-none"
            style={{ borderColor: "#D1D5DB" }}
          />
          <button
            type="button"
            disabled={busy || telefono.replace(/\D/g, "").length < 10}
            onClick={() => void buscar()}
            className="mt-3 flex h-12 w-full items-center justify-center rounded-2xl text-base font-extrabold text-white disabled:opacity-40"
            style={{ backgroundColor: brand.navy }}
          >
            Buscar
          </button>
          {cuenta && !cuenta.encontrado ? (
            <div className="mt-4">
              <label className="text-sm font-bold text-brand-muted" htmlFor="pos-coins-nombre">
                Nombre para crear la cuenta
              </label>
              <input
                id="pos-coins-nombre"
                value={nombre}
                onChange={(event) => setNombre(event.target.value)}
                className="mt-2 h-14 w-full rounded-2xl border px-4 text-lg font-semibold outline-none"
                style={{ borderColor: "#D1D5DB" }}
              />
              <button
                type="button"
                disabled={busy || nombre.trim().length === 0}
                onClick={() => void crear()}
                className="mt-3 flex h-12 w-full items-center justify-center rounded-2xl text-base font-extrabold disabled:opacity-40"
                style={{ backgroundColor: brand.paleOrange }}
              >
                Crear cliente
              </button>
            </div>
          ) : null}
          {cuenta?.encontrado ? (
            <div className="mt-4 rounded-2xl px-4 py-3" style={{ backgroundColor: "#FDF1DE" }}>
              <p className="font-extrabold">{cuenta.nombre || "Cliente"}</p>
              <p className="mt-1 text-3xl font-extrabold tabular-nums" style={{ color: brand.orange }}>
                {cuenta.saldo ?? 0} coins
              </p>
              <p className="mt-1 text-sm font-semibold text-brand-muted">
                Ganará {previewEarn} · 1 coin = {formatPrice(1)} · mínimo {minimo}
              </p>
            </div>
          ) : null}
          {error ? <p className="mt-3 text-sm font-bold" style={{ color: brand.error }}>{error}</p> : null}
        </div>
        <div className="space-y-2 border-t px-5 py-4" style={{ borderColor: "#E5E7EB" }}>
          <button
            type="button"
            disabled={!canRedeem}
            onClick={canjear}
            className="flex h-14 w-full items-center justify-center rounded-2xl text-lg font-extrabold text-white disabled:opacity-40"
            style={{ backgroundColor: brand.orange }}
          >
            {canRedeem ? `Canjear ${Math.min(cuenta?.saldo ?? 0, maxCoins)} · ${formatPrice(centsToMoney(quickcoinsDiscountCents(Math.min(cuenta?.saldo ?? 0, maxCoins))))}` : "Canjear"}
          </button>
          {current ? (
            <button type="button" onClick={() => onApply(null)} className="flex h-11 w-full items-center justify-center text-sm font-bold text-brand-muted">
              Quitar QuickCoins
            </button>
          ) : null}
          {cuenta?.encontrado ? (
            <button
              type="button"
              onClick={() =>
                onApply({
                  telefono: cuenta.telefono ?? telefono,
                  nombre: cuenta.nombre || "Cliente",
                  saldo: cuenta.saldo ?? 0,
                  canjePuntos: 0,
                })
              }
              className="flex h-11 w-full items-center justify-center text-sm font-bold"
            >
              Solo acumular
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
