"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatPercent, formatSignedPrice } from "@/lib/admin-dashboard-shared";
import { monthInputValue } from "@/lib/admin-parametros-shared";
import {
  chartMonths,
  formatChartMes,
  type MetaMesNivel,
  type VentasHistoricoDetalle,
  type VentasHistoricoResumen,
} from "@/lib/admin-ventas-historico-shared";
import { formatDayKey } from "@/lib/local-day";
import { formatPrice } from "@/lib/money";
import { brand } from "@/lib/theme";

type View = "resumen" | "detalle";

const NIVEL: Record<MetaMesNivel, { background: string; color: string }> = {
  ok: { background: brand.green, color: "#FFFFFF" },
  cuidado: { background: brand.orange, color: "#FFFFFF" },
  bajo: { background: brand.error, color: "#FFFFFF" },
};

const TABS: { id: View; label: string }[] = [
  { id: "resumen", label: "Resumen mensual" },
  { id: "detalle", label: "Detalle diario" },
];

export function AdminVentasHistorico() {
  const router = useRouter();
  const [view, setView] = useState<View>("resumen");
  const [resumen, setResumen] = useState<VentasHistoricoResumen | null>(null);
  const [detalle, setDetalle] = useState<VentasHistoricoDetalle | null>(null);
  const [mes, setMes] = useState("");
  const [loading, setLoading] = useState(true);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartReady, setChartReady] = useState(false);

  useEffect(() => {
    setChartReady(true);
  }, []);

  const loadResumen = useCallback(async () => {
    const response = await fetch("/api/admin/ventas/historico", { credentials: "include" });
    if (response.status === 401) {
      router.replace("/admin/login");
      return;
    }
    const body = (await response.json().catch(() => null)) as VentasHistoricoResumen | { error?: string } | null;
    if (!response.ok || !body || !("meses" in body)) {
      throw new Error((body && "error" in body && body.error) || "No pudimos cargar el histórico");
    }
    setResumen(body);
    setMes((current) => {
      if (current) {
        return current;
      }
      const activo = monthInputValue(body.mesActivo);
      if (body.meses.some((item) => monthInputValue(item.mes) === activo)) {
        return activo;
      }
      return monthInputValue(body.meses[0]?.mes ?? "");
    });
  }, [router]);

  const loadDetalle = useCallback(
    async (mesKey: string) => {
      if (!mesKey) {
        setDetalle(null);
        return;
      }
      const response = await fetch(`/api/admin/ventas/historico?mes=${encodeURIComponent(mesKey)}`, {
        credentials: "include",
      });
      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const body = (await response.json().catch(() => null)) as VentasHistoricoDetalle | { error?: string } | null;
      if (!response.ok || !body || !("dias" in body)) {
        throw new Error((body && "error" in body && body.error) || "No pudimos cargar el detalle del mes");
      }
      setDetalle(body);
    },
    [router]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await loadResumen();
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
  }, [loadResumen]);

  useEffect(() => {
    if (view !== "detalle" || !mes) {
      return;
    }
    let cancelled = false;
    (async () => {
      setDetalleLoading(true);
      try {
        await loadDetalle(mes);
        if (!cancelled) {
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Error al cargar el detalle");
        }
      } finally {
        if (!cancelled) {
          setDetalleLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [view, mes, loadDetalle]);

  const chartData = useMemo(
    () =>
      chartMonths(resumen?.meses ?? []).map((item) => ({
        label: formatChartMes(item.mes),
        ventasReales: item.ventasReales,
        meta: item.meta,
      })),
    [resumen]
  );

  const monthOptions = resumen?.meses ?? [];

  function openDetalle(mesValue: string) {
    setMes(monthInputValue(mesValue));
    setView("detalle");
  }

  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Ventas</p>
      <h1 className="font-display mt-1 text-2xl font-bold">Histórico</h1>
      <p className="mt-1 text-sm text-brand-muted">Ventas reales frente a la meta, mes a mes y día a día.</p>

      <div className="mt-5 flex flex-wrap gap-1.5">
        {TABS.map((tab) => {
          const active = view === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setView(tab.id)}
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

      {error ? (
        <p className="mt-4 rounded-2xl px-4 py-3 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>
          {error}
        </p>
      ) : null}

      {view === "resumen" ? (
        loading ? (
          <div className="mt-6 space-y-4">
            <div className="h-80 animate-pulse rounded-[24px] bg-gray-100" />
            <div className="h-64 animate-pulse rounded-[24px] bg-gray-100" />
          </div>
        ) : !resumen || resumen.meses.length === 0 ? (
          <div className="mt-6 rounded-[24px] px-5 py-10 text-center" style={{ backgroundColor: "#F8FAF7" }}>
            <p className="font-display text-xl font-bold">Todavía no hay meses con meta</p>
            <p className="mt-2 text-sm text-brand-muted">Cuando cargues una meta mensual, acá vas a ver el histórico.</p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <section className="rounded-[24px] border bg-white p-5" style={{ borderColor: "#E5E7EB" }}>
              <h2 className="font-display text-lg font-bold">Ventas reales vs meta</h2>
              <p className="mt-1 text-sm text-brand-muted">Últimos {Math.min(12, resumen.meses.length)} meses</p>
              <div className="mt-4 h-80 w-full">
                {chartReady ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis dataKey="label" tick={{ fontSize: 12, fill: brand.muted }} axisLine={false} tickLine={false} />
                      <YAxis
                        tick={{ fontSize: 12, fill: brand.muted }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={formatAxisMoney}
                        width={72}
                      />
                      <Tooltip
                        cursor={{ fill: "#F8FAF7" }}
                        formatter={(value) => formatPrice(typeof value === "number" ? value : 0)}
                        contentStyle={{ borderRadius: 16, borderColor: "#E5E7EB" }}
                      />
                      <Legend wrapperStyle={{ fontSize: 13 }} />
                      <Bar dataKey="ventasReales" name="Ventas reales" fill={brand.green} radius={[6, 6, 0, 0]} maxBarSize={28} />
                      <Bar dataKey="meta" name="Meta" fill={brand.blue} radius={[6, 6, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : null}
              </div>
            </section>

            <section className="overflow-x-auto rounded-[24px] border bg-white" style={{ borderColor: "#E5E7EB" }}>
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead>
                  <tr className="text-xs font-bold uppercase tracking-wide text-brand-muted" style={{ backgroundColor: "#F8FAF7" }}>
                    <th className="px-4 py-3">Mes</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right">Ventas reales</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right">Meta</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right">Diferencia</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right">% de meta</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right">Compras reales</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right">Ppto máx compras</th>
                  </tr>
                </thead>
                <tbody>
                  {resumen.meses.map((item, index) => (
                    <tr
                      key={item.mes}
                      className="cursor-pointer"
                      style={{ backgroundColor: index % 2 === 1 ? "#FAFBFA" : "#FFFFFF" }}
                      onClick={() => openDetalle(item.mes)}
                    >
                      <td className="px-4 py-3 font-semibold">
                        {item.label}
                        {resumen.mesActivo === item.mes ? (
                          <span
                            className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                            style={{ backgroundColor: brand.green }}
                          >
                            Activo
                          </span>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatPrice(item.ventasReales)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatPrice(item.meta)}</td>
                      <td
                        className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums"
                        style={{ color: item.diferencia >= 0 ? brand.green : brand.error }}
                      >
                        {formatSignedPrice(item.diferencia)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <NivelBadge nivel={item.nivel} value={formatPercent(item.porcentajeMeta)} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatPrice(item.comprasReales)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                        {formatPrice(item.presupuestoMaxCompras)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        )
      ) : (
        <div className="mt-6 space-y-4">
          <label className="block max-w-xs text-[13px] font-semibold text-brand-ink">
            Mes
            <select
              value={mes}
              onChange={(event) => setMes(event.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border bg-white px-3 text-sm font-medium outline-none focus:border-[#7EB341]"
              style={{ borderColor: "#E5E7EB", color: brand.ink }}
            >
              {monthOptions.length === 0 ? <option value="">Sin meses</option> : null}
              {monthOptions.map((item) => (
                <option key={item.mes} value={monthInputValue(item.mes)}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          {detalleLoading || loading ? (
            <div className="h-64 animate-pulse rounded-[24px] bg-gray-100" />
          ) : !detalle || detalle.dias.length === 0 ? (
            <div className="rounded-[24px] px-5 py-10 text-center" style={{ backgroundColor: "#F8FAF7" }}>
              <p className="font-display text-xl font-bold">No hay días para mostrar</p>
              <p className="mt-2 text-sm text-brand-muted">
                {detalle?.esMesActivo
                  ? "Este mes todavía no tiene días transcurridos."
                  : "Elegí un mes con meta para ver el detalle diario."}
              </p>
            </div>
          ) : (
            <section className="overflow-x-auto rounded-[24px] border bg-white" style={{ borderColor: "#E5E7EB" }}>
              <div className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3" style={{ backgroundColor: "#F8FAF7" }}>
                <h2 className="font-display text-lg font-bold">{detalle.label}</h2>
                {detalle.esMesActivo && detalle.hasta ? (
                  <p className="text-sm text-brand-muted">Hasta {formatDayKey(detalle.hasta)} — los días que faltan no se muestran.</p>
                ) : null}
              </div>
              <table className="w-full min-w-[780px] text-left text-sm">
                <thead>
                  <tr className="text-xs font-bold uppercase tracking-wide text-brand-muted" style={{ backgroundColor: "#F8FAF7" }}>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-4 py-3">Día</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right">Venta real</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right">Meta del día</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right">Diferencia</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right">Dif. acumulada</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right">Ventas acumuladas</th>
                  </tr>
                </thead>
                <tbody>
                  {detalle.dias.map((dia) => (
                    <tr
                      key={dia.fecha}
                      style={{
                        backgroundColor: dia.superado ? "#F4F9EC" : "#FEF2F2",
                      }}
                    >
                      <td className="whitespace-nowrap px-4 py-2.5 font-semibold">{formatDayKey(dia.fecha)}</td>
                      <td className="px-4 py-2.5">{dia.dia}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{formatPrice(dia.ventaReal)}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{formatPrice(dia.metaDelDia)}</td>
                      <td
                        className="whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums"
                        style={{ color: dia.diferencia >= 0 ? brand.green : brand.error }}
                      >
                        {formatSignedPrice(dia.diferencia)}
                      </td>
                      <td
                        className="whitespace-nowrap px-4 py-2.5 text-right font-semibold tabular-nums"
                        style={{ color: dia.diferenciaAcumulada >= 0 ? brand.green : brand.error }}
                      >
                        {formatSignedPrice(dia.diferenciaAcumulada)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right font-bold tabular-nums">
                        {formatPrice(dia.ventasAcumuladas)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function NivelBadge({ nivel, value }: { nivel: MetaMesNivel; value: string }) {
  const tone = NIVEL[nivel];
  return (
    <span
      className="inline-flex min-w-[4.5rem] items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums"
      style={{ backgroundColor: tone.background, color: tone.color }}
    >
      {value}
    </span>
  );
}

function formatAxisMoney(value: number): string {
  return new Intl.NumberFormat("es-DO", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number.isFinite(value) ? value : 0);
}
