"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  VENTAS_DEFAULT_LIMIT,
  formatDiaSemana,
  type VentaDiaria,
} from "@/lib/admin-ventas-shared";
import { formatDayKey, todayDayKey, yesterdayDayKey } from "@/lib/local-day";
import { brand } from "@/lib/theme";
import { AdminInput, adminLabelClass } from "@/components/admin/AdminField";
import {
  DataTable,
  DataTableCell,
  DataTableHead,
  DataTableRow,
  DataTableTh,
} from "@/components/admin/DataTable";
import { InlineMonto, montoDraft } from "@/components/admin/InlineMonto";

export function AdminVentas() {
  const router = useRouter();
  const today = todayDayKey();
  const yesterday = yesterdayDayKey();
  const [fecha, setFecha] = useState(yesterday);
  const [monto, setMonto] = useState("");
  const [ventas, setVentas] = useState<VentaDiaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState<VentaDiaria | null>(null);
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
    const venta = body?.venta;
    if (!response.ok || !venta) {
      throw new Error(body?.error || "No pudimos guardar la venta");
    }
    applyVenta(venta);
    return venta;
  }

  function applyVenta(venta: VentaDiaria, previousId?: string) {
    setVentas((current) => {
      const next = current.filter((item) => item.id !== venta.id && item.id !== previousId && item.fecha !== venta.fecha);
      next.push(venta);
      next.sort((left, right) => right.fecha.localeCompare(left.fecha));
      return next.slice(0, VENTAS_DEFAULT_LIMIT);
    });
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

      <section className="mt-5 rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
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
          <label className={adminLabelClass}>
            Fecha
            <AdminInput
              type="date"
              required
              value={fecha}
              max={yesterday}
              onChange={(event) => changeFecha(event.target.value)}
            />
          </label>
          <label className={adminLabelClass}>
            Monto
            <span className="relative mt-1.5 block">
              <span
                className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-semibold"
                style={{ color: brand.orange }}
              >
                RD$
              </span>
              <AdminInput
                bare
                required
                value={monto}
                inputMode="decimal"
                onChange={(event) => {
                  setMonto(event.target.value);
                  setSaved(false);
                }}
                className="!pl-12 font-semibold tabular-nums"
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
        <p className="mt-1 text-sm text-brand-muted">
          Haz clic en el monto para corregirlo, o en Editar para cambiar fecha y monto. Enter o clic afuera guarda.
        </p>
        {loading ? (
          <div className="mt-4 h-48 animate-pulse rounded-lg bg-gray-100" />
        ) : ventas.length === 0 ? (
          <div className="mt-4 rounded-lg px-5 py-14 text-center" style={{ backgroundColor: "#F8FAF7" }}>
            <p className="font-display text-xl font-bold">Aún no hay ventas capturadas</p>
            <p className="mt-2 text-sm text-brand-muted">Registra la venta del día para verla aquí.</p>
          </div>
        ) : (
          <DataTable className="mt-4" tableClassName="min-w-[520px]">
            <DataTableHead>
              <DataTableTh>Fecha</DataTableTh>
              <DataTableTh>Día</DataTableTh>
              <DataTableTh numeric>Monto</DataTableTh>
              <DataTableTh className="w-24">
                <span className="sr-only">Editar</span>
              </DataTableTh>
            </DataTableHead>
            <tbody>
              {ventas.map((venta) => (
                <DataTableRow key={venta.id}>
                  <DataTableCell className="whitespace-nowrap font-semibold">
                    {formatDayKey(venta.fecha)}
                    {venta.fecha === today ? (
                      <span className="ml-2 text-xs font-bold uppercase tracking-wide" style={{ color: brand.green }}>
                        Hoy
                      </span>
                    ) : null}
                  </DataTableCell>
                  <DataTableCell className="whitespace-nowrap text-brand-muted">{formatDiaSemana(venta.diaSemana)}</DataTableCell>
                  <DataTableCell numeric className="py-2">
                    <InlineMonto
                      value={venta.monto}
                      ariaLabel={`Monto del ${venta.fecha}`}
                      onSave={(nextMonto) => saveInline(venta.fecha, nextMonto)}
                    />
                  </DataTableCell>
                  <DataTableCell>
                    <button
                      type="button"
                      onClick={() => setEditing(venta)}
                      className="text-sm font-bold"
                      style={{ color: brand.green }}
                    >
                      Editar
                    </button>
                  </DataTableCell>
                </DataTableRow>
              ))}
            </tbody>
          </DataTable>
        )}
      </section>

      {editing ? (
        <VentaModal
          venta={editing}
          onClose={() => setEditing(null)}
          onSaved={(venta) => {
            applyVenta(venta, editing.id);
            if (venta.fecha === fecha) {
              setMonto(montoDraft(venta.monto));
            } else if (editing.fecha === fecha) {
              setMonto("");
            }
            setEditing(null);
            setSaved(true);
            setError(null);
          }}
        />
      ) : null}
    </div>
  );
}

function VentaModal({
  venta,
  onClose,
  onSaved,
}: {
  venta: VentaDiaria;
  onClose: () => void;
  onSaved: (venta: VentaDiaria) => void;
}) {
  const yesterday = yesterdayDayKey();
  const [fecha, setFecha] = useState(venta.fecha);
  const [monto, setMonto] = useState(montoDraft(venta.monto));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  async function save() {
    setSaving(true);
    setFormError(null);
    try {
      const response = await fetch(`/api/admin/ventas/${venta.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fecha, monto }),
      });
      const body = (await response.json().catch(() => null)) as { venta?: VentaDiaria; error?: string } | null;
      if (!response.ok || !body?.venta) {
        throw new Error(body?.error || "No pudimos guardar la venta");
      }
      onSaved(body.venta);
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : "No pudimos guardar la venta");
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
        aria-labelledby="venta-title"
        className="relative z-10 w-full max-w-md overflow-hidden rounded-[28px] bg-white p-6"
        style={{ boxShadow: "0 24px 64px rgba(26, 26, 26, 0.18)", color: brand.ink }}
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Ventas</p>
        <h2 id="venta-title" className="font-display mt-1 text-2xl font-bold">
          Editar venta
        </h2>
        <p className="mt-1 text-sm text-brand-muted">Puedes corregir la fecha y el monto de este día.</p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className={adminLabelClass}>
            Fecha
            <AdminInput
              type="date"
              required
              value={fecha}
              max={yesterday}
              onChange={(event) => setFecha(event.target.value)}
            />
          </label>
          <label className={adminLabelClass}>
            Monto
            <span className="relative mt-1.5 block">
              <span
                className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-semibold"
                style={{ color: brand.orange }}
              >
                RD$
              </span>
              <AdminInput
                bare
                required
                value={monto}
                inputMode="decimal"
                onChange={(event) => setMonto(event.target.value)}
                className="!pl-12 font-semibold tabular-nums"
              />
            </span>
          </label>
        </div>

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
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}
