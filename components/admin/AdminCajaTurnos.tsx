"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatSignedPrice } from "@/lib/admin-dashboard-shared";
import {
  defaultTurnoPeriodo,
  formatUsd,
  isNearZero,
  type CajaTurnoListItem,
  type CajaTurnoPeriodo,
} from "@/lib/admin-caja-shared";
import { formatDayKey, todayDayKey } from "@/lib/local-day";
import { formatPrice } from "@/lib/money";
import { brand } from "@/lib/theme";
import { AdminInput, AdminSelect, AdminTextarea, adminLabelClass } from "@/components/admin/AdminField";
import {
  DataTable,
  DataTableCell,
  DataTableHead,
  DataTableRow,
  DataTableTh,
} from "@/components/admin/DataTable";

const MUTED = "#6B7280";
const RED = "#DC2626";

export function AdminCajaTurnos() {
  const router = useRouter();
  const [turnos, setTurnos] = useState<CajaTurnoListItem[]>([]);
  const [fecha, setFecha] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (fecha) {
      params.set("fecha", fecha);
    }
    const qs = params.toString();
    const response = await fetch(`/api/admin/caja/turnos${qs ? `?${qs}` : ""}`, {
      credentials: "include",
    });
    if (response.status === 401) {
      router.replace("/admin/login");
      return;
    }
    const body = (await response.json().catch(() => null)) as { turnos?: CajaTurnoListItem[]; error?: string } | null;
    if (!response.ok) {
      throw new Error(body?.error || "No pudimos cargar los turnos");
    }
    setTurnos(body?.turnos ?? []);
  }, [fecha, router]);

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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className={adminLabelClass}>
          Fecha
          <AdminInput
            type="date"
            value={fecha}
            onChange={(event) => setFecha(event.target.value)}
            className="min-w-[180px]"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {fecha ? (
            <button
              type="button"
              onClick={() => setFecha("")}
              className="rounded-full px-4 text-sm font-bold"
              style={{ minHeight: 44, border: "1px solid #E5E7EB", color: brand.ink }}
            >
              Todas
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setRegisterOpen(true)}
            className="rounded-full px-4 text-sm font-bold text-white"
            style={{ minHeight: 44, backgroundColor: brand.green }}
          >
            Registrar cierre de turno
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl px-4 py-3 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="mt-6 h-48 animate-pulse rounded-lg bg-gray-100" />
      ) : turnos.length === 0 ? (
        <div className="mt-6 rounded-lg px-5 py-14 text-center" style={{ backgroundColor: "#F8FAF7" }}>
          <p className="font-display text-xl font-bold">No hay turnos</p>
          <p className="mt-2 text-sm text-brand-muted">Registra el cierre para verlo aquí.</p>
        </div>
      ) : (
        <DataTable className="mt-6" tableClassName="min-w-[1100px]">
          <DataTableHead>
            <DataTableTh>Fecha</DataTableTh>
            <DataTableTh>Turno</DataTableTh>
            <DataTableTh numeric>Sist. tarjeta</DataTableTh>
            <DataTableTh numeric>Sist. efectivo</DataTableTh>
            <DataTableTh numeric>Rep. tarjeta</DataTableTh>
            <DataTableTh numeric>Rep. efectivo</DataTableTh>
            <DataTableTh numeric>Rep. USD</DataTableTh>
            <DataTableTh numeric>Var. total</DataTableTh>
            <DataTableTh numeric>Var. tarjeta</DataTableTh>
            <DataTableTh numeric>Var. efectivo</DataTableTh>
            <DataTableTh>Verificado</DataTableTh>
            <DataTableTh>Notas</DataTableTh>
          </DataTableHead>
          <tbody>
            {turnos.map((turno) => (
              <DataTableRow key={turno.id}>
                <DataTableCell className="whitespace-nowrap font-semibold">{formatDayKey(turno.fecha)}</DataTableCell>
                <DataTableCell className="font-semibold">{turno.turno}</DataTableCell>
                <DataTableCell numeric>{formatPrice(turno.sistemaTarjeta)}</DataTableCell>
                <DataTableCell numeric>{formatPrice(turno.sistemaEfectivo)}</DataTableCell>
                <DataTableCell numeric>{formatPrice(turno.reportadoTarjeta)}</DataTableCell>
                <DataTableCell numeric>{formatPrice(turno.reportadoEfectivo)}</DataTableCell>
                <DataTableCell numeric>{formatUsd(turno.reportadoUsd)}</DataTableCell>
                <VarianceCell value={turno.varTotal} />
                <VarianceCell value={turno.varTarjeta} />
                <VarianceCell value={turno.varEfectivo} />
                <DataTableCell>
                  <span
                    className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold"
                    style={{
                      backgroundColor: turno.verificado ? `${brand.green}22` : "#F3F4F6",
                      color: turno.verificado ? brand.green : MUTED,
                    }}
                  >
                    {turno.verificado ? "Verificado" : "Pendiente"}
                  </span>
                </DataTableCell>
                <DataTableCell className="max-w-[180px] truncate text-brand-muted">{turno.notas ?? "—"}</DataTableCell>
              </DataTableRow>
            ))}
          </tbody>
        </DataTable>
      )}

      {registerOpen ? (
        <RegistrarTurnoModal
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

function VarianceCell({ value }: { value: number }) {
  const zero = isNearZero(value);
  return (
    <DataTableCell numeric className="font-semibold" style={{ color: zero ? MUTED : RED }}>
      {zero ? formatPrice(0) : formatSignedPrice(value)}
    </DataTableCell>
  );
}

function RegistrarTurnoModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [fecha, setFecha] = useState(todayDayKey());
  const [turno, setTurno] = useState<CajaTurnoPeriodo>(defaultTurnoPeriodo());
  const [sistemaTarjeta, setSistemaTarjeta] = useState("");
  const [sistemaEfectivo, setSistemaEfectivo] = useState("");
  const [reportadoTarjeta, setReportadoTarjeta] = useState("");
  const [reportadoEfectivo, setReportadoEfectivo] = useState("");
  const [reportadoUsd, setReportadoUsd] = useState("");
  const [verificado, setVerificado] = useState(false);
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setFormError(null);
    try {
      const response = await fetch("/api/admin/caja/turnos", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha,
          turno,
          sistemaTarjeta,
          sistemaEfectivo,
          reportadoTarjeta,
          reportadoEfectivo,
          reportadoUsd,
          verificado,
          notas,
        }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(body?.error || "No pudimos registrar el turno");
      }
      await onSaved();
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : "No pudimos registrar el turno");
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
        aria-labelledby="turno-title"
        className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[28px] bg-white p-6"
        style={{ boxShadow: "0 24px 64px rgba(26, 26, 26, 0.18)", color: brand.ink }}
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Caja</p>
        <h2 id="turno-title" className="font-display mt-1 text-2xl font-bold">
          Registrar cierre de turno
        </h2>
        <p className="mt-1 text-sm text-brand-muted">Fecha y turno alcanzan para guardar. Los montos pueden ir en 0.</p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className={adminLabelClass}>
            Fecha
            <AdminInput type="date" required value={fecha} onChange={(event) => setFecha(event.target.value)} />
          </label>
          <label className={adminLabelClass}>
            Turno
            <AdminSelect value={turno} onChange={(event) => setTurno(event.target.value as CajaTurnoPeriodo)}>
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </AdminSelect>
          </label>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <MoneyField label="Sistema tarjeta" value={sistemaTarjeta} onChange={setSistemaTarjeta} />
          <MoneyField label="Sistema efectivo" value={sistemaEfectivo} onChange={setSistemaEfectivo} />
          <MoneyField label="Reportado tarjeta" value={reportadoTarjeta} onChange={setReportadoTarjeta} />
          <MoneyField label="Reportado efectivo" value={reportadoEfectivo} onChange={setReportadoEfectivo} />
          <MoneyField label="Reportado USD" prefix="US$" value={reportadoUsd} onChange={setReportadoUsd} />
        </div>

        <label className={`${adminLabelClass} mt-4 flex items-center gap-2`}>
          <input
            type="checkbox"
            checked={verificado}
            onChange={(event) => setVerificado(event.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          <span className="text-sm font-semibold text-brand-ink">Verificado</span>
        </label>

        <label className={`${adminLabelClass} mt-4`}>
          Notas
          <AdminTextarea value={notas} onChange={(event) => setNotas(event.target.value)} rows={2} />
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
            disabled={saving}
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

function MoneyField({
  label,
  value,
  onChange,
  prefix = "RD$",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  prefix?: string;
}) {
  return (
    <label className={adminLabelClass}>
      {label}
      <span className="relative mt-1.5 block">
        <span
          className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-semibold"
          style={{ color: brand.orange }}
        >
          {prefix}
        </span>
        <AdminInput
          bare
          value={value}
          inputMode="decimal"
          onChange={(event) => onChange(event.target.value)}
          className="!pl-12 font-semibold tabular-nums"
        />
      </span>
    </label>
  );
}
