"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { formatOrderNumber, itemStatusLabel, orderStatusLabel } from "@/lib/order-display";
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

function statusColor(estado: OrderEstado): string {
  if (estado === "faltante_reportado" || estado === "cancelada") return "#DC2626";
  if (estado === "en_proceso" || estado === "despachada") return "#1F82C5";
  if (estado === "completada" || estado === "confirmada") return "#7EB341";
  return "#F79521";
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

export function StaffPanel() {
  const [password, setPassword] = useState("");
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [orders, setOrders] = useState<StaffOrder[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadOrders();
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
  }, [loadOrders]);

  useEffect(() => {
    if (!authorized) {
      return;
    }
    const timer = window.setInterval(() => {
      void loadOrders().catch(() => undefined);
    }, 20000);
    return () => window.clearInterval(timer);
  }, [authorized, loadOrders]);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setLoginError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/staff/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setLoginError(body?.error || "Contraseña incorrecta");
        return;
      }
      setPassword("");
      setError(null);
      await loadOrders();
    } catch {
      setLoginError("No pudimos iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/staff/logout", { method: "POST", credentials: "include" });
    setAuthorized(false);
    setOrders([]);
    setSelectedId(null);
  }

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
      await loadOrders();
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
      await loadOrders();
    } catch (missingError) {
      setError(missingError instanceof Error ? missingError.message : "Error al marcar faltante");
    } finally {
      setBusyKey(null);
    }
  }

  if (authorized === null) {
    return (
      <main className="min-h-screen bg-white px-4 py-10 text-center text-brand-muted">
        Cargando panel...
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="min-h-screen bg-white px-4 py-10" style={{ color: "#1A1A1A" }}>
        <div className="mx-auto w-full max-w-sm">
          <Logo className="h-14" />
          <h1 className="font-display mt-6 text-2xl font-bold">Panel del personal</h1>
          <p className="mt-2 text-sm text-brand-muted">Escribe la contraseña para ver los pedidos.</p>
          <form onSubmit={handleLogin} className="mt-6 space-y-3">
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Contraseña"
              className="w-full rounded-xl border px-4 py-3 text-base outline-none"
              style={{ borderColor: "#D1D5DB", fontSize: 16 }}
            />
            {loginError ? <p className="text-sm text-brand-error">{loginError}</p> : null}
            <button
              type="submit"
              disabled={loading || password.length === 0}
              className="w-full rounded-xl py-3 text-base font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: "#7EB341", minHeight: 48 }}
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white pb-16" style={{ color: "#1A1A1A" }}>
      <header className="sticky top-0 z-10 border-b bg-white px-4 py-3" style={{ borderColor: "#E5E7EB" }}>
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
          <div>
            <Logo className="h-10" />
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-brand-muted">
              Pedidos
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void loadOrders()}
              className="rounded-xl px-3 py-2 text-sm font-semibold"
              style={{ backgroundColor: "#F3F4F6", minHeight: 44 }}
            >
              Actualizar
            </button>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="rounded-xl px-3 py-2 text-sm font-semibold text-brand-muted"
              style={{ minHeight: 44 }}
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-xl px-4 py-4">
        {error ? (
          <p className="mb-3 rounded-xl px-3 py-2 text-sm" style={{ backgroundColor: "#FEE2E2", color: "#DC2626" }}>
            {error}
          </p>
        ) : null}

        {orders.length === 0 ? (
          <p className="rounded-2xl border border-dashed px-4 py-10 text-center text-brand-muted">
            Todavía no hay pedidos.
          </p>
        ) : (
          <ul className="space-y-3">
            {orders.map((order) => {
              const open = selectedId === order.id;
              const cliente = order.clienteNombre || order.clienteTelefono;
              return (
                <li
                  key={order.id}
                  className="overflow-hidden rounded-2xl border"
                  style={{ borderColor: "#E5E7EB" }}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(open ? null : order.id)}
                    className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left"
                    style={{ minHeight: 64 }}
                  >
                    <div>
                      <p className="font-display text-lg font-bold">#{formatOrderNumber(order.id)}</p>
                      <p className="text-sm text-brand-muted">{cliente}</p>
                      <p className="text-xs text-brand-muted">{formatWhen(order.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <p
                        className="inline-block rounded-full px-2 py-1 text-xs font-semibold text-white"
                        style={{ backgroundColor: statusColor(order.estado) }}
                      >
                        {orderStatusLabel(order.estado)}
                      </p>
                      <p className="mt-2 text-base font-bold">{order.totalLabel}</p>
                    </div>
                  </button>

                  {open ? (
                    <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: "#E5E7EB" }}>
                      <p className="text-sm">
                        <span className="text-brand-muted">Dirección: </span>
                        {order.direccion}
                      </p>
                      <p className="text-sm">
                        <span className="text-brand-muted">Pago: </span>
                        {paymentLabel(order.metodoPago)}
                      </p>
                      <p className="text-sm">
                        <span className="text-brand-muted">Teléfono: </span>
                        {order.clienteTelefono}
                      </p>

                      <ul className="mt-3 space-y-2">
                        {order.items.map((item) => {
                          const canMarkMissing = item.estado === "ok";
                          return (
                            <li
                              key={item.id}
                              className="rounded-xl px-3 py-3"
                              style={{ backgroundColor: "#F9FAFB" }}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="font-semibold">
                                    {item.cantidad}× {item.nombre}
                                  </p>
                                  <p className="text-sm text-brand-muted">
                                    {item.precioLabel} · {itemStatusLabel(item.estado)}
                                  </p>
                                </div>
                                {canMarkMissing ? (
                                  <button
                                    type="button"
                                    disabled={busyKey === `missing:${item.id}`}
                                    onClick={() => void markMissing(order, item)}
                                    className="shrink-0 rounded-xl px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                                    style={{ backgroundColor: "#DC2626", minHeight: 44 }}
                                  >
                                    Faltante
                                  </button>
                                ) : null}
                              </div>
                            </li>
                          );
                        })}
                      </ul>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        {STATUS_ACTIONS.map((action) => {
                          const active = order.estado === action.estado;
                          return (
                            <button
                              key={action.estado}
                              type="button"
                              disabled={active || busyKey === `status:${order.id}:${action.estado}`}
                              onClick={() => void changeStatus(order.id, action.estado)}
                              className="rounded-xl px-3 py-3 text-sm font-semibold disabled:opacity-50"
                              style={{
                                minHeight: 48,
                                backgroundColor: active ? statusColor(action.estado) : "#F3F4F6",
                                color: active ? "#FFFFFF" : "#1A1A1A",
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
      </div>
    </main>
  );
}
