"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StaffChrome } from "@/components/staff/StaffChrome";
import { StaffLogin, staffLogout } from "@/components/staff/StaffLogin";
import { isToday } from "@/lib/local-day";
import {
  elapsedMinutes,
  formatElapsedClock,
  ORDER_AGING,
  orderAgingColor,
  orderAgingLevel,
  usesOrderAging,
} from "@/lib/order-aging";
import { formatOrderNumber, itemStatusLabel, orderStatusLabel } from "@/lib/order-display";
import {
  playStaffAlert,
  readStaffSoundMuted,
  unlockStaffAlerts,
  writeStaffSoundMuted,
} from "@/lib/staff-alerts";
import { brand } from "@/lib/theme";
import type { OrderEstado, OrderItemEstado } from "@/lib/types";

type StaffOrderItem = {
  id: string;
  productId: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  precioLabel: string;
  estado: OrderItemEstado;
};

type StaffOrder = {
  id: string;
  createdAt: string;
  updatedAt?: string;
  estado: OrderEstado;
  direccion: string;
  metodoPago: string;
  totalEstimado: number;
  totalLabel: string;
  notas: string | null;
  clienteNombre: string | null;
  clienteTelefono: string;
  items: StaffOrderItem[];
};

const STATUS_ACTIONS: { estado: OrderEstado; label: string }[] = [
  { estado: "en_proceso", label: "En proceso" },
  { estado: "despachada", label: "Despachada" },
  { estado: "completada", label: "Completada" },
  { estado: "cancelada", label: "Cancelada" },
];

type FilterId = "nueva" | "en_proceso" | "despachada" | "completada";

const FILTERS: { id: FilterId; label: string; match: (estado: OrderEstado) => boolean; empty: string }[] = [
  {
    id: "nueva",
    label: "Nuevas",
    match: (estado) => estado === "nueva",
    empty: "Todo al día 🎉 No hay pedidos nuevos hoy",
  },
  {
    id: "en_proceso",
    label: "En proceso",
    match: (estado) =>
      estado === "en_proceso" || estado === "confirmada" || estado === "faltante_reportado",
    empty: "Nada en cocina ahora. Cuando un pedido avance, aparece aquí.",
  },
  {
    id: "despachada",
    label: "Despachadas",
    match: (estado) => estado === "despachada",
    empty: "No hay pedidos en camino hoy.",
  },
  {
    id: "completada",
    label: "Completadas",
    match: (estado) => estado === "completada" || estado === "cancelada",
    empty: "Hoy todavía no hay pedidos cerrados.",
  },
];

function stripeColor(estado: OrderEstado): string {
  if (estado === "nueva" || estado === "faltante_reportado") return brand.orange;
  if (estado === "en_proceso" || estado === "confirmada") return brand.blue;
  if (estado === "despachada" || estado === "completada") return brand.green;
  return brand.muted;
}

