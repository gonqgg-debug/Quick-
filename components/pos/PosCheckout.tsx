"use client";

import { useMemo, useState } from "react";
import { formatPrice, parsePrice } from "@/lib/money";
import {
  cashChangeAmount,
  metodoPagoLabel,
  posQuickCashAmounts,
  type PosMetodoPago,
} from "@/lib/pos";
import { brand } from "@/lib/theme";

const METODOS: PosMetodoPago[] = ["efectivo", "tarjeta", "transferencia"];

type PosCheckoutProps = {
  total: number;
  busy: boolean;
  onClose: () => void;
  onConfirm: (metodo: PosMetodoPago, montoRecibido: number | null) => void;
};

export function PosCheckout({ total, busy, onClose, onConfirm }: PosCheckoutProps) {
  const [metodo, setMetodo] = useState<PosMetodoPago>("efectivo");
  const [montoRaw, setMontoRaw] = useState("");
  const quick = useMemo(() => posQuickCashAmounts(total), [total]);
  const monto = parsePrice(montoRaw);
  const shortfall = metodo === "efectivo" && monto != null && cashChangeAmount(monto, total) < 0;
  const cambio = metodo === "efectivo" && monto != null && !shortfall ? cashChangeAmount(monto, total) : null;
  const canConfirm = !busy && (metodo !== "efectivo" || (monto != null && !shortfall));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-6">
      <div
        className="flex max-h-[94dvh] w-full flex-col rounded-t-3xl bg-white shadow-2xl sm:max-w-lg sm:rounded-3xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-cobro-title"
      >
        <div className="flex items-center justify-between gap-3 border-b px-5 py-4" style={{ borderColor: "#E5E7EB" }}>
          <div>
            <p id="pos-cobro-title" className="font-display text-2xl font-extrabold">
              Cobrar
            </p>
            <p className="text-sm text-brand-muted">Total a pagar</p>
          </div>
          <p className="font-display text-3xl font-extrabold tabular-nums" style={{ color: brand.navy }}>
            {formatPrice(total)}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <p className="text-sm font-bold text-brand-muted">Método de pago</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {METODOS.map((option) => {
              const selected = metodo === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setMetodo(option)}
                  className="min-h-16 rounded-2xl border px-2 text-base font-extrabold"
                  style={{
                    backgroundColor: selected ? brand.green : "#FFFFFF",
                    color: selected ? "#FFFFFF" : brand.ink,
                    borderColor: selected ? brand.green : "#D1D5DB",
                  }}
                  aria-pressed={selected}
                >
                  {metodoPagoLabel(option)}
                </button>
              );
            })}
          </div>

          {metodo === "efectivo" ? (
            <div className="mt-5">
              <label className="text-sm font-bold text-brand-muted" htmlFor="pos-monto">
                Monto recibido
              </label>
              <input
                id="pos-monto"
                inputMode="decimal"
                value={montoRaw}
                onChange={(event) => setMontoRaw(event.target.value)}
                placeholder="0"
                className="mt-2 h-16 w-full rounded-2xl border px-4 text-3xl font-extrabold tabular-nums outline-none"
                style={{ borderColor: "#D1D5DB" }}
              />
              <div className="mt-3 grid grid-cols-3 gap-2">
                {quick.map((option) => (
                  <button
                    key={option.amount}
                    type="button"
                    onClick={() => setMontoRaw(String(option.amount))}
                    className="min-h-12 rounded-xl border px-2 text-sm font-bold"
                    style={{ borderColor: "#D1D5DB", backgroundColor: brand.cream }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="mt-4 rounded-2xl px-4 py-4" style={{ backgroundColor: shortfall ? "#FEF2F2" : brand.paleGreen }}>
                <p className="text-sm font-bold text-brand-muted">{shortfall ? "Falta" : "Cambio"}</p>
                <p
                  className="font-display text-5xl font-extrabold tabular-nums leading-none"
                  style={{ color: shortfall ? brand.error : brand.green }}
                >
                  {monto == null
                    ? "—"
                    : formatPrice(shortfall ? Math.abs(cashChangeAmount(monto, total)) : (cambio ?? 0))}
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl px-4 py-5" style={{ backgroundColor: brand.paleBlue }}>
              <p className="text-sm font-bold text-brand-muted">Se registra como {metodoPagoLabel(metodo).toLowerCase()}</p>
              <p className="font-display mt-1 text-4xl font-extrabold tabular-nums">{formatPrice(total)}</p>
            </div>
          )}
        </div>

        <div className="grid shrink-0 grid-cols-[auto_1fr] gap-2 border-t p-4" style={{ borderColor: "#E5E7EB" }}>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="min-h-14 rounded-2xl border px-5 text-base font-bold disabled:opacity-40"
            style={{ borderColor: "#D1D5DB" }}
          >
            Volver
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => onConfirm(metodo, metodo === "efectivo" ? monto : null)}
            className="min-h-14 rounded-2xl text-lg font-extrabold text-white disabled:opacity-40"
            style={{ backgroundColor: brand.green }}
          >
            {busy ? "Guardando…" : "Confirmar cobro"}
          </button>
        </div>
      </div>
    </div>
  );
}
