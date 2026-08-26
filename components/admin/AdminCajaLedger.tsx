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
import { formatDayKey, yesterdayDayKey } from "@/lib/local-day";
import { brand } from "@/lib/theme";
import { AdminInput, AdminSelect, adminLabelClass } from "@/components/admin/AdminField";
import {
  DataTable,
  DataTableCell,
  DataTableHead,
  DataTableRow,
  DataTableTh,
} from "@/components/admin/DataTable";

export function AdminCajaLedger() {
  const router = useRouter();
  const [movimientos, setMovimientos] = useState<CajaLedgerItem[]>([]);
  const [caja, setCaja] = useState("");
  const [moneda, setMoneda] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<CajaLedgerItem | "new" | null>(null);
  const [deleting, setDeleting] = useState<CajaLedgerItem | null>(null);

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
          <label className={adminLabelClass}>
            Caja
            <AdminSelect value={caja} onChange={(event) => setCaja(event.target.value)}>
              <option value="">Todas</option>
              <option value="Chica">Chica</option>
              <option value="Fuerte">Fuerte</option>
            </AdminSelect>
          </label>
          <label className={adminLabelClass}>
            Moneda
            <AdminSelect value={moneda} onChange={(event) => setMoneda(event.target.value)}>
              <option value="">Todas</option>
              <option value="DOP">DOP</option>
              <option value="USD">USD</option>
            </AdminSelect>
          </label>
        </div>
        <button
          type="button"
          onClick={() => setEditing("new")}
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
        <div className="mt-6 h-48 animate-pulse rounded-lg bg-gray-100" />
      ) : movimientos.length === 0 ? (
        <div className="mt-6 rounded-lg px-5 py-14 text-center" style={{ backgroundColor: "#F8FAF7" }}>
          <p className="font-display text-xl font-bold">No hay movimientos</p>
          <p className="mt-2 text-sm text-brand-muted">Registra una entrada o una salida para verla aquí.</p>
        </div>
      ) : (
        <DataTable className="mt-6" tableClassName="min-w-[880px]">
          <DataTableHead>
            <DataTableTh>Fecha</DataTableTh>
            <DataTableTh>Caja</DataTableTh>
            <DataTableTh>Moneda</DataTableTh>
            <DataTableTh>Tipo</DataTableTh>
            <DataTableTh numeric>Monto</DataTableTh>
            <DataTableTh>Concepto</DataTableTh>
            <DataTableTh>Referencia</DataTableTh>
            <DataTableTh className="w-36">
              <span className="sr-only">Acciones</span>
            </DataTableTh>
          </DataTableHead>
          <tbody>
            {movimientos.map((item) => (
              <DataTableRow key={item.id}>
                <DataTableCell className="whitespace-nowrap font-semibold">{formatDayKey(item.fecha)}</DataTableCell>
                <DataTableCell>{item.caja}</DataTableCell>
                <DataTableCell>{item.moneda}</DataTableCell>
                <DataTableCell>
                  <span
                    className="font-semibold"
                    style={{ color: item.tipo === "Entrada" ? "#059669" : brand.error }}
                  >
                    {item.tipo}
                  </span>
                </DataTableCell>
                <DataTableCell numeric className="font-bold">
                  {formatCajaMoney(item.monto, item.moneda)}
                </DataTableCell>
                <DataTableCell>{item.concepto ?? "—"}</DataTableCell>
                <DataTableCell className="text-brand-muted">{item.referencia ?? "—"}</DataTableCell>
                <DataTableCell>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setEditing(item)}
                      className="text-sm font-bold"
                      style={{ color: brand.green }}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleting(item)}
                      className="text-sm font-bold"
                      style={{ color: brand.error }}
                    >
                      Borrar
                    </button>
                  </div>
                </DataTableCell>
              </DataTableRow>
            ))}
          </tbody>
        </DataTable>
      )}

      {editing ? (
        <MovimientoModal
          movimiento={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      ) : null}

      {deleting ? (
        <ConfirmDeleteMovimiento
          movimiento={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={async () => {
            setDeleting(null);
            await load();
          }}
        />
      ) : null}
    </div>
  );
}

function amountDraft(value: number): string {
  if (!Number.isFinite(value)) {
    return "";
  }
  return String(value);
}

function useModalEscape(onClose: () => void) {
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
}

