"use client";

import { useEffect, useRef, useState } from "react";
import { adminControlClass, cx } from "@/components/admin/AdminField";
import { formatPrice, toMoney } from "@/lib/money";
import { brand } from "@/lib/theme";

export function montoDraft(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "";
  }
  return String(value);
}

export function moneyEqual(left: number, right: number): boolean {
  return Math.round(toMoney(left) * 100) === Math.round(toMoney(right) * 100);
}

export function InlineMonto({
  value,
  ariaLabel,
  onSave,
}: {
  value: number;
  ariaLabel: string;
  onSave: (monto: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(montoDraft(value));
  const [busy, setBusy] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) {
      setDraft(montoDraft(value));
    }
  }, [editing, value]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  async function commit() {
    if (busy) {
      return;
    }
    const next = draft.trim();
    if (!next) {
      setDraft(montoDraft(value));
      setEditing(false);
      setRowError(null);
      return;
    }
    const parsed = toMoney(next.replace(",", "."));
    if (!(parsed > 0)) {
      setRowError("El monto tiene que ser mayor que 0");
      inputRef.current?.focus();
      return;
    }
    if (moneyEqual(parsed, value)) {
      setEditing(false);
      setRowError(null);
      return;
    }
    setBusy(true);
    try {
      await onSave(next);
      setEditing(false);
      setRowError(null);
    } catch (saveError) {
      setRowError(saveError instanceof Error ? saveError.message : "No pudimos guardar");
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(montoDraft(value));
          setRowError(null);
          setEditing(true);
        }}
        className="rounded-lg px-2 py-1.5 font-bold tabular-nums transition-colors hover:bg-black/[0.05]"
        style={{ color: brand.ink }}
        title="Editar monto"
      >
        {formatPrice(value)}
      </button>
    );
  }

  return (
    <span className="inline-flex flex-col items-end">
      <input
        ref={inputRef}
        value={draft}
        inputMode="decimal"
        disabled={busy}
        aria-label={ariaLabel}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void commit();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            setDraft(montoDraft(value));
            setRowError(null);
            setEditing(false);
          }
        }}
        className={cx(
          adminControlClass,
          "h-9 w-32 px-2 text-right font-bold tabular-nums",
          rowError && "border-brand-error focus:border-brand-error focus:ring-brand-error/40"
        )}
        style={{ color: brand.ink }}
      />
      {rowError ? (
        <span className="mt-1 text-[11px] font-semibold" style={{ color: brand.error }}>
          {rowError}
        </span>
      ) : null}
    </span>
  );
}
