"use client";

import { useState } from "react";
import { formatPrice } from "@/lib/money";
import { cartTotal, lineSubtotal, type CartLine } from "@/lib/pos";
import { brand } from "@/lib/theme";

type PosCartProps = {
  lines: CartLine[];
  onQty: (productoId: string, cantidad: number) => void;
  onRemove: (productoId: string) => void;
  onClear: () => void;
  onCheckout: () => void;
};

export function PosCart({ lines, onQty, onRemove, onClear, onCheckout }: PosCartProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [confirmClear, setConfirmClear] = useState(false);
  const total = cartTotal(lines);
  const count = lines.reduce((sum, line) => sum + line.cantidad, 0);

  function commitQty(line: CartLine) {
    const raw = drafts[line.productoId];
    if (raw == null) {
      return;
    }
    setDrafts((current) => {
      const next = { ...current };
      delete next[line.productoId];
      return next;
    });
    const parsed = Number(raw);
    if (!raw.trim() || !Number.isInteger(parsed)) {
      return;
    }
    onQty(line.productoId, parsed);
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "#E5E7EB" }}>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Carrito</p>
          <p className="font-display text-lg font-extrabold">
            {count === 0 ? "Vacío" : `${count} ${count === 1 ? "unidad" : "unidades"}`}
          </p>
        </div>
        {lines.length > 0 ? (
          confirmClear ? (
            <button
              type="button"
              onClick={() => {
                setConfirmClear(false);
                onClear();
              }}
              className="min-h-11 rounded-full px-3 text-sm font-bold"
              style={{ backgroundColor: "#FEE2E2", color: brand.error }}
            >
              Sí, vaciar
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="min-h-11 rounded-full px-3 text-sm font-semibold text-brand-muted"
            >
              Vaciar carrito
            </button>
          )
        ) : null}
      </div>

      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {lines.length === 0 ? (
          <li className="px-2 py-10 text-center text-sm text-brand-muted">
            Toca un producto para agregarlo.
          </li>
        ) : (
          lines.map((line) => (
            <li key={line.productoId} className="rounded-2xl border px-3 py-3" style={{ borderColor: "#E5E7EB" }}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-tight">{line.nombre}</p>
                  <p className="mt-0.5 text-sm text-brand-muted">{formatPrice(line.precioUnitario)} c/u</p>
                </div>
                <p className="shrink-0 text-base font-bold tabular-nums">{formatPrice(lineSubtotal(line))}</p>
                <button
                  type="button"
                  onClick={() => onRemove(line.productoId)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                  style={{ color: brand.error, backgroundColor: "#FEF2F2" }}
                  aria-label={`Quitar ${line.nombre}`}
                >
                  <TrashIcon />
                </button>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onQty(line.productoId, line.cantidad - 1)}
                  className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl font-bold text-white"
                  style={{ backgroundColor: brand.navy }}
                  aria-label={`Quitar uno de ${line.nombre}`}
                >
                  −
                </button>
                <input
                  inputMode="numeric"
                  aria-label={`Cantidad de ${line.nombre}`}
                  value={drafts[line.productoId] ?? String(line.cantidad)}
                  onFocus={(event) => event.currentTarget.select()}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [line.productoId]: event.target.value.replace(/[^\d]/g, "").slice(0, 4),
                    }))
                  }
                  onBlur={() => commitQty(line)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.currentTarget.blur();
                    }
                  }}
                  className="h-12 w-16 rounded-xl border text-center text-lg font-bold tabular-nums outline-none"
                  style={{ borderColor: "#D1D5DB" }}
                />
                <button
                  type="button"
                  onClick={() => onQty(line.productoId, line.cantidad + 1)}
                  className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl font-bold text-white"
                  style={{ backgroundColor: brand.green }}
                  aria-label={`Agregar uno de ${line.nombre}`}
                >
                  +
                </button>
              </div>
            </li>
          ))
        )}
      </ul>

      <div className="shrink-0 border-t px-4 pb-4 pt-3" style={{ borderColor: "#E5E7EB" }}>
        <div className="flex items-baseline justify-between text-sm text-brand-muted">
          <span>Subtotal</span>
          <span className="font-semibold tabular-nums">{formatPrice(total)}</span>
        </div>
        <div className="mt-1 flex items-baseline justify-between">
          <span className="text-base font-bold">Total</span>
          <span className="font-display text-4xl font-extrabold tabular-nums leading-none" style={{ color: brand.ink }}>
            {formatPrice(total)}
          </span>
        </div>
        <button
          type="button"
          disabled={lines.length === 0}
          onClick={onCheckout}
          className="mt-3 flex h-14 w-full items-center justify-center rounded-2xl text-lg font-extrabold text-white disabled:opacity-40"
          style={{ backgroundColor: brand.green }}
        >
          Cobrar
        </button>
      </div>
    </div>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 7h16" strokeLinecap="round" />
      <path d="M9 7V5h6v2" strokeLinecap="round" />
      <path d="M8 7l1 13h6l1-13" />
    </svg>
  );
}
