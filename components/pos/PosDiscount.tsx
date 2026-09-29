"use client";

import { useState } from "react";
import { parsePrice } from "@/lib/money";
import { POS_DESCUENTO_TOPE_PCT, type PosDescuento } from "@/lib/pos";
import { brand } from "@/lib/theme";

const PERCENTS = [5, 10, 15, POS_DESCUENTO_TOPE_PCT];

export function PosDiscount({
  title,
  onClose,
  onApply,
}: {
  title: string;
  onClose: () => void;
  onApply: (descuento: PosDescuento) => void;
}) {
  const [montoRaw, setMontoRaw] = useState("");
  const monto = parsePrice(montoRaw);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-6">
      <div className="w-full rounded-t-3xl bg-white px-5 py-5 shadow-2xl sm:max-w-md sm:rounded-3xl" role="dialog" aria-modal="true">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-extrabold">{title}</h2>
          <button type="button" onClick={onClose} className="h-11 px-2 text-sm font-bold">
            Volver
          </button>
        </div>
        <p className="mt-1 text-sm font-semibold text-brand-muted">Hasta {POS_DESCUENTO_TOPE_PCT}% entre la línea y el ticket.</p>
        <div className="mt-4 grid grid-cols-4 gap-2">
          {PERCENTS.map((percent) => (
            <button
              key={percent}
              type="button"
              onClick={() => onApply({ tipo: "porcentaje", valor: percent })}
              className="h-14 rounded-2xl text-base font-extrabold text-white"
              style={{ backgroundColor: brand.green }}
            >
              {percent}%
            </button>
          ))}
        </div>
        <label className="mt-4 block text-sm font-bold text-brand-muted" htmlFor="pos-descuento-monto">
          Monto fijo
        </label>
        <input
          id="pos-descuento-monto"
          inputMode="decimal"
          value={montoRaw}
          onChange={(event) => setMontoRaw(event.target.value)}
          className="mt-2 h-14 w-full rounded-2xl border px-4 text-2xl font-extrabold tabular-nums outline-none"
          style={{ borderColor: "#D1D5DB" }}
        />
        <button
          type="button"
          disabled={monto == null || monto <= 0}
          onClick={() => {
            if (monto != null) onApply({ tipo: "monto", valor: monto });
          }}
          className="mt-3 flex h-14 w-full items-center justify-center rounded-2xl text-lg font-extrabold text-white disabled:opacity-40"
          style={{ backgroundColor: brand.navy }}
        >
          Aplicar monto
        </button>
        <button
          type="button"
          onClick={() => onApply({ tipo: "ninguno" })}
          className="mt-2 flex h-12 w-full items-center justify-center text-sm font-bold text-brand-muted"
        >
          Quitar descuento
        </button>
      </div>
    </div>
  );
}
