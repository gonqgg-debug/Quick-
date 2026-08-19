"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { StaffChrome } from "@/components/staff/StaffChrome";
import { StaffLogin, staffLogout } from "@/components/staff/StaffLogin";
import { formatOrderNumber, itemStatusLabel, orderStatusLabel } from "@/lib/order-display";
import { brand } from "@/lib/theme";
import { formatElapsedAgo } from "@/lib/time";
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
    empty: "Todo al día 🎉 No hay pedidos nuevos ahora mismo",
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
    empty: "No hay pedidos en camino ahora mismo.",
  },
  {
    id: "completada",
    label: "Completadas",
    match: (estado) => estado === "completada" || estado === "cancelada",
    empty: "Todavía no hay pedidos cerrados.",
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

function needsLiveTimer(estado: OrderEstado): boolean {
  return estado === "nueva" || estado === "en_proceso" || estado === "confirmada";
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

  useEffect(() => {
    if (!authorized) {
      return;
    }
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 30000);
    return () => window.clearInterval(timer);
  }, [authorized]);

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

  const activeFilter = FILTERS.find((filter) => filter.id === filterId) ?? FILTERS[0];
  const chipCounts = useMemo(() => {
    const counts: Record<FilterId, number> = {
      nueva: 0,
      en_proceso: 0,
      despachada: 0,
      completada: 0,
    };
    for (const order of orders) {
      for (const filter of FILTERS) {
        if (filter.match(order.estado)) {
          counts[filter.id] += 1;
        }
      }
    }
    return counts;
  }, [orders]);

  const visibleOrders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return orders.filter((order) => {
      if (!activeFilter.match(order.estado)) {
        return false;
      }
      if (!query) {
        return true;
      }
      const haystack = [
        formatOrderNumber(order.id),
        order.id,
        order.clienteNombre ?? "",
        order.clienteTelefono,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [orders, activeFilter, searchQuery]);

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
        <StaffSearch
          open={searchOpen}
          query={searchQuery}
          placeholder="Buscar pedido o cliente"
          onToggle={() => setSearchOpen((current) => !current)}
          onChange={setSearchQuery}
        />
      }
      filters={
        <div className="-mx-3 flex gap-2 overflow-x-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FILTERS.map((filter) => {
            const active = filter.id === filterId;
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => setFilterId(filter.id)}
                className="shrink-0 rounded-full px-3.5 py-2 text-sm font-bold"
                style={{
                  minHeight: 44,
                  backgroundColor: active ? brand.green : "#FFFFFF",
                  color: active ? "#FFFFFF" : brand.ink,
                  border: active ? "none" : "1px solid #E5E7EB",
                }}
              >
                {filter.label} ({chipCounts[filter.id]})
              </button>
            );
          })}
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
      ) : (
        <ul className="space-y-3">
          {visibleOrders.map((order) => {
            const open = selectedId === order.id;
            const cliente = order.clienteNombre || order.clienteTelefono;
            const stripe = stripeColor(order.estado);
            return (
              <li
                key={order.id}
                className="overflow-hidden rounded-[28px] bg-white shadow-[0_10px_28px_rgba(26,26,26,0.08)]"
                style={{ borderLeft: `6px solid ${stripe}` }}
              >
                <button
                  type="button"
                  onClick={() => setSelectedId(open ? null : order.id)}
                  className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left"
                  style={{ minHeight: 72 }}
                >
                  <div className="min-w-0">
                    <p className="font-display text-xl font-bold">#{formatOrderNumber(order.id)}</p>
                    <p className="truncate text-sm text-brand-muted">{cliente}</p>
                    <p className="mt-1 text-xs font-semibold" style={{ color: needsLiveTimer(order.estado) ? brand.orange : brand.muted }}>
                      {needsLiveTimer(order.estado)
                        ? formatElapsedAgo(order.createdAt, now)
                        : formatWhen(order.createdAt)}
                    </p>
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

                {open ? (
                  <div className="px-4 pb-4">
                    <div className="space-y-2 rounded-2xl px-3 py-3" style={{ backgroundColor: "#F8FAF7" }}>
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
                                {item.cantidad}× {item.nombre}{" "}
                                <ItemPill estado={item.estado} />
                              </p>
                              <p className="text-xs text-brand-muted">{item.precioLabel}</p>
                            </div>
                            {canMarkMissing ? (
                              <button
                                type="button"
                                disabled={busyKey === `missing:${item.id}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void markMissing(order, item);
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
                              void changeStatus(order.id, action.estado);
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
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </StaffChrome>
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
      <div className="flex items-center gap-2">
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
    <div className="flex justify-end">
      <button
        type="button"
        onClick={onToggle}
        className="flex h-11 w-11 items-center justify-center rounded-full"
        style={{ backgroundColor: "#F3F4F6" }}
        aria-label="Buscar"
      >
        <SearchIcon />
      </button>
    </div>
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
