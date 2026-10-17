"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bar, CartesianGrid, ComposedChart, Line, LineChart, XAxis, YAxis } from "recharts";
import { daysRemaining, formatDaysRemaining } from "@/lib/admin-compras-shared";
import {
  formatPercent,
  formatRatio,
  formatSignedPrice,
  semaforoDisponible,
  type AdminDashboardData,
  type DashboardFactura,
  type DashboardProximoDia,
  type DashboardSparkPoint,
  type SemaforoNivel,
} from "@/lib/admin-dashboard-shared";
import { formatDayKey, todayDayKey } from "@/lib/local-day";
import { formatPrice } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";

const SEMAFORO: Record<
  SemaforoNivel,
  { badge: "success" | "warning" | "stop"; label: string; rail: string }
> = {
  ok: { badge: "success", label: "Dentro del presupuesto", rail: "border-l-primary" },
  cuidado: { badge: "warning", label: "Cuidado", rail: "border-l-warning" },
  stop: { badge: "stop", label: "Stop", rail: "border-l-destructive" },
};

const sparklineConfig = {
  value: { label: "Venta", color: "hsl(var(--foreground))" },
} satisfies ChartConfig;

const tendenciaConfig = {
  ventaReal: { label: "Venta real", color: "hsl(var(--chart-1))" },
  metaDelDia: { label: "Meta del día", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig;

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
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
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

      <TendenciaSection dias={data.tendencia7} proximos={data.proximos7 ?? []} chartReady={chartReady} />
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
  const tone = signed == null ? "text-foreground" : signed >= 0 ? "text-primary" : "text-destructive";
  const arrow = signed == null ? null : signed >= 0 ? "↑" : "↓";
  return (
    <Card className="min-w-0 shadow-sm">
      <CardHeader className="space-y-0 p-3 pb-0 sm:p-4 sm:pb-0">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">{label}</p>
      </CardHeader>
      <CardContent className="p-3 pt-1.5 sm:p-4 sm:pt-1.5">
        <p className={cn("text-[15px] font-semibold leading-tight tabular-nums sm:text-xl lg:text-2xl", tone)}>
          {arrow ? <span className="mr-1 text-base font-medium">{arrow}</span> : null}
          {value}
          {hint ? <span className="ml-1 text-sm font-medium text-muted-foreground">{hint}</span> : null}
        </p>
        {sparkline && sparkline.length > 0 ? (
          <Sparkline points={sparkline} cumulative={sparklineCumulative} ready={chartReady} />
        ) : null}
      </CardContent>
    </Card>
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
  if (!ready) {
    return <div className="mt-3 h-10 w-full" />;
  }
  return (
    <ChartContainer config={sparklineConfig} className="mt-3 aspect-auto h-10 w-full">
      <LineChart data={series} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <Line
          type="monotone"
          dataKey="value"
          stroke="var(--color-value)"
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
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
    <Card
      className={cn(
        "col-span-2 min-w-0 border-l-4 shadow-sm md:col-span-3 lg:col-span-2",
        tone.rail
      )}
    >
      <CardHeader className="flex-row items-start justify-between space-y-0 p-3 pb-0 sm:p-4 sm:pb-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
        <Badge
          variant={tone.badge}
          className="rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide shadow-none"
        >
          {tone.label}
        </Badge>
      </CardHeader>
      <CardContent className="p-3 pt-2 sm:p-4 sm:pt-2">
        <p className="text-2xl font-semibold leading-tight tabular-nums text-foreground sm:text-4xl lg:text-5xl">
          <span
            className={cn(
              "mr-1 text-lg font-medium sm:text-2xl lg:text-3xl",
              disponible >= 0 ? "text-primary" : "text-destructive"
            )}
          >
            {arrow}
          </span>
          {formatSignedPrice(disponible)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Presupuesto {formatPrice(presupuesto)}
          {compras != null ? ` · Compras ${formatPrice(compras)}` : null}
        </p>
      </CardContent>
    </Card>
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
    <Card className="shadow-sm">
      <CardHeader className="flex-row flex-wrap items-center justify-between space-y-0 p-5 pb-0">
        <CardTitle className="text-base font-semibold">Alertas</CardTitle>
        <Link href="/admin/compras" className="text-sm font-medium text-muted-foreground">
          Ver compras
        </Link>
      </CardHeader>
      <CardContent className="grid gap-3 p-5 pt-4 lg:grid-cols-2">
        <FacturaList title="Facturas vencidas" empty="No hay facturas vencidas" facturas={vencidas} tone="stop" />
        <FacturaList title="Por vencer en 3 días" empty="No hay facturas por vencer" facturas={porVencer} tone="cuidado" />
      </CardContent>
    </Card>
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
  const today = todayDayKey();

  return (
    <div
      className={cn(
        "rounded-lg border border-l-[3px] px-4 py-3",
        tone === "stop" ? "border-l-destructive" : "border-l-warning"
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
        {facturas.length > 0 ? ` · ${facturas.length}` : null}
      </p>
      {facturas.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {facturas.map((factura) => (
            <li key={factura.id}>
              <Link href="/admin/compras" className="flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{factura.proveedorNombre}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDayKey(factura.dueDate)} · {formatDaysRemaining(daysRemaining(factura.dueDate, today))}
                  </p>
                </div>
                <p className="shrink-0 font-semibold tabular-nums text-foreground">{formatPrice(factura.monto)}</p>
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
  proximos,
  chartReady,
}: {
  dias: AdminDashboardData["tendencia7"];
  proximos: DashboardProximoDia[];
  chartReady: boolean;
}) {
  const metaProximos = proximos.reduce((total, dia) => total + dia.metaDelDia, 0);
  const today = todayDayKey();

  return (
    <Card className="shadow-sm">
      <CardHeader className="space-y-1 p-5 pb-0">
        <CardTitle className="text-base font-semibold">Últimos 7 días</CardTitle>
        <CardDescription>Venta real vs meta del día, con el déficit o superávit acumulado del mes.</CardDescription>
      </CardHeader>
      <CardContent className="p-5 pt-4">
        {dias.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Todavía no hay días transcurridos en el mes activo.</p>
        ) : (
          <>
            {chartReady ? (
              <ChartContainer config={tendenciaConfig} className="aspect-auto h-52 w-full">
                <ComposedChart data={dias} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={64}
                    tickFormatter={(value: number) =>
                      new Intl.NumberFormat("es-DO", { notation: "compact", maximumFractionDigits: 1 }).format(value)
                    }
                  />
                  <ChartTooltip
                    cursor={{ fill: "hsl(var(--muted))" }}
                    content={
                      <ChartTooltipContent
                        formatter={(value, name) => (
                          <div className="flex w-full items-center justify-between gap-3">
                            <span className="text-muted-foreground">
                              {name === "ventaReal" ? "Venta real" : "Meta del día"}
                            </span>
                            <span className="font-mono font-medium tabular-nums text-foreground">
                              {formatPrice(typeof value === "number" ? value : Number(value) || 0)}
                            </span>
                          </div>
                        )}
                      />
                    }
                  />
                  <Bar
                    dataKey="ventaReal"
                    name="ventaReal"
                    fill="var(--color-ventaReal)"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={28}
                  />
                  <Line
                    type="monotone"
                    dataKey="metaDelDia"
                    name="metaDelDia"
                    stroke="var(--color-metaDelDia)"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "var(--color-metaDelDia)" }}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ChartContainer>
            ) : (
              <div className="h-52 w-full" />
            )}

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <th className="border-b border-border px-3 py-2 font-medium">Fecha</th>
                    <th className="border-b border-border px-3 py-2 text-right font-medium">Venta real</th>
                    <th className="border-b border-border px-3 py-2 text-right font-medium">Meta del día</th>
                    <th className="border-b border-border px-3 py-2 text-right font-medium">Diferencia</th>
                    <th className="border-b border-border px-3 py-2 text-right font-medium">Acum. del mes</th>
                  </tr>
                </thead>
                <tbody>
                  {dias.map((dia) => (
                    <tr key={dia.fecha}>
                      <td className="border-b border-muted px-3 py-2.5 font-medium text-foreground">{dia.label}</td>
                      <td className="border-b border-muted px-3 py-2.5 text-right tabular-nums text-foreground">
                        {formatPrice(dia.ventaReal)}
                      </td>
                      <td className="border-b border-muted px-3 py-2.5 text-right tabular-nums text-muted-foreground">
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

        <div className="mt-8 border-t border-border pt-5">
          <h3 className="text-base font-semibold text-foreground">Próximos 7 días</h3>
          <p className="mt-1 text-sm text-muted-foreground">Solo fechas y meta, para ver qué viene.</p>
          {proximos.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No hay metas cargadas para los próximos días.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[320px] text-left text-sm">
                <thead>
                  <tr className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <th className="border-b border-border px-3 py-2 font-medium">Fecha</th>
                    <th className="border-b border-border px-3 py-2 text-right font-medium">Meta</th>
                  </tr>
                </thead>
                <tbody>
                  {proximos.map((dia) => (
                    <tr key={dia.fecha}>
                      <td className="border-b border-muted px-3 py-2.5 font-medium text-foreground">
                        {dia.label}
                        {dia.fecha === today ? (
                          <span className="ml-2 text-xs font-medium text-muted-foreground">Hoy</span>
                        ) : null}
                      </td>
                      <td className="border-b border-muted px-3 py-2.5 text-right tabular-nums text-foreground">
                        {formatPrice(dia.metaDelDia)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="px-3 py-2.5 text-sm font-semibold text-foreground">Total 7 días</td>
                    <td className="px-3 py-2.5 text-right text-sm font-semibold tabular-nums text-foreground">
                      {formatPrice(metaProximos)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SignedCell({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <td
      className={cn(
        "border-b border-muted px-3 py-2.5 text-right font-medium tabular-nums",
        positive ? "text-primary" : "text-destructive"
      )}
    >
      {positive ? "↑ " : "↓ "}
      {formatSignedPrice(value)}
    </td>
  );
}