function statusColor(estado: OrderEstado): string {
  if (estado === "faltante_reportado" || estado === "cancelada") return brand.error;
  if (estado === "en_proceso" || estado === "confirmada" || estado === "despachada") return brand.blue;
  if (estado === "completada") return brand.green;
  return brand.orange;
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat("es-DO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function paymentLabel(metodo: string): string {
  if (metodo === "efectivo") return "Efectivo";
  if (metodo === "tarjeta") return "Tarjeta";
  return metodo;
}

function customerLabel(order: StaffOrder): string {
  return order.clienteNombre || order.clienteTelefono;
}

function nextQuickAction(estado: OrderEstado): { estado: OrderEstado; label: string } | null {
  if (estado === "nueva") {
    return { estado: "en_proceso", label: "Tomar" };
  }
  if (estado === "en_proceso" || estado === "confirmada" || estado === "faltante_reportado") {
    return { estado: "despachada", label: "Despachar" };
  }
  if (estado === "despachada") {
    return { estado: "completada", label: "Completar" };
  }
  return null;
}

function orderMatchesQuery(order: StaffOrder, query: string): boolean {
  if (!query) {
    return true;
  }
  const haystack = [formatOrderNumber(order.id), order.id, order.clienteNombre ?? "", order.clienteTelefono]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function usesCards(filterId: FilterId): boolean {
  return filterId === "nueva" || filterId === "en_proceso";
}

export function StaffPanel() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [orders, setOrders] = useState<StaffOrder[]>([]);
  const [waitingCount, setWaitingCount] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterId, setFilterId] = useState<FilterId>("nueva");
  const [now, setNow] = useState(() => Date.now());
  const [soundMuted, setSoundMuted] = useState(false);
  const seenNewIds = useRef<Set<string> | null>(null);
  const seenUrgentIds = useRef<Set<string> | null>(null);

  const loadOrders = useCallback(async (): Promise<boolean> => {
    const response = await fetch("/api/staff/orders", { credentials: "include" });
    if (response.status === 401) {
      setAuthorized(false);
      setOrders([]);
      return false;
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error || "No pudimos cargar los pedidos");
    }
    const body = (await response.json()) as { orders: StaffOrder[] };
    setOrders(body.orders ?? []);
    setAuthorized(true);
    return true;
  }, []);

  const loadWaitingCount = useCallback(async () => {
    const response = await fetch("/api/staff/chats", { credentials: "include" });
    if (!response.ok) {
      return;
    }
    const body = (await response.json()) as { chats: unknown[] };
    setWaitingCount(body.chats?.length ?? 0);
  }, []);

  const refresh = useCallback(async () => {
    const ok = await loadOrders();
    if (ok) {
      await loadWaitingCount();
    }
  }, [loadOrders, loadWaitingCount]);

  useEffect(() => {
    setSoundMuted(readStaffSoundMuted());
    const unlock = () => {
      void unlockStaffAlerts();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refresh();
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Error al cargar");
          setAuthorized(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    if (!authorized) {
      return;
    }
    const timer = window.setInterval(() => {
      void refresh().catch(() => undefined);
    }, 20000);
    return () => window.clearInterval(timer);
  }, [authorized, refresh]);

  const activeFilter = FILTERS.find((filter) => filter.id === filterId) ?? FILTERS[0];
  const query = searchQuery.trim().toLowerCase();

  const todayOrders = useMemo(() => orders.filter((order) => isToday(order.createdAt)), [orders]);

  const chipCounts = useMemo(() => {
    const counts: Record<FilterId, number> = {
      nueva: 0,
      en_proceso: 0,
      despachada: 0,
      completada: 0,
    };
    for (const order of todayOrders) {
      for (const filter of FILTERS) {
        if (filter.match(order.estado)) {
          counts[filter.id] += 1;
        }
      }
    }
    return counts;
  }, [todayOrders]);

  const summary = useMemo(() => {
    let nuevas = 0;
    let enProceso = 0;
    let urgentes = 0;
    for (const order of todayOrders) {
      if (order.estado === "nueva") {
        nuevas += 1;
      }
      if (order.estado === "en_proceso" || order.estado === "confirmada" || order.estado === "faltante_reportado") {
        enProceso += 1;
      }
      if (usesOrderAging(order.estado) && orderAgingLevel(elapsedMinutes(order.createdAt, now)) === "urgent") {
        urgentes += 1;
      }
    }
    return { nuevas, enProceso, urgentes };
  }, [todayOrders, now]);

  const visibleOrders = useMemo(() => {
    return todayOrders.filter((order) => activeFilter.match(order.estado) && orderMatchesQuery(order, query));
  }, [todayOrders, activeFilter, query]);

  const historyOrders = useMemo(() => {
    return orders.filter((order) => !isToday(order.createdAt) && orderMatchesQuery(order, query));
  }, [orders, query]);

  const needsLiveClock = useMemo(
    () => todayOrders.some((order) => usesOrderAging(order.estado)),
    [todayOrders]
  );

  useEffect(() => {
    if (!authorized || !needsLiveClock) {
      return;
    }
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, ORDER_AGING.tickMs);
    return () => window.clearInterval(timer);
  }, [authorized, needsLiveClock]);

  useEffect(() => {
    if (!authorized) {
      return;
    }

    const newIds = new Set(todayOrders.filter((order) => order.estado === "nueva").map((order) => order.id));
    const urgentIds = new Set(
      todayOrders
        .filter(
          (order) =>
            usesOrderAging(order.estado) && orderAgingLevel(elapsedMinutes(order.createdAt, now)) === "urgent"
        )
        .map((order) => order.id)
    );

    if (seenNewIds.current === null || seenUrgentIds.current === null) {
      seenNewIds.current = newIds;
      seenUrgentIds.current = urgentIds;
      return;
    }

    const hasNewOrder = Array.from(newIds).some((id) => !seenNewIds.current!.has(id));
    const hasNewUrgent = Array.from(urgentIds).some((id) => !seenUrgentIds.current!.has(id));

    if (!soundMuted) {
      if (hasNewOrder) {
        void playStaffAlert("new");
      } else if (hasNewUrgent) {
        void playStaffAlert("urgent");
      }
    }

    seenNewIds.current = newIds;
    seenUrgentIds.current = urgentIds;
  }, [authorized, todayOrders, now, soundMuted]);

  async function changeStatus(orderId: string, estado: OrderEstado) {
    setBusyKey(`status:${orderId}:${estado}`);
    setError(null);
    try {
      const response = await fetch(`/api/staff/orders/${orderId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado }),
      });
      if (response.status === 401) {
        setAuthorized(false);
        return;
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "No pudimos cambiar el estado");
      }
      await refresh();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Error al actualizar");
    } finally {
      setBusyKey(null);
    }
  }

  async function markMissing(order: StaffOrder, item: StaffOrderItem) {
    const confirmed = window.confirm(
      `¿Marcar "${item.nombre}" como faltante y avisar al cliente del pedido #${formatOrderNumber(order.id)}?`
    );
    if (!confirmed) {
      return;
    }

    setBusyKey(`missing:${item.id}`);
    setError(null);
    try {
      const response = await fetch(`/api/staff/orders/${order.id}/missing`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: item.productId }),
      });
      if (response.status === 401) {
        setAuthorized(false);
        return;
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "No pudimos marcar el faltante");
      }
      await refresh();
    } catch (missingError) {
      setError(missingError instanceof Error ? missingError.message : "Error al marcar faltante");
    } finally {
      setBusyKey(null);
    }
  }

  function toggleSound() {
    const next = !soundMuted;
    setSoundMuted(next);
    writeStaffSoundMuted(next);
    void unlockStaffAlerts();
  }

  if (authorized === null) {
    return (
      <main className="min-h-screen bg-white px-3 pt-4">
        <div className="mx-auto max-w-3xl space-y-3">
          <div className="h-14 animate-pulse rounded-2xl bg-gray-100" />
          <div className="h-24 animate-pulse rounded-[28px] bg-gray-100" />
          <div className="h-24 animate-pulse rounded-[28px] bg-gray-100" />
          <div className="h-24 animate-pulse rounded-[28px] bg-gray-100" />
        </div>
      </main>
    );
  }

  if (!authorized) {
    return <StaffLogin onSuccess={() => refresh()} />;
  }

  const showHistory = filterId === "completada" || query.length > 0;

  return (
    <StaffChrome
      active="orders"
      waitingCount={waitingCount}
      onLogout={() => {
        void staffLogout().then(() => {
          setAuthorized(false);
          setOrders([]);
          setSelectedId(null);
        });
      }}
      search={
        <div className="flex items-center justify-end gap-2">
          {searchOpen ? null : (
            <button
              type="button"
              onClick={toggleSound}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: "#F3F4F6" }}
              aria-label={soundMuted ? "Activar alertas sonoras" : "Silenciar alertas sonoras"}
              title={soundMuted ? "Alertas silenciadas" : "Alertas sonoras activas"}
            >
              {soundMuted ? "🔇" : "🔔"}
            </button>
          )}
          <StaffSearch
            open={searchOpen}
            query={searchQuery}
            placeholder="Buscar pedido o cliente"
            onToggle={() => setSearchOpen((current) => !current)}
            onChange={setSearchQuery}
          />
        </div>
      }
      filters={
        <div className="space-y-4">
          <TodaySummary nuevas={summary.nuevas} enProceso={summary.enProceso} urgentes={summary.urgentes} />
          <div
            className="flex w-full rounded-full p-1.5"
            style={{ backgroundColor: "#F3F4F6" }}
            role="tablist"
            aria-label="Filtrar pedidos de hoy"
          >
            {FILTERS.map((filter) => {
              const active = filter.id === filterId;
              return (
                <button
                  key={filter.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilterId(filter.id)}
                  className="flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center rounded-full px-1 py-1.5 transition-colors"
                  style={{
                    backgroundColor: active ? brand.green : "transparent",
                    color: active ? "#FFFFFF" : "#4B5563",
                    boxShadow: active ? "0 1px 2px rgba(26,26,26,0.12)" : "none",
                  }}
                >
                  <span className="truncate text-[11px] font-bold leading-tight sm:text-sm">{filter.label}</span>
                  <span className="text-[10px] font-semibold leading-tight tabular-nums opacity-80 sm:text-xs">
                    {chipCounts[filter.id]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      }
    >
      {error ? (
        <p className="mb-3 rounded-2xl px-3 py-2 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>
          {error}
        </p>
      ) : null}

      {visibleOrders.length === 0 ? (
        <EmptyState message={activeFilter.empty} />
      ) : usesCards(filterId) ? (
        <ul className="space-y-3">
          {visibleOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              open={selectedId === order.id}
              now={now}
              busyKey={busyKey}
              onToggle={() => setSelectedId(selectedId === order.id ? null : order.id)}
              onStatus={changeStatus}
              onMissing={markMissing}
            />
          ))}
        </ul>
      ) : (
        <OrderTable
          orders={visibleOrders}
          now={now}
          live={false}
          selectedId={selectedId}
          busyKey={busyKey}
          onSelect={setSelectedId}
          onStatus={changeStatus}
          onMissing={markMissing}
        />
      )}

      {showHistory ? (
        <section className="mt-10">
          <h2 className="font-display text-lg font-bold">Historial</h2>
          <p className="mt-1 text-sm text-brand-muted">Pedidos de días anteriores.</p>
          {historyOrders.length === 0 ? (
            <p className="mt-4 text-sm text-brand-muted">No hay pedidos anteriores para mostrar.</p>
          ) : (
            <div className="mt-4">
              <OrderTable
                orders={historyOrders}
                now={now}
                live={false}
                selectedId={selectedId}
                busyKey={busyKey}
                onSelect={setSelectedId}
                onStatus={changeStatus}
                onMissing={markMissing}
              />
            </div>
          )}
        </section>
      ) : null}
    </StaffChrome>
  );
}

function TodaySummary({
  nuevas,
  enProceso,
  urgentes,
}: {
  nuevas: number;
  enProceso: number;
  urgentes: number;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Hoy</p>
        <p className="mt-1 text-sm font-semibold" style={{ color: brand.ink }}>
          <span className="tabular-nums">{nuevas}</span> nuevas
          <span className="mx-2 text-brand-muted">·</span>
          <span className="tabular-nums">{enProceso}</span> en proceso
          {urgentes > 0 ? (
            <>
              <span className="mx-2 text-brand-muted">·</span>
              <span className="tabular-nums font-bold" style={{ color: ORDER_AGING.colors.urgent }}>
                {urgentes} urgente{urgentes === 1 ? "" : "s"}
              </span>
            </>
          ) : null}
        </p>
      </div>
    </div>
  );
}

function OrderCard({
  order,
  open,
  now,
  busyKey,
  onToggle,
  onStatus,
  onMissing,
}: {
  order: StaffOrder;
  open: boolean;
  now: number;
  busyKey: string | null;
  onToggle: () => void;
  onStatus: (orderId: string, estado: OrderEstado) => void;
  onMissing: (order: StaffOrder, item: StaffOrderItem) => void;
}) {
  const aging = usesOrderAging(order.estado);
  const agingLevel = aging ? orderAgingLevel(elapsedMinutes(order.createdAt, now)) : null;
  const stripe = agingLevel ? orderAgingColor(agingLevel) : stripeColor(order.estado);
  const quick = nextQuickAction(order.estado);

  return (
    <li
      className="overflow-hidden rounded-[28px] bg-white shadow-[0_10px_28px_rgba(26,26,26,0.08)]"
      style={{ borderLeft: `6px solid ${stripe}` }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-3 px-5 py-5 text-left"
        style={{ minHeight: 72 }}
      >
        <div className="min-w-0">
          <p className="font-display text-xl font-bold">
            #{formatOrderNumber(order.id)}
            {agingLevel === "urgent" ? (
              <span className="ml-1.5 text-base" aria-label="Pedido urgente">
                ⚠️
              </span>
            ) : null}
          </p>
          {aging && agingLevel ? (
            <>
              <p
                className="mt-1.5 font-mono text-2xl font-bold tabular-nums leading-none tracking-tight"
                style={{ color: orderAgingColor(agingLevel), minWidth: "8ch" }}
              >
                {formatElapsedClock(order.createdAt, now)}
              </p>
              <p className="mt-1 text-xs text-brand-muted">{formatWhen(order.createdAt)}</p>
            </>
          ) : (
            <>
              {order.updatedAt ? (
                <p className="mt-1.5 font-mono text-lg font-semibold tabular-nums text-brand-muted">
                  tardó {formatElapsedClock(order.createdAt, new Date(order.updatedAt).getTime())}
                </p>
              ) : null}
              <p className="mt-1 text-xs font-semibold text-brand-muted">{formatWhen(order.createdAt)}</p>
            </>
          )}
          <p className="mt-1 truncate text-sm text-brand-muted">{customerLabel(order)}</p>
        </div>
        <div className="text-right">
          <p
            className="inline-block rounded-full px-2.5 py-1 text-[11px] font-bold text-white"
            style={{ backgroundColor: statusColor(order.estado) }}
          >
            {orderStatusLabel(order.estado)}
          </p>
          <p className="mt-2 font-display text-lg font-bold">{order.totalLabel}</p>
        </div>
      </button>

      {quick ? (
        <div className="px-5 pb-4">
          <button
            type="button"
            disabled={busyKey === `status:${order.id}:${quick.estado}`}
            onClick={(event) => {
              event.stopPropagation();
              void unlockStaffAlerts();
              onStatus(order.id, quick.estado);
            }}
            className="w-full rounded-2xl px-3 py-3 text-sm font-bold text-white disabled:opacity-50"
            style={{ minHeight: 48, backgroundColor: brand.green }}
          >
            {quick.label}
          </button>
        </div>
      ) : null}

      {open ? (
        <OrderDetails order={order} busyKey={busyKey} onStatus={onStatus} onMissing={onMissing} />
      ) : null}
    </li>
  );
}

function OrderTable({
  orders,
  now,
  live,
  selectedId,
  busyKey,
  onSelect,
  onStatus,
  onMissing,
}: {
  orders: StaffOrder[];
  now: number;
  live: boolean;
  selectedId: string | null;
  busyKey: string | null;
  onSelect: (id: string | null) => void;
  onStatus: (orderId: string, estado: OrderEstado) => void;
  onMissing: (order: StaffOrder, item: StaffOrderItem) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-[24px] border" style={{ borderColor: "#E5E7EB" }}>
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="text-xs font-bold uppercase tracking-wide text-brand-muted" style={{ backgroundColor: "#F8FAF7" }}>
            <th className="px-4 py-3">Pedido</th>
            <th className="px-4 py-3">Cliente</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Tiempo</th>
            <th className="px-4 py-3 text-right">Total</th>
            <th className="px-4 py-3 text-right">Acción</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const open = selectedId === order.id;
            const aging = live && usesOrderAging(order.estado);
            const agingLevel = aging ? orderAgingLevel(elapsedMinutes(order.createdAt, now)) : null;
            const quick = nextQuickAction(order.estado);
            const timeLabel = aging
              ? formatElapsedClock(order.createdAt, now)
              : order.updatedAt
                ? `tardó ${formatElapsedClock(order.createdAt, new Date(order.updatedAt).getTime())}`
                : formatWhen(order.createdAt);
            return (
              <TableRowFragment
                key={order.id}
                order={order}
                open={open}
                agingLevel={agingLevel}
                timeLabel={timeLabel}
                quick={quick}
                busyKey={busyKey}
                onSelect={onSelect}
                onStatus={onStatus}
                onMissing={onMissing}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TableRowFragment({
  order,
  open,
  agingLevel,
  timeLabel,
  quick,
  busyKey,
  onSelect,
  onStatus,
  onMissing,
}: {
  order: StaffOrder;
  open: boolean;
  agingLevel: ReturnType<typeof orderAgingLevel> | null;
  timeLabel: string;
  quick: { estado: OrderEstado; label: string } | null;
  busyKey: string | null;
  onSelect: (id: string | null) => void;
  onStatus: (orderId: string, estado: OrderEstado) => void;
  onMissing: (order: StaffOrder, item: StaffOrderItem) => void;
}) {
  return (
    <>
      <tr className="border-t" style={{ borderColor: "#F3F4F6" }}>
        <td className="px-4 py-3">
          <button type="button" onClick={() => onSelect(open ? null : order.id)} className="text-left font-bold">
            #{formatOrderNumber(order.id)}
            {agingLevel === "urgent" ? " ⚠️" : ""}
          </button>
          <p className="text-xs text-brand-muted">{formatWhen(order.createdAt)}</p>
        </td>
        <td className="max-w-[140px] truncate px-4 py-3">{customerLabel(order)}</td>
        <td className="px-4 py-3">
          <span
            className="inline-block rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
            style={{ backgroundColor: statusColor(order.estado) }}
          >
            {orderStatusLabel(order.estado)}
          </span>
        </td>
        <td
          className="px-4 py-3 font-mono text-sm font-semibold tabular-nums"
          style={{ color: agingLevel ? orderAgingColor(agingLevel) : brand.muted }}
        >
          {timeLabel}
        </td>
        <td className="px-4 py-3 text-right font-bold">{order.totalLabel}</td>
        <td className="px-4 py-3 text-right">
          {quick ? (
            <button
              type="button"
              disabled={busyKey === `status:${order.id}:${quick.estado}`}
              onClick={() => onStatus(order.id, quick.estado)}
              className="rounded-full px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
              style={{ backgroundColor: brand.green, minHeight: 36 }}
            >
              {quick.label}
            </button>
          ) : (
            <span className="text-xs text-brand-muted">—</span>
          )}
        </td>
      </tr>
      {open ? (
        <tr style={{ backgroundColor: "#FFFFFF" }}>
          <td colSpan={6} className="px-2 pb-4">
            <OrderDetails order={order} busyKey={busyKey} onStatus={onStatus} onMissing={onMissing} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function OrderDetails({
  order,
  busyKey,
  onStatus,
  onMissing,
}: {
  order: StaffOrder;
  busyKey: string | null;
  onStatus: (orderId: string, estado: OrderEstado) => void;
  onMissing: (order: StaffOrder, item: StaffOrderItem) => void;
}) {
  return (
    <div className="px-5 pb-5">
      <div className="space-y-2 rounded-2xl px-4 py-4" style={{ backgroundColor: "#F8FAF7" }}>
        <InfoRow icon={<PinIcon />}>{order.direccion}</InfoRow>
        <InfoRow icon={order.metodoPago === "efectivo" ? <CashIcon /> : <CardIcon />}>
          {paymentLabel(order.metodoPago)}
        </InfoRow>
        <InfoRow icon={<PhoneIcon />}>{order.clienteTelefono}</InfoRow>
      </div>

      <ul className="mt-3 space-y-1">
        {order.items.map((item) => {
          const canMarkMissing = item.estado === "ok";
          return (
            <li key={item.id} className="flex items-center gap-2 py-2" style={{ minHeight: 44 }}>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold ${item.estado === "eliminado" ? "line-through text-brand-muted" : ""}`}>
                  {item.cantidad}× {item.nombre} <ItemPill estado={item.estado} />
                </p>
                <p className="text-xs text-brand-muted">{item.precioLabel}</p>
              </div>
              {canMarkMissing ? (
                <button
                  type="button"
                  disabled={busyKey === `missing:${item.id}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onMissing(order, item);
                  }}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base disabled:opacity-50"
                  style={{ backgroundColor: "#FFF4E5" }}
                  aria-label={`Marcar ${item.nombre} como faltante`}
                >
                  ⚠️
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {STATUS_ACTIONS.map((action) => {
          const active = order.estado === action.estado;
          return (
            <button
              key={action.estado}
              type="button"
              disabled={active || busyKey === `status:${order.id}:${action.estado}`}
              onClick={(event) => {
                event.stopPropagation();
                onStatus(order.id, action.estado);
              }}
              className="rounded-2xl px-3 py-3 text-sm font-bold disabled:opacity-50"
              style={{
                minHeight: 48,
                backgroundColor: active ? stripeColor(action.estado) : "#F3F4F6",
                color: active ? "#FFFFFF" : brand.ink,
              }}
            >
              {action.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StaffSearch({
  open,
  query,
  placeholder,
  onToggle,
  onChange,
}: {
  open: boolean;
  query: string;
  placeholder: string;
  onToggle: () => void;
  onChange: (value: string) => void;
}) {
  if (open) {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <input
          autoFocus
          value={query}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="h-11 w-full rounded-full border px-4 outline-none"
          style={{ borderColor: `${brand.green}80`, fontSize: 16 }}
        />
        <button
          type="button"
          onClick={() => {
            onChange("");
            onToggle();
          }}
          className="h-11 shrink-0 text-sm font-bold"
          style={{ color: brand.blue }}
        >
          Cerrar
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex h-11 w-11 items-center justify-center rounded-full"
      style={{ backgroundColor: "#F3F4F6" }}
      aria-label="Buscar"
    >
      <SearchIcon />
    </button>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-[28px] px-5 py-14 text-center" style={{ backgroundColor: "#F8FAF7" }}>
      <p className="text-4xl">🌿</p>
      <p className="font-display mt-3 text-xl font-bold">{message}</p>
    </div>
  );
}

function ItemPill({ estado }: { estado: OrderItemEstado }) {
  if (estado === "ok") {
    return (
      <span className="ml-1 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ backgroundColor: "#F3F4F6", color: brand.muted }}>
        {itemStatusLabel(estado)}
      </span>
    );
  }
  if (estado === "faltante") {
    return (
      <span className="ml-1 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ backgroundColor: brand.error }}>
        Faltante
      </span>
    );
  }
  return (
    <span className="ml-1 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ backgroundColor: "#F3F4F6", color: brand.muted }}>
      {itemStatusLabel(estado)}
    </span>
  );
}

function InfoRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-sm">
      <span className="mt-0.5 shrink-0" style={{ color: brand.green }}>
        {icon}
      </span>
      <span>{children}</span>
    </p>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke={brand.ink} strokeWidth="2.2">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.2-3.2" strokeLinecap="round" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M12 21s6-5.4 6-10a6 6 0 1 0-12 0c0 4.6 6 10 6 10z" />
      <circle cx="12" cy="11" r="2" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M7 3h4l1 5-2 1a12 12 0 0 0 5 5l1-2 5 1v4a2 2 0 0 1-2 2A16 16 0 0 1 5 7a2 2 0 0 1 2-2z" />
    </svg>
  );
}

function CardIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
    </svg>
  );
}

function CashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
      <rect x="3" y="7" width="18" height="10" rx="2" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}
