"use client";

import { useMemo, useState } from "react";
import { coversTotal, suggestedPagoConAmounts } from "@/lib/cash-payment";
import { formatPrice } from "@/lib/money";
import { brand } from "@/lib/theme";

type CashAmountPickerProps = {
  total: number;
  value: number | null;
  onChange: (value: number | null) => void;
};

export function CashAmountPicker({ total, value, onChange }: CashAmountPickerProps) {
  const suggestions = useMemo(() => suggestedPagoConAmounts(total), [total]);
  const [customOpen, setCustomOpen] = useState(false);
  const [customRaw, setCustomRaw] = useState("");
  const customAmount = Number(customRaw.replace(",", "."));
  const customValid = Number.isFinite(customAmount) && coversTotal(customAmount, total);
  const isCustomSelected =
    value != null && !suggestions.includes(value) && coversTotal(value, total);

  return (
    <fieldset className="mt-4">
      <legend className="text-sm font-bold text-brand-ink">¿Con cuánto vas a pagar?</legend>
      <p className="mt-1 text-xs text-brand-muted">
        Así el motorizado lleva el cambio exacto.
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {suggestions.map((amount) => {
          const selected = value === amount;
          const isExact = amount === Math.ceil(total);
          return (
            <button
              key={amount}
              type="button"
              onClick={() => {
                setCustomOpen(false);
                onChange(amount);
              }}
              className="rounded-2xl border-2 bg-white px-4 py-3 text-left"
              style={{ borderColor: selected ? brand.green : `${brand.muted}40` }}
            >
              <span className="block font-bold text-brand-ink">{formatPrice(amount)}</span>
              <span className="mt-0.5 block text-xs text-brand-muted">
                {isExact ? "Pago exacto" : `Cambio ${formatPrice(amount - total)}`}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => {
            setCustomOpen(true);
            if (isCustomSelected && value != null) {
              setCustomRaw(String(value));
            }
          }}
          className="rounded-2xl border-2 bg-white px-4 py-3 text-left"
          style={{
            borderColor: customOpen || isCustomSelected ? brand.green : `${brand.muted}40`,
          }}
        >
          <span className="block font-bold text-brand-ink">Otro monto</span>
          <span className="mt-0.5 block text-xs text-brand-muted">
            {isCustomSelected && value != null ? formatPrice(value) : "Escribe cuánto vas a entregar"}
          </span>
        </button>
      </div>
      {customOpen ? (
        <div className="mt-2">
          <input
            type="number"
            min={Math.ceil(total)}
            inputMode="decimal"
            value={customRaw}
            onChange={(event) => {
              const next = event.target.value;
              setCustomRaw(next);
              const parsed = Number(next.replace(",", "."));
              onChange(Number.isFinite(parsed) && coversTotal(parsed, total) ? parsed : null);
            }}
            placeholder={`Mínimo ${formatPrice(total)}`}
            className="w-full rounded-2xl border-2 bg-white px-4 py-3 text-base outline-none"
            style={{
              borderColor: customRaw && !customValid ? brand.error : `${brand.muted}40`,
              minHeight: 48,
            }}
          />
          {customRaw && !customValid ? (
            <p className="mt-1 text-xs" style={{ color: brand.error }}>
              Tiene que ser al menos el total del pedido.
            </p>
          ) : null}
        </div>
      ) : null}
    </fieldset>
  );
}
