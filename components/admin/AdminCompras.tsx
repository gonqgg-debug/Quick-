"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  COMPRAS_PAGE_SIZE,
  daysRemaining,
  dueDateFromCredit,
  emptyComprasSummary,
  formatDaysRemaining,
  type Compra,
  type ComprasSummary,
  type Proveedor,
} from "@/lib/admin-compras-shared";
import { formatDayKey, todayDayKey } from "@/lib/local-day";
import { formatPrice } from "@/lib/money";
import { brand } from "@/lib/theme";

const fieldClass =
  "mt-1.5 h-11 w-full rounded-xl border bg-white px-3 text-sm font-medium outline-none focus:border-[#7EB341]";
const labelClass = "block text-[13px] font-medium text-brand-muted";

type View = "pendientes" | "historial";

export function AdminCompras() {
  const router = useRouter();
  const [view, setView] = useState<View>("pendientes");
  const [compras, setCompras] = useState<Compra[]>([]);
  const [summary, setSummary] = useState<ComprasSummary>(emptyComprasSummary());
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [proveedorId, setProveedorId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const loadProveedores = useCallback(async () => {
    const response = await fetch("/api/admin/proveedores", { credentials: "include" });
    if (response.status === 401) {
      router.replace("/admin/login");
      return;
    }
    const body = (await response.json().catch(() => null)) as { proveedores?: Proveedor[]; error?: string } | null;
    if (!response.ok) {
      throw new Error(body?.error || "No pudimos cargar los proveedores");
    }
    setProveedores(body?.proveedores ?? []);
  }, [router]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (view === "pendientes") {
      params.set("pagado", "false");
    }
    if (view === "historial") {
      if (proveedorId) {
        params.set("proveedorId", proveedorId);
      }
      if (from) {
        params.set("from", from);
      }
      if (to) {
        params.set("to", to);
      }
      if (page > 1) {
        params.set("page", String(page));
      }
    }
    return params.toString();
  }, [view, proveedorId, from, to, page]);

  const loadCompras = useCallback(async () => {
    const response = await fetch(`/api/admin/compras${queryString ? `?${queryString}` : ""}`, { credentials: "include" });
    if (response.status === 401) {
      router.replace("/admin/login");
      return;
    }
    const body = (await response.json().catch(() => null)) as
      | { compras?: Compra[]; summary?: ComprasSummary; total?: number; error?: string }
      | null;
    if (!response.ok) {
      throw new Error(body?.error || "No pudimos cargar las compras");
    }
    setCompras(body?.compras ?? []);
    setSummary(body?.summary ?? emptyComprasSummary());
    setTotal(body?.total ?? body?.compras?.length ?? 0);
  }, [queryString, router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadProveedores();
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Error al cargar");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadProveedores]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await loadCompras();
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
  }, [loadCompras]);

  async function markPaid(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/compras/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pagado: true }),
      });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(body?.error || "No pudimos marcarla como pagada");
      }
      await loadCompras();
    } catch (markError) {
      setError(markError instanceof Error ? markError.message : "No pudimos marcarla como pagada");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Compras</p>
          <h1 className="font-display mt-1 text-2xl font-bold">Compras</h1>
        </div>
        <button
          type="button"
          onClick={() => setRegisterOpen(true)}
          className="rounded-full px-4 text-sm font-bold text-white"
          style={{ minHeight: 44, backgroundColor: brand.green }}
        >
          Registrar compra
        </button>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard label="Total pendiente" amount={summary.totalPendiente} />
        <SummaryCard label="Vence esta semana" amount={summary.venceEstaSemana} />
        <SummaryCard label="Vencidas" amount={summary.vencidas} danger={summary.vencidas > 0} />
      </div>

      <div className="mt-5 flex flex-wrap gap-1.5">
        {(
          [
            { id: "pendientes", label: "Pendientes" },
            { id: "historial", label: "Historial" },
          ] as const
        ).map((tab) => {
          const active = view === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setView(tab.id);
                setPage(1);
              }}
              className="rounded-full px-3.5 py-1.5 text-sm font-semibold"
              style={{
                backgroundColor: active ? brand.green : "#F3F4F6",
                color: active ? "#FFFFFF" : brand.ink,
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {view === "historial" ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className={labelClass}>
            Proveedor
            <select
              value={proveedorId}
              onChange={(event) => {
                setProveedorId(event.target.value);
                setPage(1);
              }}
              className={fieldClass}
              style={{ borderColor: "#E5E7EB", color: brand.ink }}
            >
              <option value="">Todos</option>
              {proveedores.map((proveedor) => (
                <option key={proveedor.id} value={proveedor.id}>
                  {proveedor.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Desde
            <input
              type="date"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                setPage(1);
              }}
              className={fieldClass}
              style={{ borderColor: "#E5E7EB", color: brand.ink }}
            />
          </label>
          <label className={labelClass}>
            Hasta
            <input
              type="date"
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                setPage(1);
              }}
              className={fieldClass}
              style={{ borderColor: "#E5E7EB", color: brand.ink }}
            />
          </label>
        </div>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-2xl px-4 py-3 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="mt-6 h-48 animate-pulse rounded-[24px] bg-gray-100" />
      ) : compras.length === 0 ? (
        <div className="mt-6 rounded-[28px] px-5 py-14 text-center" style={{ backgroundColor: "#F8FAF7" }}>
          <p className="font-display text-xl font-bold">
            {view === "pendientes" ? "No hay compras pendientes" : "No hay compras con esos filtros"}
          </p>
          <p className="mt-2 text-sm text-brand-muted">
            {view === "pendientes" ? "Registra una compra para verla aquí." : "Prueba otro proveedor o rango de fechas."}
          </p>
        </div>
      ) : view === "pendientes" ? (
        <PendientesTable compras={compras} busyId={busyId} onMarkPaid={markPaid} />
      ) : (
        <HistorialTable compras={compras} page={page} total={total} onPage={setPage} />
      )}

      {registerOpen ? (
        <RegistrarCompraModal
          proveedores={proveedores}
          onClose={() => setRegisterOpen(false)}
          onSaved={async (_compra, createdProveedor) => {
            if (createdProveedor) {
              setProveedores((current) => {
                if (current.some((item) => item.id === createdProveedor.id)) {
                  return current;
                }
                return [...current, createdProveedor].sort((left, right) =>
                  left.nombre.localeCompare(right.nombre, "es", { sensitivity: "base" })
                );
              });
            }
            setRegisterOpen(false);
            await loadCompras();
          }}
        />
      ) : null}
    </div>
  );
}

function SummaryCard({ label, amount, danger = false }: { label: string; amount: number; danger?: boolean }) {
  return (
    <section className="rounded-[24px] border bg-white px-4 py-4" style={{ borderColor: "#E5E7EB" }}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-brand-muted">{label}</p>
      <p
        className="mt-1 font-display text-xl font-bold tabular-nums"
        style={{ color: danger ? brand.error : brand.ink }}
      >
        {formatPrice(amount)}
      </p>
    </section>
  );
}

function PendientesTable({
  compras,
  busyId,
  onMarkPaid,
}: {
  compras: Compra[];
  busyId: string | null;
  onMarkPaid: (id: string) => void;
}) {
  const today = todayDayKey();
  return (
    <div className="mt-6 overflow-x-auto rounded-[24px] border" style={{ borderColor: "#E5E7EB" }}>
      <table className="w-full min-w-[780px] text-left text-sm">
        <thead>
          <tr className="text-xs font-bold uppercase tracking-wide text-brand-muted" style={{ backgroundColor: "#F8FAF7" }}>
            <th className="px-4 py-3">Proveedor</th>
            <th className="whitespace-nowrap px-4 py-3 text-right">Monto</th>
            <th className="whitespace-nowrap px-4 py-3">Fecha</th>
            <th className="whitespace-nowrap px-4 py-3">Vence</th>
            <th className="whitespace-nowrap px-4 py-3">Días restantes</th>
            <th className="px-4 py-3">
              <span className="sr-only">Pagar</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {compras.map((compra, index) => {
            const days = daysRemaining(compra.dueDate, today);
            const overdue = days < 0;
            return (
              <tr key={compra.id} style={{ backgroundColor: index % 2 === 1 ? "#FAFBFA" : "#FFFFFF" }}>
                <td className="px-4 py-3 font-semibold">{compra.proveedorNombre}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums">{formatPrice(compra.monto)}</td>
                <td className="whitespace-nowrap px-4 py-3">{formatDayKey(compra.fecha)}</td>
                <td className="whitespace-nowrap px-4 py-3">{formatDayKey(compra.dueDate)}</td>
                <td
                  className="whitespace-nowrap px-4 py-3 font-semibold"
                  style={{ color: overdue ? brand.error : brand.ink }}
                >
                  {formatDaysRemaining(days)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <button
                    type="button"
                    disabled={busyId === compra.id}
                    onClick={() => onMarkPaid(compra.id)}
                    className="rounded-full px-3 text-sm font-bold disabled:opacity-40"
                    style={{ minHeight: 36, backgroundColor: "#F3F4F6", color: brand.ink }}
                  >
                    {busyId === compra.id ? "..." : "Marcar como pagada"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function HistorialTable({
  compras,
  page,
  total,
  onPage,
}: {
  compras: Compra[];
  page: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / COMPRAS_PAGE_SIZE));
  const fromRow = total === 0 ? 0 : (page - 1) * COMPRAS_PAGE_SIZE + 1;
  const toRow = Math.min(total, page * COMPRAS_PAGE_SIZE);
  return (
    <div className="mt-6">
      <div className="overflow-x-auto rounded-[24px] border" style={{ borderColor: "#E5E7EB" }}>
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="text-xs font-bold uppercase tracking-wide text-brand-muted" style={{ backgroundColor: "#F8FAF7" }}>
              <th className="px-4 py-3">Proveedor</th>
              <th className="whitespace-nowrap px-4 py-3 text-right">Monto</th>
              <th className="whitespace-nowrap px-4 py-3">Fecha</th>
              <th className="whitespace-nowrap px-4 py-3">Vence</th>
              <th className="whitespace-nowrap px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {compras.map((compra, index) => (
              <tr key={compra.id} style={{ backgroundColor: index % 2 === 1 ? "#FAFBFA" : "#FFFFFF" }}>
                <td className="px-4 py-3 font-semibold">{compra.proveedorNombre}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums">{formatPrice(compra.monto)}</td>
                <td className="whitespace-nowrap px-4 py-3">{formatDayKey(compra.fecha)}</td>
                <td className="whitespace-nowrap px-4 py-3">{formatDayKey(compra.dueDate)}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  {compra.pagado ? (
                    <span className="font-semibold" style={{ color: brand.green }}>
                      Pagada{compra.pagadoEn ? ` · ${formatDayKey(compra.pagadoEn)}` : ""}
                    </span>
                  ) : (
                    <span className="font-semibold" style={{ color: brand.orange }}>
                      Pendiente
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-brand-muted">
          {fromRow}–{toRow} de {total.toLocaleString("es-DO")}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
            className="rounded-full px-4 text-sm font-bold disabled:opacity-40"
            style={{ minHeight: 40, border: "1px solid #E5E7EB", color: brand.ink }}
          >
            Anterior
          </button>
          <span className="text-sm font-semibold text-brand-muted">
            {page}/{pageCount}
          </span>
          <button
            type="button"
            disabled={page >= pageCount}
            onClick={() => onPage(page + 1)}
            className="rounded-full px-4 text-sm font-bold disabled:opacity-40"
            style={{ minHeight: 40, border: "1px solid #E5E7EB", color: brand.ink }}
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}

function RegistrarCompraModal({
  proveedores,
  onClose,
  onSaved,
}: {
  proveedores: Proveedor[];
  onClose: () => void;
  onSaved: (compra: Compra, createdProveedor: Proveedor | null) => void | Promise<void>;
}) {
  const today = todayDayKey();
  const [query, setQuery] = useState("");
  const [proveedorId, setProveedorId] = useState<string | null>(null);
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(today);
  const [dueDate, setDueDate] = useState(today);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const selected = proveedores.find((item) => item.id === proveedorId) ?? null;

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const proveedor = proveedores.find((item) => item.id === proveedorId) ?? null;
    setDueDate(dueDateFromCredit(fecha, proveedor));
  }, [fecha, proveedorId, proveedores]);

  async function save() {
    setSaving(true);
    setFormError(null);
    try {
      const response = await fetch("/api/admin/compras", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proveedorId: proveedorId || undefined,
          proveedorNombre: query.trim() || undefined,
          monto,
          fecha,
          dueDate,
        }),
      });
      const body = (await response.json().catch(() => null)) as { compra?: Compra; error?: string } | null;
      if (!response.ok || !body?.compra) {
        throw new Error(body?.error || "No pudimos registrar la compra");
      }
      const createdProveedor =
        proveedorId || !query.trim()
          ? null
          : {
              id: body.compra.proveedorId,
              nombre: body.compra.proveedorNombre,
              tieneCredito: false,
              diasCredito: 0,
              notas: null,
            };
      await onSaved(body.compra, createdProveedor);
    } catch (saveError) {
      setFormError(saveError instanceof Error ? saveError.message : "No pudimos registrar la compra");
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
        aria-labelledby="compra-title"
        className="relative z-10 w-full max-w-md overflow-hidden rounded-[28px] bg-white p-6"
        style={{ boxShadow: "0 24px 64px rgba(26, 26, 26, 0.18)", color: brand.ink }}
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Compras</p>
        <h2 id="compra-title" className="font-display mt-1 text-2xl font-bold">
          Registrar compra
        </h2>

        <div className="mt-5">
          <p className={labelClass}>Proveedor</p>
          <ProveedorCombobox
            proveedores={proveedores}
            query={query}
            proveedorId={proveedorId}
            onChange={({ query: nextQuery, proveedorId: nextId }) => {
              setQuery(nextQuery);
              setProveedorId(nextId);
            }}
          />
        </div>

        <label className={`${labelClass} mt-4`}>
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
              onChange={(event) => setMonto(event.target.value)}
              className="h-11 w-full rounded-xl border bg-white pl-12 pr-3 text-sm font-semibold tabular-nums outline-none focus:border-[#7EB341]"
              style={{ borderColor: "#E5E7EB", color: brand.ink }}
            />
          </span>
        </label>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            Fecha
            <input
              type="date"
              required
              value={fecha}
              onChange={(event) => setFecha(event.target.value)}
              className={fieldClass}
              style={{ borderColor: "#E5E7EB", color: brand.ink }}
            />
          </label>
          <label className={labelClass}>
            Vence
            <input
              type="date"
              required
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              className={fieldClass}
              style={{ borderColor: "#E5E7EB", color: brand.ink }}
            />
          </label>
        </div>
        {selected?.tieneCredito ? (
          <p className="mt-2 text-xs text-brand-muted">
            Crédito de {selected.nombre}: {selected.diasCredito} días. Puedes cambiar la fecha de vencimiento.
          </p>
        ) : null}

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
            disabled={saving || (!proveedorId && !query.trim()) || !monto.trim()}
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

function ProveedorCombobox({
  proveedores,
  query,
  proveedorId,
  onChange,
}: {
  proveedores: Proveedor[];
  query: string;
  proveedorId: string | null;
  onChange: (next: { query: string; proveedorId: string | null }) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const needle = query.trim().toLowerCase();
  const matches = needle
    ? proveedores.filter((item) => item.nombre.toLowerCase().includes(needle)).slice(0, 8)
    : proveedores.slice(0, 8);
  const exact = proveedores.find((item) => item.nombre.toLowerCase() === needle) ?? null;
  const canCreate = needle.length > 0 && !exact;

  useEffect(() => {
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener("mousedown", onPointer);
    return () => window.removeEventListener("mousedown", onPointer);
  }, []);

  function pick(proveedor: Proveedor) {
    onChange({ query: proveedor.nombre, proveedorId: proveedor.id });
    setOpen(false);
  }

  function pickNew() {
    onChange({ query: query.trim(), proveedorId: null });
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className="relative mt-1.5">
      <input
        ref={inputRef}
        value={query}
        autoComplete="off"
        placeholder="Buscar o escribir uno nuevo"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          const value = event.target.value;
          const match = proveedores.find((item) => item.nombre.toLowerCase() === value.trim().toLowerCase());
          onChange({ query: value, proveedorId: match?.id ?? null });
          setOpen(true);
        }}
        className={fieldClass.replace("mt-1.5 ", "")}
        style={{ borderColor: "#E5E7EB", color: brand.ink }}
      />
      {open && (matches.length > 0 || canCreate) ? (
        <ul
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-2xl border bg-white py-1"
          style={{ borderColor: "#E5E7EB", boxShadow: "0 12px 32px rgba(26, 26, 26, 0.12)" }}
        >
          {matches.map((proveedor) => (
            <li key={proveedor.id}>
              <button
                type="button"
                onClick={() => pick(proveedor)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-semibold"
                style={{
                  backgroundColor: proveedor.id === proveedorId ? `${brand.green}18` : "transparent",
                  color: brand.ink,
                }}
              >
                <span>{proveedor.nombre}</span>
                {proveedor.tieneCredito ? (
                  <span className="text-xs font-medium text-brand-muted">{proveedor.diasCredito} d</span>
                ) : null}
              </button>
            </li>
          ))}
          {canCreate ? (
            <li>
              <button
                type="button"
                onClick={pickNew}
                className="w-full px-3 py-2 text-left text-sm font-semibold"
                style={{ color: brand.green }}
              >
                Crear «{query.trim()}»
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
