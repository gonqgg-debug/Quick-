"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { daysRemaining, formatDaysRemaining } from "@/lib/admin-compras-shared";
import {
  formatPercent,
  formatRatio,
  formatSignedPrice,
  semaforoDisponible,
  type AdminDashboardData,
  type DashboardFactura,
  type DashboardSparkPoint,
  type SemaforoNivel,
} from "@/lib/admin-dashboard-shared";
import { formatDayKey, todayDayKey } from "@/lib/local-day";
import { formatPrice } from "@/lib/money";

const INK = "#111827";
const MUTED = "#6B7280";
const BORDER = "#E5E7EB";
const GREEN = "#059669";
const RED = "#DC2626";
const ORANGE = "#D97706";
const BAR = "#374151";
const META_LINE = "#9CA3AF";

const SEMAFORO: Record<SemaforoNivel, { accent: string; label: string }> = {
  ok: { accent: GREEN, label: "Dentro del presupuesto" },
  cuidado: { accent: ORANGE, label: "Cuidado" },
  stop: { accent: RED, label: "Stop" },
};

export function AdminDashboard({ data }: { data: AdminDashboardData }) {
  const [chartReady, setChartReady] = useState(false);
  useEffect(() => {
    setChartReady(true);
  }, []);

  const mesNivel = semaforoDisponible(
    data.disponibleMes,
    data.presupuestoMaximoMes,
    data.umbralCuidado,
    data.umbralStop
  );
  const semanaNivel = semaforoDisponible(
    data.disponibleSemana,
    data.presupuestoSemana,
    data.umbralCuidado,
    data.umbralStop
  );

  return (
    <div className="mt-6 space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Ventas acumuladas"
          value={formatPrice(data.ventasAcumuladas)}
          sparkline={data.sparkline14}
          chartReady={chartReady}
        />
        <MetricCard label="Meta del mes" value={formatPrice(data.metaMensual)} />
        <MetricCard
          label="Diferencia"
          value={formatSignedPrice(data.diferenciaVsMeta)}
          signed={data.diferenciaVsMeta}
        />
        <MetricCard
          label="% de meta"
          value={formatPercent(data.porcentajeMeta)}
          signed={data.porcentajeMeta >= 1 ? 1 : data.porcentajeMeta - 1}
        />
        <MetricCard
          label="Forecast cierre mes"
          value={formatPrice(data.forecastCierreMes)}
          sparkline={data.sparkline14}
          sparklineCumulative
          chartReady={chartReady}
        />
        <MetricCard
          label="Días restantes"
          value={String(data.diasRestantes)}
          hint={data.diasRestantes === 1 ? "día" : "días"}
        />
        <MetricCard label="Compras realizadas" value={formatPrice(data.comprasDelMes)} />
        <MetricCard label="Ratio compras/ventas" value={formatRatio(data.ratioComprasVentas)} />
        <DisponibleCard
          title="Disponible mes"
          disponible={data.disponibleMes}
          presupuesto={data.presupuestoMaximoMes}
          nivel={mesNivel}
        />
        <DisponibleCard
          title="Disponible semana"
          disponible={data.disponibleSemana}
          presupuesto={data.presupuestoSemana}
          compras={data.comprasSemana}
          nivel={semanaNivel}
        />
      </div>

      <AlertasSection vencidas={data.facturasVencidas} porVencer={data.facturasPorVencer} />

      <TendenciaSection dias={data.tendencia7} chartReady={chartReady} />
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  signed,
  sparkline,
  sparklineCumulative = false,
  chartReady = false,
}: {
  label: string;
  value: string;
  hint?: string;
  signed?: number;
  sparkline?: DashboardSparkPoint[];
  sparklineCumulative?: boolean;
  chartReady?: boolean;
}) {
  const tone = signed == null ? INK : signed >= 0 ? GREEN : RED;
  const arrow = signed == null ? null : signed >= 0 ? "↑" : "↓";
  return (
    <section className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide" style={{ color: MUTED }}>
        {label}
      </p>
      <p className="mt-1.5 text-xl font-semibold tabular-nums sm:text-2xl" style={{ color: tone }}>
        {arrow ? <span className="mr-1 text-base font-medium">{arrow}</span> : null}
        {value}
        {hint ? (
          <span className="ml-1 text-sm font-medium" style={{ color: MUTED }}>
            {hint}
          </span>
        ) : null}
      </p>
      {sparkline && sparkline.length > 0 ? (
        <Sparkline points={sparkline} cumulative={sparklineCumulative} ready={chartReady} />
      ) : null}
    </section>
  );
}

