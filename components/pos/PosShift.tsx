"use client";

import { useMemo, useState } from "react";
import { formatPrice, parsePrice } from "@/lib/money";
import {
  POS_FONDO_RAPIDO,
  metodoPagoLabel,
  shiftCashExpected,
  shiftDifference,
  shiftDifferenceLabel,
  shiftTotals,
  type PosSaleDraft,
} from "@/lib/pos";
import { brand } from "@/lib/theme";

export function PosOpenShift({
  busy,
  onOpen,
}: {
  busy: boolean;
  onOpen: (abiertoPor: string, fondoInicial: number) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [fondoRaw, setFondoRaw] = useState("0");
  const fondo = parsePrice(fondoRaw);
  const canOpen = !busy && nombre.trim().length > 0 && fondo != null;

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4 py-6">
      <form
        className="w-full max-w-lg rounded-3xl bg-white px-5 py-6 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          if (canOpen && fondo != null) onOpen(nombre, fondo);
        }}
      >
        <h1 className="font-display text-3xl font-extrabold">Abrir turno</h1>
        <p className="mt-2 text-sm font-semibold text-brand-muted">
          La caja no cobra hasta que alguien del personal abra su turno.
        </p>
        <label className="mt-5 block text-sm font-bold text-brand-muted" htmlFor="pos-cajero">
          Quién abre
        </label>
        <input
          id="pos-cajero"
          value={nombre}
          onChange={(event) => setNombre(event.target.value)}
          placeholder="Nombre"
          autoComplete="name"
          className="mt-2 h-14 w-full rounded-2xl border px-4 text-lg font-semibold outline-none"
          style={{ borderColor: "#D1D5DB" }}
        />
        <p className="mt-5 text-sm font-bold text-brand-muted">Fondo inicial</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {POS_FONDO_RAPIDO.map((amount) => {
            const selected = fondo != null && fondo === amount;
            return (
              <button
                key={amount}
                type="button"
                onClick={() => setFondoRaw(String(amount))}
                className="h-12 rounded-2xl border text-sm font-extrabold"
                style={{
                  backgroundColor: selected ? brand.green : "#FFFFFF",
                  color: selected ? "#FFFFFF" : brand.ink,
                  borderColor: selected ? brand.green : "#D1D5DB",
                }}
              >
                {amount === 0 ? "RD$0" : formatPrice(amount)}
              </button>
            );
          })}
        </div>
        <label className="mt-3 block text-sm font-bold text-brand-muted" htmlFor="pos-fondo">
          Otro monto
        </label>
        <input
          id="pos-fondo"
          inputMode="decimal"
          value={fondoRaw}
          onChange={(event) => setFondoRaw(event.target.value)}
          className="mt-2 h-14 w-full rounded-2xl border px-4 text-2xl font-extrabold tabular-nums outline-none"
          style={{ borderColor: "#D1D5DB" }}
        />
        <button
          type="submit"
          disabled={!canOpen}
          className="mt-6 flex h-14 w-full items-center justify-center rounded-2xl text-lg font-extrabold text-white disabled:opacity-40"
          style={{ backgroundColor: brand.green }}
        >
          {busy ? "Abriendo…" : "Abrir turno"}
        </button>
      </form>
    </div>
  );
}

