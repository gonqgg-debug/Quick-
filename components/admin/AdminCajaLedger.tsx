"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  formatCajaMoney,
  type Caja,
  type CajaLedgerItem,
  type CajaLedgerTipo,
  type CajaMoneda,
} from "@/lib/admin-caja-shared";
import { formatDayKey, todayDayKey } from "@/lib/local-day";
import { brand } from "@/lib/theme";

const fieldClass =
  "mt-1.5 h-11 w-full rounded-xl border bg-white px-3 text-sm font-medium outline-none focus:border-[#7EB341]";
const labelClass = "block text-[13px] font-medium text-brand-muted";

export function AdminCajaLedger() {
  const router = useRouter();
  const [movimientos, setMovimientos] = useState<CajaLedgerItem[]>([]);
  const [caja, setCaja] = useState("");
  const [moneda, setMoneda] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (caja) {
      params.set("caja", caja);
    }
    if (moneda) {
      params.set("moneda", moneda);
    }
    const qs = params.toString();
    const response = await fetch(`/api/admin/caja/ledger${qs ? `?${qs}` : ""}`, {
      credentials: "include",
    });
    if (response.status === 401) {
      router.replace("/admin/login");
      return;
    }
    const body = (await response.json().catch(() => null)) as { movimientos?: CajaLedgerItem[]; error?: string } | null;
    if (!response.ok) {
      throw new Error(body?.error || "No pudimos cargar el ledger");
    }
    setMovimientos(body?.movimientos ?? []);
  }, [caja, moneda, router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await load();
        if (!cancelled) {
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Error al cargar");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  return (
    <div>
      <div
        className="rounded-xl border px-4 py-3 text-sm"
        style={{ borderColor: "#E5E7EB", backgroundColor: "#F8FAF7", color: brand.ink }}
      >
        Para transferir entre cajas, registra dos movimientos: Salida en la caja de origen y Entrada en la caja de
        destino.
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div className="grid w-full gap-3 sm:max-w-md sm:grid-cols-2">
          <label className={labelClass}>
            Caja
            <select
              value={caja}
              onChange={(event) => setCaja(event.target.value)}
              className={fieldClass}
              style={{ borderColor: "#E5E7EB", color: brand.ink }}
            >
              <option value="">Todas</option>
              <option value="Chica">Chica</option>
              <option value="Fuerte">Fuerte</option>
            </select>
          </label>
          <label className={labelClass}>
            Moneda
            <select
              value={moneda}
              onChange={(event) => setMoneda(event.target.value)}
              className={fieldClass}
              style={{ borderColor: "#E5E7EB", color: brand.ink }}
            >
              <option value="">Todas</option>
              <option value="DOP">DOP</option>
              <option value="USD">USD</option>
            </select>
          </label>
        </div>
        <button
          type="button"
          onClick={() => setRegisterOpen(true)}
          className="rounded-full px-4 text-sm font-bold text-white"
          style={{ minHeight: 44, backgroundColor: brand.green }}
        >
          Registrar movimiento
        </button>
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl px-4 py-3 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="mt-6 h-48 animate-pulse rounded-[24px] bg-gray-100" />
      ) : movimientos.length === 0 ? (
        <div className="mt-6 rounded-[28px] px-5 py-14 text-center" style={{ backgroundColor: "#F8FAF7" }}>
          <p className="font-display text-xl font-bold">No hay movimientos</p>
          <p className="mt-2 text-sm text-brand-muted">Registra una entrada o una salida para verla aquí.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-[24px] border" style={{ borderColor: "#E5E7EB" }}>
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="text-xs font-bold uppercase tracking-wide text-brand-muted" style={{ backgroundColor: "#F8FAF7" }}>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Caja</th>
                <th className="px-4 py-3">Moneda</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">Monto</th>
                <th className="px-4 py-3">Concepto</th>
                <th className="px-4 py-3">Referencia</th>
              </tr>
            </thead>
            <tbody>
              {movimientos.map((item, index) => (
                <tr key={item.id} style={{ backgroundColor: index % 2 === 1 ? "#FAFBFA" : "#FFFFFF" }}>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold">{formatDayKey(item.fecha)}</td>
                  <td className="px-4 py-3">{item.caja}</td>
                  <td className="px-4 py-3">{item.moneda}</td>
                  <td className="px-4 py-3">
                    <span
                      className="font-semibold"
                      style={{ color: item.tipo === "Entrada" ? "#059669" : brand.error }}
                    >
                      {item.tipo}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums">
                    {formatCajaMoney(item.monto, item.moneda)}
                  </td>
                  <td className="px-4 py-3">{item.concepto ?? "—"}</td>
                  <td className="px-4 py-3 text-brand-muted">{item.referencia ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {registerOpen ? (
        <RegistrarMovimientoModal
          onClose={() => setRegisterOpen(false)}
          onSaved={async () => {
            setRegisterOpen(false);
            await load();
          }}
        />
      ) : null}
    </div>
  );
}

function RegistrarMovimientoModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [fecha, setFecha] = useState(todayDayKey());
  const [caja, setCaja] = useState<Caja>("Chica");
  const [moneda, setMoneda] = useState<CajaMoneda>("DOP");
  const [tipo, setTipo] = useState<CajaLedgerTipo>("Entrada");
  const [monto, setMonto] = useState("");
  const [concepto, setConcepto] = useState("");
  const [referencia, setReferencia] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setFormError(null);
    try {
      const response = await fetch("/api/admin/caja/ledger", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fecha, caja, moneda, tipo, monto, concepto, referencia }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(body?.error || "No pudimos registrar el movimiento");
      }
      await onSaved();
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : "No pudimos registrar el movimiento");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Cerrar" onClick={onClose} />
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="ledger-title"
        className="relative z-10 w-full max-w-md overflow-hidden rounded-[28px] bg-white p-6"
        style={{ boxShadow: "0 24px 64px rgba(26, 26, 26, 0.18)", color: brand.ink }}
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Caja</p>
        <h2 id="ledger-title" className="font-display mt-1 text-2xl font-bold">
          Registrar movimiento
        </h2>
        <p className="mt-1 text-sm text-brand-muted">Solo el monto es obligatorio. El resto ya viene prellenado.</p>

        <label className={`${labelClass} mt-5`}>
          Monto
          <span className="relative mt-1.5 block">
            <span
              className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-semibold"
              style={{ color: brand.orange }}
            >
              {moneda === "USD" ? "US$" : "RD$"}
            </span>
            <input
              required
              value={monto}
              inputMode="decimal"
              onChange={(event) => setMonto(event.target.value)}
              className="h-11 w-full rounded-xl border bg-white pl-12 pr-3 text-sm font-semibold tabular-nums outline-none focus:border-[#7EB341]"
              style={{ borderColor: "#E5E7EB", color: brand.ink }}
            />
          </span>
        </label>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            Tipo
            <select
              value={tipo}
              onChange={(event) => setTipo(event.target.value as CajaLedgerTipo)}
              className={fieldClass}
              style={{ borderColor: "#E5E7EB", color: brand.ink }}
            >
              <option value="Entrada">Entrada</option>
              <option value="Salida">Salida</option>
            </select>
          </label>
          <label className={labelClass}>
            Caja
            <select
              value={caja}
              onChange={(event) => {
                const next = event.target.value as Caja;
                setCaja(next);
                if (next === "Chica") {
                  setMoneda("DOP");
                }
              }}
              className={fieldClass}
              style={{ borderColor: "#E5E7EB", color: brand.ink }}
            >
              <option value="Chica">Chica</option>
              <option value="Fuerte">Fuerte</option>
            </select>
          </label>
          <label className={labelClass}>
            Moneda
            <select
              value={moneda}
              onChange={(event) => setMoneda(event.target.value as CajaMoneda)}
              className={fieldClass}
              style={{ borderColor: "#E5E7EB", color: brand.ink }}
            >
              <option value="DOP">DOP</option>
              {caja === "Fuerte" ? <option value="USD">USD</option> : null}
            </select>
          </label>
          <label className={labelClass}>
            Fecha
            <input
              type="date"
              value={fecha}
              onChange={(event) => setFecha(event.target.value)}
              className={fieldClass}
              style={{ borderColor: "#E5E7EB", color: brand.ink }}
            />
          </label>
        </div>

        <label className={`${labelClass} mt-4`}>
          Concepto
          <input
            value={concepto}
            onChange={(event) => setConcepto(event.target.value)}
            className={fieldClass}
            style={{ borderColor: "#E5E7EB", color: brand.ink }}
          />
        </label>
        <label className={`${labelClass} mt-4`}>
          Referencia
          <input
            value={referencia}
            onChange={(event) => setReferencia(event.target.value)}
            className={fieldClass}
            style={{ borderColor: "#E5E7EB", color: brand.ink }}
          />
        </label>

        {formError ? (
          <p className="mt-4 rounded-2xl px-3 py-2 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>
            {formError}
          </p>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 text-sm font-bold"
            style={{ minHeight: 44, border: "1px solid #E5E7EB", color: brand.ink }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || !monto.trim()}
            className="rounded-full px-5 text-sm font-bold text-white disabled:opacity-40"
            style={{ minHeight: 44, backgroundColor: brand.green }}
          >
            {saving ? "Guardando..." : "Registrar"}
          </button>
        </div>
      </form>
    </div>
  );
}