function Sparkline({
  points,
  cumulative,
  ready,
}: {
  points: DashboardSparkPoint[];
  cumulative: boolean;
  ready: boolean;
}) {
  let running = 0;
  const series = points.map((point) => {
    running += point.ventaReal;
    return { fecha: point.fecha, value: cumulative ? running : point.ventaReal };
  });
  return (
    <div className="mt-3 h-10 w-full">
      {ready ? (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <Line type="monotone" dataKey="value" stroke={INK} strokeWidth={1.5} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      ) : null}
    </div>
  );
}

function DisponibleCard({
  title,
  disponible,
  presupuesto,
  compras,
  nivel,
}: {
  title: string;
  disponible: number;
  presupuesto: number;
  compras?: number;
  nivel: SemaforoNivel;
}) {
  const tone = SEMAFORO[nivel];
  const arrow = disponible >= 0 ? "↑" : "↓";
  return (
    <section
      className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-4 shadow-sm lg:col-span-2"
      style={{ borderLeftWidth: 4, borderLeftColor: tone.accent }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide" style={{ color: MUTED }}>
          {title}
        </p>
        <span
          className="rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide"
          style={{ borderColor: `${tone.accent}55`, color: tone.accent }}
        >
          {tone.label}
        </span>
      </div>
      <p className="mt-2 text-4xl font-semibold tabular-nums sm:text-5xl" style={{ color: INK }}>
        <span className="mr-1 text-2xl font-medium sm:text-3xl" style={{ color: disponible >= 0 ? GREEN : RED }}>
          {arrow}
        </span>
        {formatSignedPrice(disponible)}
      </p>
      <p className="mt-1 text-xs" style={{ color: MUTED }}>
        Presupuesto {formatPrice(presupuesto)}
        {compras != null ? ` · Compras ${formatPrice(compras)}` : null}
      </p>
    </section>
  );
}

function AlertasSection({
  vencidas,
  porVencer,
}: {
  vencidas: DashboardFactura[];
  porVencer: DashboardFactura[];
}) {
  return (
    <section className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold" style={{ color: INK }}>
          Alertas
        </h2>
        <Link href="/admin/compras" className="text-sm font-medium" style={{ color: MUTED }}>
          Ver compras
        </Link>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <FacturaList title="Facturas vencidas" empty="No hay facturas vencidas" facturas={vencidas} tone="stop" />
        <FacturaList title="Por vencer en 3 días" empty="No hay facturas por vencer" facturas={porVencer} tone="cuidado" />
      </div>
    </section>
  );
}

function FacturaList({
  title,
  empty,
  facturas,
  tone,
}: {
  title: string;
  empty: string;
  facturas: DashboardFactura[];
  tone: Exclude<SemaforoNivel, "ok">;
}) {
  const color = SEMAFORO[tone].accent;
  const today = todayDayKey();

  return (
    <div className="rounded-lg border border-[#E5E7EB] px-4 py-3" style={{ borderLeftWidth: 3, borderLeftColor: color }}>
      <p className="text-xs font-medium uppercase tracking-wide" style={{ color: MUTED }}>
        {title}
        {facturas.length > 0 ? ` · ${facturas.length}` : null}
      </p>
      {facturas.length === 0 ? (
        <p className="mt-2 text-sm" style={{ color: MUTED }}>
          {empty}
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {facturas.map((factura) => (
            <li key={factura.id}>
              <Link href="/admin/compras" className="flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium" style={{ color: INK }}>
                    {factura.proveedorNombre}
                  </p>
                  <p className="text-xs" style={{ color: MUTED }}>
                    {formatDayKey(factura.dueDate)} · {formatDaysRemaining(daysRemaining(factura.dueDate, today))}
                  </p>
                </div>
                <p className="shrink-0 font-semibold tabular-nums" style={{ color: INK }}>
                  {formatPrice(factura.monto)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TendenciaSection({
  dias,
  chartReady,
}: {
  dias: AdminDashboardData["tendencia7"];
  chartReady: boolean;
}) {
  return (
    <section className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold" style={{ color: INK }}>
        Últimos 7 días
      </h2>
      <p className="mt-1 text-sm" style={{ color: MUTED }}>
        Venta real vs meta del día, con el déficit o superávit acumulado del mes.
      </p>

      {dias.length === 0 ? (
        <p className="mt-6 text-sm" style={{ color: MUTED }}>
          Todavía no hay días transcurridos en el mes activo.
        </p>
      ) : (
        <>
          <div className="mt-4 h-52 w-full">
            {chartReady ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dias} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={BORDER} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: MUTED }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: MUTED }}
                    axisLine={false}
                    tickLine={false}
                    width={64}
                    tickFormatter={(value: number) =>
                      new Intl.NumberFormat("es-DO", { notation: "compact", maximumFractionDigits: 1 }).format(value)
                    }
                  />
                  <Tooltip
                    cursor={{ fill: "#F9FAFB" }}
                    formatter={(value, name) => [
                      formatPrice(typeof value === "number" ? value : 0),
                      name === "ventaReal" ? "Venta real" : "Meta del día",
                    ]}
                    contentStyle={{ borderRadius: 8, borderColor: BORDER, fontSize: 13 }}
                  />
                  <Bar dataKey="ventaReal" name="ventaReal" fill={BAR} radius={[3, 3, 0, 0]} maxBarSize={28} />
                  <Line
                    type="monotone"
                    dataKey="metaDelDia"
                    name="metaDelDia"
                    stroke={META_LINE}
                    strokeWidth={2}
                    dot={{ r: 3, fill: META_LINE }}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : null}
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="text-xs font-medium uppercase tracking-wide" style={{ color: MUTED }}>
                  <th className="border-b border-[#E5E7EB] px-3 py-2 font-medium">Fecha</th>
                  <th className="border-b border-[#E5E7EB] px-3 py-2 text-right font-medium">Venta real</th>
                  <th className="border-b border-[#E5E7EB] px-3 py-2 text-right font-medium">Meta del día</th>
                  <th className="border-b border-[#E5E7EB] px-3 py-2 text-right font-medium">Diferencia</th>
                  <th className="border-b border-[#E5E7EB] px-3 py-2 text-right font-medium">Acum. del mes</th>
                </tr>
              </thead>
              <tbody>
                {dias.map((dia) => (
                  <tr key={dia.fecha}>
                    <td className="border-b border-[#F3F4F6] px-3 py-2.5 font-medium" style={{ color: INK }}>
                      {dia.label}
                    </td>
                    <td className="border-b border-[#F3F4F6] px-3 py-2.5 text-right tabular-nums" style={{ color: INK }}>
                      {formatPrice(dia.ventaReal)}
                    </td>
                    <td className="border-b border-[#F3F4F6] px-3 py-2.5 text-right tabular-nums" style={{ color: MUTED }}>
                      {formatPrice(dia.metaDelDia)}
                    </td>
                    <SignedCell value={dia.diferencia} />
                    <SignedCell value={dia.acumuladoMes} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function SignedCell({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <td
      className="border-b border-[#F3F4F6] px-3 py-2.5 text-right font-medium tabular-nums"
      style={{ color: positive ? GREEN : RED }}
    >
      {positive ? "↑ " : "↓ "}
      {formatSignedPrice(value)}
    </td>
  );
}