export function PosCloseShift({
  abiertoPor,
  fondoInicial,
  sales,
  busy,
  onClose,
  onConfirm,
}: {
  abiertoPor: string;
  fondoInicial: number;
  sales: PosSaleDraft[];
  busy: boolean;
  onClose: () => void;
  onConfirm: (efectivoContado: number, notas: string) => void;
}) {
  const totals = useMemo(() => shiftTotals(sales), [sales]);
  const esperado = shiftCashExpected(fondoInicial, totals.efectivo);
  const [contadoRaw, setContadoRaw] = useState("");
  const [notas, setNotas] = useState("");
  const contado = parsePrice(contadoRaw);
  const diferencia = contado == null ? null : shiftDifference(contado, esperado);
  const label = diferencia == null ? null : shiftDifferenceLabel(diferencia);
  const toneColor = label?.tone === "ok" ? brand.green : label?.tone === "short" ? brand.error : "#B45309";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-6">
      <form
        className="flex max-h-[94dvh] w-full flex-col rounded-t-3xl bg-white shadow-2xl sm:max-w-lg sm:rounded-3xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-cierre-title"
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy && contado != null) onConfirm(contado, notas);
        }}
      >
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4" style={{ borderColor: "#E5E7EB" }}>
          <div>
            <p id="pos-cierre-title" className="font-display text-2xl font-extrabold">
              Cerrar turno
            </p>
            <p className="text-sm font-semibold text-brand-muted">{abiertoPor}</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-11 items-center px-2 text-sm font-bold">
            Volver
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <ul className="space-y-2 text-base font-semibold">
            <li className="flex justify-between gap-3">
              <span>{metodoPagoLabel("efectivo")}</span>
              <span className="tabular-nums">{formatPrice(totals.efectivo)}</span>
            </li>
            <li className="flex justify-between gap-3">
              <span>{metodoPagoLabel("tarjeta")}</span>
              <span className="tabular-nums">{formatPrice(totals.tarjeta)}</span>
            </li>
            <li className="flex justify-between gap-3">
              <span>{metodoPagoLabel("transferencia")}</span>
              <span className="tabular-nums">{formatPrice(totals.transferencia)}</span>
            </li>
            <li className="flex justify-between gap-3 text-brand-muted">
              <span>Ventas</span>
              <span className="tabular-nums">{totals.ventas}</span>
            </li>
            <li className="flex justify-between gap-3 border-t pt-2" style={{ borderColor: "#E5E7EB" }}>
              <span>Fondo inicial</span>
              <span className="tabular-nums">{formatPrice(fondoInicial)}</span>
            </li>
            <li className="flex justify-between gap-3 text-lg font-extrabold">
              <span>Esperado en caja</span>
              <span className="tabular-nums">{formatPrice(esperado)}</span>
            </li>
          </ul>
          <div className="mt-4 flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <label className="text-sm font-bold text-brand-muted" htmlFor="pos-contado">
                Efectivo contado
              </label>
              <input
                id="pos-contado"
                inputMode="decimal"
                value={contadoRaw}
                onChange={(event) => setContadoRaw(event.target.value)}
                className="mt-2 h-14 w-full rounded-2xl border px-4 text-2xl font-extrabold tabular-nums outline-none"
                style={{ borderColor: "#D1D5DB" }}
              />
            </div>
            <button
              type="button"
              onClick={() => setContadoRaw(Number.isInteger(esperado) ? String(esperado) : esperado.toFixed(2))}
              className="h-14 shrink-0 rounded-2xl border px-4 text-sm font-extrabold"
              style={{ borderColor: brand.green, color: "#3F6212" }}
            >
              Cuadra
            </button>
          </div>
          {label ? (
            <p className="mt-3 text-center text-3xl font-extrabold tabular-nums" style={{ color: toneColor }}>
              {label.text}
            </p>
          ) : null}
          <label className="mt-4 block text-sm font-bold text-brand-muted" htmlFor="pos-notas">
            Notas
          </label>
          <textarea
            id="pos-notas"
            value={notas}
            onChange={(event) => setNotas(event.target.value)}
            rows={2}
            className="mt-2 w-full rounded-2xl border px-4 py-3 text-base font-medium outline-none"
            style={{ borderColor: "#D1D5DB" }}
          />
        </div>
        <div className="border-t px-5 py-4" style={{ borderColor: "#E5E7EB" }}>
          <button
            type="submit"
            disabled={busy || contado == null}
            className="flex h-14 w-full items-center justify-center rounded-2xl text-lg font-extrabold text-white disabled:opacity-40"
            style={{ backgroundColor: brand.navy }}
          >
            {busy ? "Cerrando…" : "Confirmar cierre"}
          </button>
        </div>
      </form>
    </div>
  );
}
