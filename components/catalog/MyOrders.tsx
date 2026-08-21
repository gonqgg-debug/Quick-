"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CUSTOMER_PROGRESS_STEPS,
  customerProgressIndex,
  formatCustomerOrderDate,
  type CustomerOrder,
} from "@/lib/customer-orders-shared";
import { formatOrderNumber, orderStatusColor, orderStatusLabel } from "@/lib/order-display";
import { brand, whatsappHref } from "@/lib/theme";
import type { MetodoPago } from "@/lib/types";

type MyOrdersProps = {
  sessionId: string;
  onModify: (order: CustomerOrder) => void;
  onRequestProduct?: () => void;
};

export function MyOrders({ sessionId, onModify, onRequestProduct }: MyOrdersProps) {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/orders/mine?sessionId=${encodeURIComponent(sessionId)}`);
      const body = (await response.json()) as { orders?: CustomerOrder[]; error?: string };
      if (!response.ok) {
        throw new Error(body.error || "No pudimos cargar tus pedidos");
      }
      setOrders(body.orders ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No pudimos cargar tus pedidos");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <div className="mt-4 h-40 animate-pulse rounded-[24px] bg-gray-100" />;
  }

  if (error) {
    return (
      <p className="mt-4 rounded-2xl px-4 py-3 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>
        {error}
      </p>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="mt-6 rounded-[28px] px-5 py-14 text-center" style={{ backgroundColor: "#F8FAF7" }}>
        <p className="text-4xl">🧾</p>
        <p className="font-display mt-3 text-xl font-bold">Aún no tienes pedidos</p>
        <p className="mt-2 text-sm text-brand-muted">Cuando confirmes uno, aparece aquí con su estado.</p>
        {onRequestProduct ? (
          <button
            type="button"
            onClick={onRequestProduct}
            className="mt-4 text-sm font-semibold underline-offset-2 hover:underline"
            style={{ color: brand.muted }}
          >
            Solicitar un producto
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <>
    <ul className="mt-4 space-y-3">
      {orders.map((order) => {
        const open = openId === order.id;
        return (
          <li
            key={order.id}
            className="overflow-hidden rounded-[24px] border bg-white"
            style={{ borderColor: "#E5E7EB" }}
          >
            <button
              type="button"
              onClick={() => setOpenId(open ? null : order.id)}
              className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left"
            >
              <div className="min-w-0">
                <p className="font-display text-lg font-bold">#{formatOrderNumber(order.id)}</p>
                <p className="mt-0.5 text-xs text-brand-muted">{formatCustomerOrderDate(order.createdAt)}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-bold">{order.totalLabel}</p>
                <span
                  className="mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
                  style={{ backgroundColor: orderStatusColor(order.estado) }}
                >
                  {orderStatusLabel(order.estado)}
                </span>
              </div>
            </button>
            {open ? <OrderDetail order={order} onModify={onModify} /> : null}
          </li>
        );
      })}
    </ul>
    {onRequestProduct ? (
      <p className="mt-6 text-center">
        <button
          type="button"
          onClick={onRequestProduct}
          className="text-sm font-semibold underline-offset-2 hover:underline"
          style={{ color: brand.muted }}
        >
          Solicitar un producto
        </button>
      </p>
    ) : null}
    </>
  );
}

function OrderDetail({
  order,
  onModify,
}: {
  order: CustomerOrder;
  onModify: (order: CustomerOrder) => void;
}) {
  const canModify = order.estado === "nueva";
  const progress = customerProgressIndex(order.estado);
  const chatHref = `${whatsappHref()}?text=${encodeURIComponent(
    `Hola, necesito un cambio en mi pedido #${formatOrderNumber(order.id)}`
  )}`;
  const lockedMessage =
    order.estado === "cancelada"
      ? "Este pedido fue cancelado. Si necesitas ayuda, escríbenos por WhatsApp."
      : order.estado === "completada"
        ? "Este pedido ya fue entregado. Si necesitas algo más, escríbenos por WhatsApp."
        : "Tu pedido ya está en preparación. Si necesitas un cambio, escríbenos por WhatsApp.";

  return (
    <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: "#F3F4F6" }}>
      {order.estado === "cancelada" ? null : <ProgressBar current={progress} />}

      <ul className="mt-3 space-y-1.5">
        {order.items.map((item) => (
          <li key={item.id} className="flex items-baseline justify-between gap-3 text-sm">
            <span>
              {item.cantidad}× {item.nombre}
            </span>
            <span className="shrink-0 font-semibold">{item.precioLabel}</span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-sm">
        <span className="font-bold">Entrega: </span>
        {order.direccion}
      </p>
      <p className="mt-1 text-sm">
        <span className="font-bold">Pago: </span>
        {order.metodoPagoLabel}
      </p>

      {canModify ? (
        <button
          type="button"
          onClick={() => onModify(order)}
          className="mt-4 w-full rounded-full py-3 text-sm font-bold text-white"
          style={{ backgroundColor: brand.green, minHeight: 44 }}
        >
          Modificar pedido
        </button>
      ) : (
        <div className="mt-4 rounded-2xl px-4 py-3" style={{ backgroundColor: "#F8FAF7" }}>
          <p className="text-sm leading-relaxed text-brand-ink">{lockedMessage}</p>
          <a
            href={chatHref}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold text-white"
            style={{ backgroundColor: brand.green }}
          >
            Escribir por WhatsApp
          </a>
        </div>
      )}
    </div>
  );
}

function ProgressBar({ current }: { current: number }) {
  return (
    <ol className="flex items-start justify-between gap-1" aria-label="Progreso del pedido">
      {CUSTOMER_PROGRESS_STEPS.map((label, index) => {
        const done = index <= current;
        const active = index === current;
        return (
          <li key={label} className="flex min-w-0 flex-1 flex-col items-center text-center">
            <span
              className="flex h-2.5 w-full items-center"
              aria-hidden
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{
                  backgroundColor: done ? brand.green : "#E5E7EB",
                  boxShadow: active ? `0 0 0 3px ${brand.green}33` : undefined,
                }}
              />
              {index < CUSTOMER_PROGRESS_STEPS.length - 1 ? (
                <span
                  className="ml-1 h-0.5 min-w-0 flex-1 rounded-full"
                  style={{ backgroundColor: index < current ? brand.green : "#E5E7EB" }}
                />
              ) : null}
            </span>
            <span
              className="mt-1.5 text-[10px] font-bold leading-tight"
              style={{ color: done ? brand.ink : brand.muted }}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function orderToCart(order: CustomerOrder): Record<string, number> {
  const next: Record<string, number> = {};
  for (const item of order.items) {
    if (item.productId && item.cantidad > 0) {
      next[item.productId] = item.cantidad;
    }
  }
  return next;
}

export function orderMetodoPago(order: CustomerOrder): MetodoPago | null {
  return order.metodoPago === "efectivo" || order.metodoPago === "tarjeta" ? order.metodoPago : null;
}
