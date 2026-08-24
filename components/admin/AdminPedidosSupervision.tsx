"use client";

import { useCallback, useEffect, useState } from "react";
import { formatPercent } from "@/lib/admin-dashboard-shared";
import {
  SUPERVISION_REFRESH_MS,
  type SupervisionData,
} from "@/lib/admin-pedidos-supervision-shared";
import { formatPrice } from "@/lib/money";
import {
  ORDER_AGING,
  elapsedMinutes,
  formatElapsedClock,
  formatElapsedMinutesLabel,
  orderAgingColor,
  orderAgingLevel,
} from "@/lib/order-aging";
import { orderStatusColor, orderStatusLabel } from "@/lib/order-display";
import { brand } from "@/lib/theme";

const INK = "#111827";
const MUTED = "#6B7280";

function emptyData(): SupervisionData {
  return {
    generatedAt: new Date().toISOString(),
    resumen: {
      nuevosSinAtender: 0,
      enProceso: 0,
      despachadosHoy: 0,
      completadosHoy: 0,
      canceladosHoy: 0,
    },
    cola: [],
    estancados: [],
    metricas: {
      pedidosCreadosHoy: 0,
      ticketPromedio: 0,
      tiempoPromedioDespachoMinutos: null,
      tasaCancelacion: 0,
    },
  };
}

export function AdminPedidosSupervision() {
  const [data, setData] = useState<SupervisionData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    try {
      const response = await fetch("/api/admin/pedidos/supervision", { credentials: "include", cache: "no-store" });
      if (response.status === 401) {
        window.location.replace("/admin/login");
        return;
      }
      const body = (await response.json().catch(() => null)) as (SupervisionData & { error?: string }) | null;
      if (!response.ok || !body || !("resumen" in body)) {
        throw new Error(body?.error || "No pudimos cargar la supervisión");
      }
      setData(body);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No pudimos cargar la supervisión");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(false);
    const refresh = window.setInterval(() => {
      void load(true);
    }, SUPERVISION_REFRESH_MS);
    const tick = window.setInterval(() => {
      setNow(Date.now());
    }, ORDER_AGING.tickMs);
    return () => {
      window.clearInterval(refresh);
      window.clearInterval(tick);
    };
  }, [load]);

  if (loading && !data) {
    return <div className="h-64 animate-pulse rounded-lg bg-gray-100" />;
  }

  const view = data ?? emptyData();

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide" style={{ color: MUTED }}>
          Pedidos
        </p>
        <h1 className="mt-1 text-2xl font-semibold" style={{ color: INK }}>
          Supervisión
        </h1>
      </div>

      {error ? (
        <p className="rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>
          {error}
        </p>
      ) : null}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Nuevos sin atender" value={String(view.resumen.nuevosSinAtender)} accent={view.resumen.nuevosSinAtender > 0 ? "#D97706" : INK} />
        <StatCard label="En proceso" value={String(view.resumen.enProceso)} />
        <StatCard label="Despachados hoy" value={String(view.resumen.despachadosHoy)} />
        <StatCard label="Completados hoy" value={String(view.resumen.completadosHoy)} />
        <StatCard
          label="Cancelados hoy"
          value={String(view.resumen.canceladosHoy)}
          accent={view.resumen.canceladosHoy > 0 ? brand.error : INK}
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold" style={{ color: INK }}>
          Cola activa
        </h2>
        {view.cola.length === 0 ? (
          <p className="mt-3 rounded-lg border border-[#E5E7EB] bg-white px-5 py-10 text-center text-base" style={{ color: MUTED }}>
            No hay pedidos activos.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {view.cola.map((pedido) => {
              const agingLevel = orderAgingLevel(elapsedMinutes(pedido.createdAt, now));
              const stripe = orderAgingColor(agingLevel);
              return (
                <li
                  key={pedido.id}
                  className="rounded-lg border border-[#E5E7EB] bg-white shadow-sm"
                  style={{ borderLeftWidth: 6, borderLeftColor: stripe }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-xl font-semibold tabular-nums" style={{ color: INK }}>
                        #{pedido.numero}
                      </p>
                      <p className="mt-0.5 truncate text-sm font-medium" style={{ color: INK }}>
                        {pedido.clienteNombre || pedido.clienteTelefono}
                        {pedido.clienteNombre ? (
                          <span className="font-normal" style={{ color: MUTED }}>
                            {" "}
                            · {pedido.clienteTelefono}
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate text-sm" style={{ color: MUTED }}>
                        {pedido.direccion}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                      <span
                        className="rounded-full px-2.5 py-1 text-sm font-semibold"
                        style={{ backgroundColor: `${orderStatusColor(pedido.estado)}22`, color: orderStatusColor(pedido.estado) }}
                      >
                        {orderStatusLabel(pedido.estado)}
                      </span>
                      <p className="text-lg font-semibold tabular-nums" style={{ color: INK }}>
                        {formatPrice(pedido.totalEstimado)}
                      </p>
                      <p
                        className="font-mono text-2xl font-bold tabular-nums leading-none"
                        style={{ color: stripe, minWidth: "5.5ch" }}
                      >
                        {formatElapsedClock(pedido.createdAt, now)}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold" style={{ color: INK }}>
          Estancados
        </h2>
        {view.estancados.length === 0 ? (
          <p className="mt-3 rounded-lg border border-[#E5E7EB] bg-white px-5 py-10 text-center text-base" style={{ color: MUTED }}>
            Todo fluye con normalidad
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {view.estancados.map((pedido) => (
              <li
                key={pedido.id}
                className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-3 shadow-sm"
                style={{ borderLeftWidth: 6, borderLeftColor: brand.error }}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xl font-semibold tabular-nums" style={{ color: INK }}>
                      #{pedido.numero}
                    </p>
                    <p className="text-sm" style={{ color: MUTED }}>
                      {pedido.clienteNombre || pedido.clienteTelefono} · {orderStatusLabel(pedido.estado)}
                    </p>
                  </div>
                  <p className="text-2xl font-bold tabular-nums" style={{ color: brand.error }}>
                    {formatElapsedMinutesLabel(pedido.updatedAt, now)} sin avance
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold" style={{ color: INK }}>
          Métricas del día
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Pedidos creados" value={String(view.metricas.pedidosCreadosHoy)} />
          <StatCard label="Ticket promedio" value={formatPrice(view.metricas.ticketPromedio)} />
          <StatCard
            label="Tiempo promedio de despacho"
            value={
              view.metricas.tiempoPromedioDespachoMinutos == null
                ? "—"
                : `${Math.round(view.metricas.tiempoPromedioDespachoMinutos)} min`
            }
          />
          <StatCard label="Tasa de cancelación" value={formatPercent(view.metricas.tasaCancelacion)} />
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, accent = INK }: { label: string; value: string; accent?: string }) {
  return (
    <section className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide" style={{ color: MUTED }}>
        {label}
      </p>
      <p className="mt-2 text-4xl font-semibold tabular-nums sm:text-5xl" style={{ color: accent }}>
        {value}
      </p>
    </section>
  );
}