function MovimientoModal({
  movimiento: existing,
  onClose,
  onSaved,
}: {
  movimiento: CajaLedgerItem | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const isNew = !existing;
  const [fecha, setFecha] = useState(existing?.fecha ?? yesterdayDayKey());
  const [caja, setCaja] = useState<Caja>(existing?.caja ?? "Chica");
  const [moneda, setMoneda] = useState<CajaMoneda>(existing?.moneda ?? "DOP");
  const [tipo, setTipo] = useState<CajaLedgerTipo>(existing?.tipo ?? "Entrada");
  const [monto, setMonto] = useState(existing ? amountDraft(existing.monto) : "");
  const [concepto, setConcepto] = useState(existing?.concepto ?? "");
  const [referencia, setReferencia] = useState(existing?.referencia ?? "");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useModalEscape(onClose);

  async function save() {
    setSaving(true);
    setFormError(null);
    try {
      const response = await fetch(isNew ? "/api/admin/caja/ledger" : `/api/admin/caja/ledger/${existing.id}`, {
        method: isNew ? "POST" : "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fecha, caja, moneda, tipo, monto, concepto, referencia }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(body?.error || (isNew ? "No pudimos registrar el movimiento" : "No pudimos guardar el movimiento"));
      }
      await onSaved();
    } catch (saveError) {
      setFormError(
        saveError instanceof Error
          ? saveError.message
          : isNew
            ? "No pudimos registrar el movimiento"
            : "No pudimos guardar el movimiento",
      );
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
        className="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[28px] bg-white p-6"
        style={{ boxShadow: "0 24px 64px rgba(26, 26, 26, 0.18)", color: brand.ink }}
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Caja</p>
        <h2 id="ledger-title" className="font-display mt-1 text-2xl font-bold">
          {isNew ? "Registrar movimiento" : "Editar movimiento"}
        </h2>
        <p className="mt-1 text-sm text-brand-muted">
          {isNew ? "Solo el monto es obligatorio. El resto ya viene prellenado." : "Cambia lo que haga falta y guarda."}
        </p>

        <label className={`${adminLabelClass} mt-5`}>
          Monto
          <span className="relative mt-1.5 block">
            <span
              className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-semibold"
              style={{ color: brand.orange }}
            >
              {moneda === "USD" ? "US$" : "RD$"}
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

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className={adminLabelClass}>
            Tipo
            <AdminSelect value={tipo} onChange={(event) => setTipo(event.target.value as CajaLedgerTipo)}>
              <option value="Entrada">Entrada</option>
              <option value="Salida">Salida</option>
            </AdminSelect>
          </label>
          <label className={adminLabelClass}>
            Caja
            <AdminSelect
              value={caja}
              onChange={(event) => {
                const next = event.target.value as Caja;
                setCaja(next);
                if (next === "Chica") {
                  setMoneda("DOP");
                }
              }}
            >
              <option value="Chica">Chica</option>
              <option value="Fuerte">Fuerte</option>
            </AdminSelect>
          </label>
          <label className={adminLabelClass}>
            Moneda
            <AdminSelect value={moneda} onChange={(event) => setMoneda(event.target.value as CajaMoneda)}>
              <option value="DOP">DOP</option>
              {caja === "Fuerte" ? <option value="USD">USD</option> : null}
            </AdminSelect>
          </label>
          <label className={adminLabelClass}>
            Fecha
            <AdminInput type="date" value={fecha} onChange={(event) => setFecha(event.target.value)} />
          </label>
        </div>

        <label className={`${adminLabelClass} mt-4`}>
          Concepto
          <AdminInput value={concepto} onChange={(event) => setConcepto(event.target.value)} />
        </label>
        <label className={`${adminLabelClass} mt-4`}>
          Referencia
          <AdminInput value={referencia} onChange={(event) => setReferencia(event.target.value)} />
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
            {saving ? "Guardando..." : isNew ? "Registrar" : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ConfirmDeleteMovimiento({
  movimiento,
  onClose,
  onDeleted,
}: {
  movimiento: CajaLedgerItem;
  onClose: () => void;
  onDeleted: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useModalEscape(onClose);

  async function confirm() {
    setBusy(true);
    setFormError(null);
    try {
      const response = await fetch(`/api/admin/caja/ledger/${movimiento.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(body?.error || "No pudimos borrar el movimiento");
      }
      await onDeleted();
    } catch (deleteError) {
      setFormError(deleteError instanceof Error ? deleteError.message : "No pudimos borrar el movimiento");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Cerrar" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ledger-delete-title"
        className="relative z-10 w-full max-w-md overflow-hidden rounded-[28px] bg-white p-6"
        style={{ boxShadow: "0 24px 64px rgba(26, 26, 26, 0.18)", color: brand.ink }}
      >
        <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Caja</p>
        <h2 id="ledger-delete-title" className="font-display mt-1 text-2xl font-bold">
          Borrar movimiento
        </h2>
        <p className="mt-2 text-sm text-brand-muted">
          Se va a borrar {movimiento.tipo.toLowerCase()} de {formatCajaMoney(movimiento.monto, movimiento.moneda)}
          {movimiento.concepto ? ` · ${movimiento.concepto}` : ""}. Esta acción no se puede deshacer.
        </p>

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
            type="button"
            disabled={busy}
            onClick={() => void confirm()}
            className="rounded-full px-5 text-sm font-bold text-white disabled:opacity-40"
            style={{ minHeight: 44, backgroundColor: brand.error }}
          >
            {busy ? "Borrando..." : "Borrar"}
          </button>
        </div>
      </div>
    </div>
  );
}
