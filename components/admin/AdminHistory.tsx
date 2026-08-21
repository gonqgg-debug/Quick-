"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { OrderSnapshot } from "@/components/staff/OrderSnapshot";
import { PruebaBadge } from "@/components/order/PruebaBadge";
import { formatOrderNumber, orderStatusLabel } from "@/lib/order-display";
import {
  HISTORY_PAGE_SIZE,
  HISTORY_STATES,
  formatHistoryDateTime,
  historyQueryString,
  type HistoryEstado,
  type HistoryOrder,
} from "@/lib/staff-history-shared";
import { brand } from "@/lib/theme";

const STATUS_FILTERS: { id: "todos" | HistoryEstado; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "completada", label: "Completada" },
  { id: "cancelada", label: "Cancelada" },
  { id: "despachada", label: "Despachada" },
];

function statusColor(estado: HistoryEstado): string {
  if (estado === "cancelada") return brand.error;
  if (estado === "despachada") return brand.blue;
  return brand.green;
}

export function AdminHistory() {
  const router = useRouter();
  const [orders, setOrders] = useState<HistoryOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [estado, setEstado] = useState<"todos" | HistoryEstado>("todos");
  const [includePruebas, setIncludePruebas] = useState(false);
  const [minTotal, setMinTotal] = useState("");
  const [maxTotal, setMaxTotal] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const filterParams = useMemo(() => {
    const estados = estado === "todos" ? Array.from(HISTORY_STATES) : [estado];
    const min = minTotal.trim() === "" ? null : Number(minTotal);
    const max = maxTotal.trim() === "" ? null : Number(maxTotal);
    return {
      q: query,
      from: from || null,
      to: to || null,
      estados,
      minTotal: Number.isFinite(min) ? min : null,
      maxTotal: Number.isFinite(max) ? max : null,
      includePruebas,
    };
  }, [query, from, to, estado, minTotal, maxTotal, includePruebas]);

  const queryString = useMemo(() => historyQueryString({ ...filterParams, page }), [filterParams, page]);

  useEffect(() => {
    setExpandedId(null);
  }, [queryString]);

  const loadHistory = useCallback(async (): Promise<boolean> => {
    const response = await fetch(`/api/admin/orders/history?${queryString}`, { credentials: "include" });
    if (response.status === 401) {
      router.replace("/admin/login");
      return false;
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error || "No pudimos cargar el historial");
    }
    const body = (await response.json()) as { orders: HistoryOrder[]; total: number };
    setOrders(body.orders ?? []);
    setTotal(body.total ?? 0);
    return true;
  }, [queryString, router]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const ok = await loadHistory();
        if (ok && !cancelled) {
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
  }, [loadHistory]);

  const pageCount = Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE));
  const fromRow = total === 0 ? 0 : (page - 1) * HISTORY_PAGE_SIZE + 1;
  const toRow = Math.min(page * HISTORY_PAGE_SIZE, total);

  async function exportExcel() {
    setExporting(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/orders/history/export?${historyQueryString(filterParams)}`, {
        credentials: "include",
      });
      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "No pudimos exportar");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `historial-pedidos-${stamp}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Error al exportar");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Delivery</p>
            <h1 className="font-display text-2xl font-bold">Historial de Delivery</h1>
          </div>
          <button
            type="button"
            onClick={() => void exportExcel()}
            disabled={exporting || total === 0}
            className="rounded-full px-4 text-sm font-bold text-white disabled:opacity-50"
            style={{ backgroundColor: brand.orange, minHeight: 44 }}
          >
            {exporting ? "Exportando..." : "Exportar a Excel"}
          </button>
        </div>

        <input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Buscar por # orden, cliente o teléfono"
          className="h-11 w-full rounded-full border px-4 outline-none"
          style={{ borderColor: "#E5E7EB", fontSize: 16 }}
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-xs font-bold text-brand-muted">
            Desde
            <input
              type="date"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                setPage(1);
              }}
              className="mt-1 h-11 w-full rounded-xl border bg-white px-3 text-sm font-semibold"
              style={{ borderColor: "#E5E7EB", color: brand.ink }}
            />
          </label>
          <label className="block text-xs font-bold text-brand-muted">
            Hasta
            <input
              type="date"
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                setPage(1);
              }}
              className="mt-1 h-11 w-full rounded-xl border bg-white px-3 text-sm font-semibold"
              style={{ borderColor: "#E5E7EB", color: brand.ink }}
            />
          </label>
          <label className="block text-xs font-bold text-brand-muted">
            Monto mín.
            <input
              type="number"
              min={0}
              inputMode="decimal"
              value={minTotal}
              onChange={(event) => {
                setMinTotal(event.target.value);
                setPage(1);
              }}
              placeholder="Opcional"
              className="mt-1 h-11 w-full rounded-xl border bg-white px-3 text-sm font-semibold"
              style={{ borderColor: "#E5E7EB" }}
            />
          </label>
          <label className="block text-xs font-bold text-brand-muted">
            Monto máx.
            <input
              type="number"
              min={0}
              inputMode="decimal"
              value={maxTotal}
              onChange={(event) => {
                setMaxTotal(event.target.value);
                setPage(1);
              }}
              placeholder="Opcional"
              className="mt-1 h-11 w-full rounded-xl border bg-white px-3 text-sm font-semibold"
              style={{ borderColor: "#E5E7EB" }}
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar por estado">
          {STATUS_FILTERS.map((filter) => {
            const active = estado === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setEstado(filter.id);
                  setPage(1);
                }}
                className="rounded-full px-3 text-sm font-bold"
                style={{
                  minHeight: 40,
                  backgroundColor: active ? brand.green : "#F3F4F6",
                  color: active ? "#FFFFFF" : "#4B5563",
                }}
              >
                {filter.label}
              </button>
            );
          })}
        </div>

        <label className="flex items-start gap-2 text-sm font-semibold" style={{ color: brand.ink }}>
          <input
            type="checkbox"
            checked={includePruebas}
            onChange={(event) => {
              setIncludePruebas(event.target.checked);
              setPage(1);
            }}
            className="mt-0.5 h-4 w-4 accent-[#7EB341]"
          />
          <span>
            Incluir pedidos de prueba
            <span className="block text-xs font-medium text-brand-muted">
              Por defecto quedan fuera de la lista, las métricas y la exportación.
            </span>
          </span>
        </label>
      </div>

      <div className="mt-6">
        {error ? (
          <p className="mb-3 rounded-2xl px-3 py-2 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="h-64 animate-pulse rounded-[24px] bg-gray-100" />
        ) : orders.length === 0 ? (
          <div className="rounded-[28px] px-5 py-14 text-center" style={{ backgroundColor: "#F8FAF7" }}>
            <p className="text-4xl">🌿</p>
            <p className="font-display mt-3 text-xl font-bold">No hay pedidos con esos filtros</p>
            <p className="mt-2 text-sm text-brand-muted">Prueba otro rango de fechas, estado o búsqueda.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-[24px] border" style={{ borderColor: "#E5E7EB" }}>
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead>
                  <tr
                    className="text-xs font-bold uppercase tracking-wide text-brand-muted"
                    style={{ backgroundColor: "#F8FAF7" }}
                  >
                    <th className="whitespace-nowrap px-3 py-3">Fecha/Hora</th>
                    <th className="whitespace-nowrap px-3 py-3"># Orden</th>
                    <th className="px-3 py-3">Cliente</th>
                    <th className="whitespace-nowrap px-3 py-3">Teléfono</th>
                    <th className="px-3 py-3">Dirección</th>
                    <th className="whitespace-nowrap px-3 py-3 text-right"># Ítems</th>
                    <th className="whitespace-nowrap px-3 py-3 text-right">Total</th>
                    <th className="px-3 py-3">Estado</th>
                    <th className="whitespace-nowrap px-3 py-3">Tiempo que tardó</th>
                    <th className="w-10 px-2 py-3">
                      <span className="sr-only">Detalle</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const open = expandedId === order.id;
                    return (
                      <HistoryRow
                        key={order.id}
                        order={order}
                        open={open}
                        onToggle={() => setExpandedId(open ? null : order.id)}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-brand-muted">
                {fromRow}–{toRow} de {total}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="rounded-full px-4 text-sm font-bold disabled:opacity-40"
                  style={{ minHeight: 40, backgroundColor: "#F3F4F6" }}
                >
                  Anterior
                </button>
                <p className="text-sm font-semibold tabular-nums">
                  {page} / {pageCount}
                </p>
                <button
                  type="button"
                  disabled={page >= pageCount}
                  onClick={() => setPage((current) => current + 1)}
                  className="rounded-full px-4 text-sm font-bold disabled:opacity-40"
                  style={{ minHeight: 40, backgroundColor: "#F3F4F6" }}
                >
                  Siguiente
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function HistoryRow({
  order,
  open,
  onToggle,
}: {
  order: HistoryOrder;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className="cursor-pointer border-t"
        style={{ borderColor: "#F3F4F6", backgroundColor: open ? "#FAFBFA" : undefined }}
        onClick={onToggle}
      >
        <td className="whitespace-nowrap px-3 py-2.5 text-xs text-brand-muted">
          {formatHistoryDateTime(order.createdAt)}
        </td>
        <td className="whitespace-nowrap px-3 py-2.5 font-bold">
          <span className="inline-flex items-center gap-1.5">
            #{formatOrderNumber(order.id)}
            {order.esPrueba ? <PruebaBadge /> : null}
          </span>
        </td>
        <td className="max-w-[140px] truncate px-3 py-2.5">{order.clienteNombre || "—"}</td>
        <td className="whitespace-nowrap px-3 py-2.5">{order.clienteTelefono}</td>
        <td className="max-w-[220px] truncate px-3 py-2.5" title={order.direccion}>
          {order.direccion}
        </td>
        <td className="px-3 py-2.5 text-right tabular-nums">{order.itemCount}</td>
        <td className="px-3 py-2.5 text-right font-bold">{order.totalLabel}</td>
        <td className="px-3 py-2.5">
          <span
            className="inline-block rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
            style={{ backgroundColor: statusColor(order.estado) }}
          >
            {orderStatusLabel(order.estado)}
          </span>
        </td>
        <td className="whitespace-nowrap px-3 py-2.5 font-mono text-sm tabular-nums text-brand-muted">
          {order.durationLabel}
        </td>
        <td className="px-2 py-2.5">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ color: brand.muted }}
            aria-hidden
          >
            <ChevronIcon open={open} />
          </span>
        </td>
      </tr>
      {open ? (
        <tr style={{ backgroundColor: "#FFFFFF" }}>
          <td colSpan={10} className="px-3 pb-4 pt-1">
            <OrderSnapshot
              direccion={order.direccion}
              metodoPago={order.metodoPago}
              clienteTelefono={order.clienteTelefono}
              items={order.items}
            />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      style={{ transform: open ? "rotate(180deg)" : undefined }}
    >
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
