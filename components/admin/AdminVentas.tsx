"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  VENTAS_DEFAULT_LIMIT,
  formatDiaSemana,
  type VentaDiaria,
} from "@/lib/admin-ventas-shared";
import { formatDayKey, todayDayKey } from "@/lib/local-day";
import { formatPrice, toMoney } from "@/lib/money";
import { brand } from "@/lib/theme";

const fieldClass =
  "mt-1.5 h-11 w-full rounded-xl border bg-white px-3 text-sm font-medium outline-none focus:border-[#7EB341]";
const labelClass = "block text-[13px] font-medium text-brand-muted";

function montoDraft(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "";
  }
  return String(value);
}

function moneyEqual(left: number, right: number): boolean {
  return Math.round(toMoney(left) * 100) === Math.round(toMoney(right) * 100);
}

export function AdminVentas() {
  const router = useRouter();
  const today = todayDayKey();
  const [fecha, setFecha] = useState(today);
  const [monto, setMonto] = useState("");
  const [ventas, setVentas] = useState<VentaDiaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fechaRef = useRef(fecha);
  fechaRef.current = fecha;

  const load = useCallback(async (): Promise<VentaDiaria[]> => {
    const response = await fetch(`/api/admin/ventas?limit=${VENTAS_DEFAULT_LIMIT}`, { credentials: "include" });
    if (response.status === 401) {
      router.replace("/admin/login");
      return [];
    }
    const body = (await response.json().catch(() => null)) as { ventas?: VentaDiaria[]; error?: string } | null;
    if (!response.ok) {
      throw new Error(body?.error || "No pudimos cargar las ventas");
    }
    const list = body?.ventas ?? [];
    setVentas(list);
    return list;
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const list = await load();
        if (cancelled) {
          return;
        }
        const match = list.find((venta) => venta.fecha === fechaRef.current);
        if (match) {
          setMonto(montoDraft(match.monto));
        }
        setError(null);
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

  const captured = ventas.find((venta) => venta.fecha === fecha) ?? null;

  function changeFecha(next: string) {
    setFecha(next);
    setSaved(false);
    const match = ventas.find((venta) => venta.fecha === next);
    setMonto(match ? montoDraft(match.monto) : "");
  }

  async function saveVenta(nextFecha: string, nextMonto: string): Promise<VentaDiaria> {
    const response = await fetch("/api/admin/ventas", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fecha: nextFecha, monto: nextMonto }),
    });
    if (response.status === 401) {
      router.replace("/admin/login");
      throw new Error("No autorizado");
    }
    const body = (await response.json().catch(() => null)) as { venta?: VentaDiaria; error?: string } | null;
    if (!response.ok || !body?.venta) {
      throw new Error(body?.error || "No pudimos guardar la venta");
    }
    setVentas((current) => {
      const next = current.filter((venta) => venta.fecha !== body.venta?.fecha);
      next.push(body.venta);
      next.sort((left, right) => right.fecha.localeCompare(left.fecha));
      return next.slice(0, VENTAS_DEFAULT_LIMIT);
    });
    return body.venta;
  }

  async function saveForm() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const venta = await saveVenta(fecha, monto);
      setMonto(montoDraft(venta.monto));
      setSaved(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No pudimos guardar la venta");
    } finally {
      setSaving(false);
    }
  }

  async function saveInline(nextFecha: string, nextMonto: string) {
    setError(null);
    setSaved(false);
    const venta = await saveVenta(nextFecha, nextMonto);
    if (venta.fecha === fecha) {
      setMonto(montoDraft(venta.monto));
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Ventas</p>
        <h1 className="font-display mt-1 text-2xl font-bold">Ventas diarias</h1>
      </div>

      <section className="mt-5 rounded-[24px] border bg-white p-5" style={{ borderColor: "#E5E7EB" }}>
        <h2 className="font-display text-lg font-bold">Registrar venta del día</h2>
        <p className="mt-1 text-sm text-brand-muted">
          {captured
            ? "Este día ya está capturado. Guardar actualiza el monto."
            : "Si la fecha ya existe, se actualiza el monto en vez de crear un duplicado."}
        </p>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-[180px_1fr_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            void saveForm();
          }}
        >
          <label className={labelClass}>
            Fecha
            <input
              type="date"
              required
              value={fecha}
              max={today}
              onChange={(event) => changeFecha(event.target.value)}
              className={fieldClass}
              style={{ borderColor: "#E5E7EB", color: brand.ink }}
            />
          </label>
          <label className={labelClass}>
            Monto
            <span className="relative mt-1.5 block">
              <span
                className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-semibold"
                style={{ color: brand.orange }}
              >
                RD$
              </span>
              <input
                required
                value={monto}
                inputMode="decimal"
                onChange={(event) => {
                  setMonto(event.target.value);
                  setSaved(false);
                }}
                className="h-11 w-full rounded-xl border bg-white pl-12 pr-3 text-sm font-semibold tabular-nums outline-none focus:border-[#7EB341]"
                style={{ borderColor: "#E5E7EB", color: brand.ink }}
              />
            </span>
          </label>
          <button
            type="submit"
            disabled={saving || !monto.trim()}
            className="rounded-full px-5 text-sm font-bold text-white disabled:opacity-40"
            style={{ minHeight: 44, backgroundColor: brand.green }}
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </form>
        {saved ? (
          <p className="mt-3 text-sm font-semibold" style={{ color: brand.green }}>
            Venta guardada
          </p>
        ) : null}
      </section>

      {error ? (
        <p className="mt-4 rounded-2xl px-4 py-3 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>
          {error}
        </p>
      ) : null}

      <section className="mt-6">
        <h2 className="font-display text-lg font-bold">Últimos {VENTAS_DEFAULT_LIMIT} días capturados</h2>
        <p className="mt-1 text-sm text-brand-muted">Haz clic en el monto para corregirlo. Enter o clic afuera guarda.</p>
        {loading ? (
          <div className="mt-4 h-48 animate-pulse rounded-[24px] bg-gray-100" />
        ) : ventas.length === 0 ? (
          <div className="mt-4 rounded-[28px] px-5 py-14 text-center" style={{ backgroundColor: "#F8FAF7" }}>
            <p className="font-display text-xl font-bold">Aún no hay ventas capturadas</p>
            <p className="mt-2 text-sm text-brand-muted">Registra la venta del día para verla aquí.</p>
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-[24px] border" style={{ borderColor: "#E5E7EB" }}>
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="text-xs font-bold uppercase tracking-wide text-brand-muted" style={{ backgroundColor: "#F8FAF7" }}>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Día</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">Monto</th>
                </tr>
              </thead>
              <tbody>
                {ventas.map((venta, index) => (
                  <tr key={venta.id} style={{ backgroundColor: index % 2 === 1 ? "#FAFBFA" : "#FFFFFF" }}>
                    <td className="whitespace-nowrap px-4 py-3 font-semibold">
                      {formatDayKey(venta.fecha)}
                      {venta.fecha === today ? (
                        <span className="ml-2 text-xs font-bold uppercase tracking-wide" style={{ color: brand.green }}>
                          Hoy
                        </span>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-brand-muted">{formatDiaSemana(venta.diaSemana)}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-right">
                      <InlineMonto venta={venta} onSave={saveInline} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function InlineMonto({
  venta,
  onSave,
}: {
  venta: VentaDiaria;
  onSave: (fecha: string, monto: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(montoDraft(venta.monto));
  const [busy, setBusy] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) {
      setDraft(montoDraft(venta.monto));
    }
  }, [editing, venta.monto]);

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
      setDraft(montoDraft(venta.monto));
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
    if (moneyEqual(parsed, venta.monto)) {
      setEditing(false);
      setRowError(null);
      return;
    }
    setBusy(true);
    try {
      await onSave(venta.fecha, next);
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
          setDraft(montoDraft(venta.monto));
          setRowError(null);
          setEditing(true);
        }}
        className="rounded-lg px-2 py-1.5 font-bold tabular-nums transition-colors hover:bg-black/[0.05]"
        style={{ color: brand.ink }}
        title="Editar monto"
      >
        {formatPrice(venta.monto)}
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
        aria-label={`Monto del ${venta.fecha}`}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void commit();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            setDraft(montoDraft(venta.monto));
            setRowError(null);
            setEditing(false);
          }
        }}
        className="h-9 w-32 rounded-lg border bg-white px-2 text-right text-sm font-bold tabular-nums outline-none focus:border-[#7EB341]"
        style={{ borderColor: rowError ? brand.error : "#E5E7EB", color: brand.ink }}
      />
      {rowError ? (
        <span className="mt-1 text-[11px] font-semibold" style={{ color: brand.error }}>
          {rowError}
        </span>
      ) : null}
    </span>
  );
}
