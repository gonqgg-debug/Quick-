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
import { formatUsd } from "@/lib/admin-caja-shared";
import { monthInputValue } from "@/lib/admin-parametros-shared";
import {
  reporteMesInput,
  type ReporteConteo,
  type ReporteDetalle,
  type ReporteFinanciero,
  type ReporteMes,
  type ReporteMovimiento,
  type ReporteProveedor,
} from "@/lib/admin-reporte-shared";
import { formatDayKey } from "@/lib/local-day";
import { formatPrice } from "@/lib/money";
import { brand } from "@/lib/theme";
import { AdminSelect, adminLabelClass } from "@/components/admin/AdminField";
import {
  DataTable,
  DataTableCell,
  DataTableHead,
  DataTableRow,
  DataTableTh,
} from "@/components/admin/DataTable";

type DeltaTone = "upGood" | "upBad";

export function AdminReporte() {
  const router = useRouter();
  const [reporte, setReporte] = useState<ReporteFinanciero | null>(null);
  const [mes, setMes] = useState("");
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartReady, setChartReady] = useState(false);

  useEffect(() => {
    setChartReady(true);
  }, []);

  const load = useCallback(
    async (mesKey?: string) => {
      const url = mesKey ? `/api/admin/reporte?mes=${encodeURIComponent(mesKey)}` : "/api/admin/reporte";
      const response = await fetch(url, { credentials: "include" });
      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const body = (await response.json().catch(() => null)) as ReporteFinanciero | { error?: string } | null;
      if (!response.ok || !body || !("meses" in body)) {
        throw new Error((body && "error" in body && body.error) || "No pudimos armar el reporte");
      }
      setReporte(body);
      setMes(body.detalle ? reporteMesInput(body.detalle.mes) : "");
      setError(null);
    },
    [router]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await load();
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
  }, [load]);

  async function selectMes(next: string) {
    if (!next || next === mes) {
      return;
    }
    setMes(next);
    setSwitching(true);
    try {
      await load(next);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Error al cargar el mes");
    } finally {
      setSwitching(false);
    }
  }

  const chartData = useMemo(
    () =>
      [...(reporte?.meses ?? [])]
        .slice(0, 12)
        .reverse()
        .map((item) => ({
          label: shortMonthLabel(item.label),
          ventas: item.ventas,
          compras: item.compras,
          resultado: item.resultado,
        })),
    [reporte]
  );

  const detalle = reporte?.detalle ?? null;
  const topeCompras = reporte && reporte.ratioRecompra > 0 ? 1 / reporte.ratioRecompra : 0;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Finanzas</p>
          <h1 className="font-display mt-1 text-2xl font-bold">Reporte mensual</h1>
          <p className="mt-1 max-w-2xl text-sm text-brand-muted">
            Ventas de tienda, compras a proveedores, movimientos de caja y pedidos de delivery, mes a mes. El
            delivery no se suma a la venta diaria.
          </p>
        </div>
        <a
          href="/api/admin/reporte/export"
          className="rounded-full px-4 py-2 text-sm font-semibold text-white"
          style={{ backgroundColor: brand.green }}
        >
          Descargar Excel
        </a>
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl px-4 py-3 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="mt-6 space-y-4">
          <div className="h-28 animate-pulse rounded-lg bg-gray-100" />
          <div className="h-80 animate-pulse rounded-lg bg-gray-100" />
        </div>
      ) : !reporte || reporte.meses.length === 0 ? (
        <div className="mt-6 rounded-lg px-5 py-10 text-center" style={{ backgroundColor: "#F8FAF7" }}>
          <p className="font-display text-xl font-bold">Todavía no hay movimiento</p>
          <p className="mt-2 text-sm text-brand-muted">
            Cuando cargues ventas, compras o caja, el resumen mensual aparece acá.
          </p>
        </div>
      ) : (
        <div className={`mt-6 space-y-4 ${switching ? "opacity-60" : ""}`}>
          <label className={`${adminLabelClass} max-w-xs`}>
            Mes
            <AdminSelect value={mes} onChange={(event) => void selectMes(event.target.value)}>
              {reporte.meses.map((item) => (
                <option key={item.mes} value={monthInputValue(item.mes)}>
                  {item.label}
                </option>
              ))}
            </AdminSelect>
          </label>

          {detalle ? (
            <MonthSummary detalle={detalle} topeCompras={topeCompras} mesActivo={reporte.mesActivo} tasaUsdDop={reporte.tasaUsdDop} />
          ) : null}

          <section className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
            <h2 className="font-display text-lg font-bold">Ventas, compras y resultado</h2>
            <p className="mt-1 text-sm text-brand-muted">Últimos {Math.min(12, reporte.meses.length)} meses</p>
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
                    <Bar dataKey="ventas" name="Ventas" fill={brand.green} radius={[6, 6, 0, 0]} maxBarSize={22} />
                    <Bar dataKey="compras" name="Compras" fill={brand.blue} radius={[6, 6, 0, 0]} maxBarSize={22} />
                    <Bar dataKey="resultado" name="Ventas − compras" fill={brand.orange} radius={[6, 6, 0, 0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              ) : null}
            </div>
          </section>

          <DataTable tableClassName="min-w-[880px]">
            <DataTableHead>
              <DataTableTh>Mes</DataTableTh>
              <DataTableTh numeric>Ventas</DataTableTh>
              <DataTableTh numeric>Compras</DataTableTh>
              <DataTableTh numeric>Ventas − compras</DataTableTh>
              <DataTableTh numeric>Delivery</DataTableTh>
              <DataTableTh numeric>Salidas de caja</DataTableTh>
            </DataTableHead>
            <tbody>
              {reporte.meses.map((item) => {
                const selected = monthInputValue(item.mes) === mes;
                return (
                  <DataTableRow
                    key={item.mes}
                    onClick={() => void selectMes(monthInputValue(item.mes))}
                    className={selected ? "bg-[#F8FAF7]" : undefined}
                  >
                    <DataTableCell className="font-semibold">
                      {item.label}
                      {reporte.mesActivo === item.mes ? (
                        <span
                          className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                          style={{ backgroundColor: brand.green }}
                        >
                          Activo
                        </span>
                      ) : null}
                    </DataTableCell>
                    <DataTableCell numeric>{formatPrice(item.ventas)}</DataTableCell>
                    <DataTableCell numeric>{formatPrice(item.compras)}</DataTableCell>
                    <DataTableCell
                      numeric
                      className="font-semibold"
                      style={{ color: item.resultado >= 0 ? brand.green : brand.error }}
                    >
                      {formatSignedPrice(item.resultado)}
                    </DataTableCell>
                    <DataTableCell numeric>{formatPrice(item.deliveryCobrado)}</DataTableCell>
                    <DataTableCell numeric>
                      {formatPrice(item.ledgerSalidasDop)}
                      {item.ledgerSalidasUsd > 0 ? (
                        <span className="mt-0.5 block text-xs font-medium text-brand-muted">
                          {formatUsd(item.ledgerSalidasUsd)}
                        </span>
                      ) : null}
                    </DataTableCell>
                  </DataTableRow>
                );
              })}
            </tbody>
          </DataTable>

          {detalle ? <MonthDetail detalle={detalle} chartReady={chartReady} tasaUsdDop={reporte.tasaUsdDop} /> : null}
        </div>
      )}
    </div>
  );
}

function MonthSummary({
  detalle,
  topeCompras,
  mesActivo,
  tasaUsdDop,
}: {
  detalle: ReporteDetalle;
  topeCompras: number;
  mesActivo: string;
  tasaUsdDop: number;
}) {
  const mes = detalle.resumen;
  const anterior = detalle.anterior;
  const ratioSobreTope = topeCompras > 0 && mes.ventas > 0 && mes.ratioCompras > topeCompras;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="font-display text-lg font-bold">{detalle.label}</h2>
        {mesActivo === detalle.mes ? (
          <span className="text-xs font-semibold text-brand-muted">Mes activo</span>
        ) : null}
        {anterior ? <span className="text-xs text-brand-muted">Comparado con {anterior.label}</span> : null}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Metric
          label="Ventas"
          value={formatPrice(mes.ventas)}
          hint={mes.diasConVenta === 1 ? "1 día con venta" : `${mes.diasConVenta} días con venta`}
          delta={anterior ? mes.ventas - anterior.ventas : null}
          tone="upGood"
        />
        <Metric
          label="Compras"
          value={formatPrice(mes.compras)}
          hint={`${formatPrice(mes.comprasPendientes)} siguen pendientes`}
          delta={anterior ? mes.compras - anterior.compras : null}
          tone="upBad"
        />
        <Metric
          label="Ventas − compras"
          value={formatSignedPrice(mes.resultado)}
          hint={mes.meta > 0 ? `${formatPercent(mes.porcentajeMeta)} de la meta de ventas` : "Sin meta cargada"}
          delta={anterior ? mes.resultado - anterior.resultado : null}
          tone="upGood"
          valueColor={mes.resultado >= 0 ? brand.green : brand.error}
        />
        <Metric
          label="Compras / ventas"
          value={mes.ventas > 0 ? formatPercent(mes.ratioCompras) : "—"}
          hint={topeCompras > 0 ? `Tope ${formatPercent(topeCompras)}` : "Sin tope configurado"}
          delta={anterior && mes.ventas > 0 && anterior.ventas > 0 ? mes.ratioCompras - anterior.ratioCompras : null}
          deltaLabel={
            anterior && mes.ventas > 0 && anterior.ventas > 0
              ? `${formatSignedPercentPoints(mes.ratioCompras - anterior.ratioCompras)} vs mes anterior`
              : null
          }
          tone="upBad"
          valueColor={ratioSobreTope ? brand.error : brand.ink}
        />
        <Metric
          label="Delivery cobrado"
          value={formatPrice(mes.deliveryCobrado)}
          hint={
            mes.deliveryPedidos === 1
              ? "1 pedido despachado o completado"
              : `${mes.deliveryPedidos} pedidos despachados o completados`
          }
          delta={anterior ? mes.deliveryCobrado - anterior.deliveryCobrado : null}
          tone="upGood"
        />
        <Metric
          label="Salidas de caja"
          value={formatPrice(mes.ledgerSalidasDop)}
          hint={cajaHint(mes, tasaUsdDop)}
          delta={anterior ? mes.ledgerSalidasDop - anterior.ledgerSalidasDop : null}
          tone="upBad"
        />
      </div>
    </section>
  );
}

function MonthDetail({
  detalle,
  chartReady,
  tasaUsdDop,
}: {
  detalle: ReporteDetalle;
  chartReady: boolean;
  tasaUsdDop: number;
}) {
  const mes = detalle.resumen;
  const dias = detalle.dias.map((dia) => ({
    label: dia.fecha.slice(8, 10),
    ventas: dia.ventas,
    compras: dia.compras,
  }));

  return (
    <div className="space-y-4">
      {dias.length > 0 ? (
        <section className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
          <h2 className="font-display text-lg font-bold">Día a día</h2>
          <p className="mt-1 text-sm text-brand-muted">Ventas registradas y compras con fecha en {detalle.label}.</p>
          <div className="mt-4 h-64 w-full">
            {chartReady ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dias} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: brand.muted }} axisLine={false} tickLine={false} />
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
                    labelFormatter={(label) => {
                      const dia = detalle.dias.find((item) => item.fecha.slice(8, 10) === label);
                      return dia ? formatDayKey(dia.fecha) : String(label);
                    }}
                    contentStyle={{ borderRadius: 16, borderColor: "#E5E7EB" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 13 }} />
                  <Bar dataKey="ventas" name="Ventas" fill={brand.green} radius={[4, 4, 0, 0]} maxBarSize={14} />
                  <Bar dataKey="compras" name="Compras" fill={brand.blue} radius={[4, 4, 0, 0]} maxBarSize={14} />
                </BarChart>
              </ResponsiveContainer>
            ) : null}
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <LineCard title="Compras por proveedor" empty="No hay compras en este mes">
          {detalle.proveedores.length > 0 ? (
            <DataTable>
              <DataTableHead>
                <DataTableTh>Proveedor</DataTableTh>
                <DataTableTh numeric>Compras</DataTableTh>
                <DataTableTh numeric>Pendiente</DataTableTh>
              </DataTableHead>
              <tbody>
                {detalle.proveedores.map((item) => (
                  <ProveedorRow key={item.nombre} item={item} />
                ))}
              </tbody>
            </DataTable>
          ) : null}
        </LineCard>

        <LineCard
          title="Caja del mes"
          empty=""
          intro={`${mes.turnosVerificados} de ${mes.turnos} turnos verificados. Pagos a proveedores registrados: ${formatPrice(mes.pagosProveedores)}.`}
        >
          <div className="grid grid-cols-2 gap-2 text-sm">
            <CajaStat label="Tarjeta reportada" value={formatPrice(mes.cajaTarjeta)} />
            <CajaStat label="Efectivo DOP" value={formatPrice(mes.cajaEfectivoDop)} />
            <CajaStat label="USD reportado" value={formatUsd(mes.cajaUsd)} />
            <CajaStat
              label="Varianza"
              value={formatSignedPrice(mes.cajaVarianza)}
              color={mes.cajaVarianza === 0 ? brand.ink : mes.cajaVarianza > 0 ? brand.green : brand.error}
            />
          </div>
          {tasaUsdDop <= 0 && mes.cajaUsd > 0 ? (
            <p className="mt-3 text-xs text-brand-muted">
              No hay tasa USD en caja. El efectivo en pesos puede incluir dólares contados en el turno.
            </p>
          ) : null}
        </LineCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <MovimientoCard title="Salidas de caja" items={detalle.salidas} empty="No hay salidas en este mes" />
        <MovimientoCard title="Entradas de caja" items={detalle.entradas} empty="No hay entradas en este mes" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ConteoCard
          title="Delivery cobrado"
          items={detalle.deliveryPorPago}
          empty="No hay pedidos cobrados en este mes"
          cantidadLabel="Pedidos"
        />
        <ConteoCard
          title="Delivery por estado"
          items={detalle.deliveryPorEstado}
          empty="No hay pedidos en este mes"
          cantidadLabel="Pedidos"
        />
      </div>

      {detalle.deliveryPorTienda.length > 1 ? (
        <ConteoCard
          title="Delivery por tienda"
          items={detalle.deliveryPorTienda}
          empty=""
          cantidadLabel="Pedidos"
        />
      ) : null}
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
  delta,
  deltaLabel,
  tone,
  valueColor,
}: {
  label: string;
  value: string;
  hint: string;
  delta: number | null;
  deltaLabel?: string | null;
  tone: DeltaTone;
  valueColor?: string;
}) {
  const up = (delta ?? 0) > 0;
  const good = tone === "upGood" ? up : !up;
  const deltaColor = delta == null || delta === 0 ? brand.muted : good ? brand.green : brand.error;
  return (
    <article className="rounded-lg border border-[#E5E7EB] bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-muted">{label}</p>
      <p className="mt-2 font-display text-2xl font-bold tabular-nums" style={{ color: valueColor ?? brand.ink }}>
        {value}
      </p>
      <p className="mt-1 text-xs text-brand-muted">{hint}</p>
      {delta != null ? (
        <p className="mt-2 text-xs font-semibold tabular-nums" style={{ color: deltaColor }}>
          {deltaLabel ?? `${formatSignedPrice(delta)} vs mes anterior`}
        </p>
      ) : null}
    </article>
  );
}

function LineCard({
  title,
  empty,
  intro,
  children,
}: {
  title: string;
  empty: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[#E5E7EB] bg-white p-5 shadow-sm">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      {intro ? <p className="mt-1 text-sm text-brand-muted">{intro}</p> : null}
      <div className="mt-4">{children || (empty ? <p className="text-sm text-brand-muted">{empty}</p> : null)}</div>
    </section>
  );
}

function ProveedorRow({ item }: { item: ReporteProveedor }) {
  return (
    <DataTableRow>
      <DataTableCell>
        <span className="font-semibold">{item.nombre}</span>
        <span className="mt-0.5 block text-xs text-brand-muted">
          {item.cantidad === 1 ? "1 factura" : `${item.cantidad} facturas`}
        </span>
      </DataTableCell>
      <DataTableCell numeric>{formatPrice(item.monto)}</DataTableCell>
      <DataTableCell numeric style={{ color: item.pendiente > 0 ? brand.orange : brand.muted }}>
        {formatPrice(item.pendiente)}
      </DataTableCell>
    </DataTableRow>
  );
}

function MovimientoCard({ title, items, empty }: { title: string; items: ReporteMovimiento[]; empty: string }) {
  return (
    <LineCard title={title} empty={items.length === 0 ? empty : ""}>
      {items.length > 0 ? (
        <DataTable>
          <DataTableHead>
            <DataTableTh>Concepto</DataTableTh>
            <DataTableTh numeric>DOP</DataTableTh>
            <DataTableTh numeric>USD</DataTableTh>
          </DataTableHead>
          <tbody>
            {items.map((item) => (
              <DataTableRow key={item.nombre}>
                <DataTableCell className="font-semibold">{item.nombre}</DataTableCell>
                <DataTableCell numeric>{formatPrice(item.montoDop)}</DataTableCell>
                <DataTableCell numeric>{item.montoUsd > 0 ? formatUsd(item.montoUsd) : "—"}</DataTableCell>
              </DataTableRow>
            ))}
          </tbody>
        </DataTable>
      ) : null}
    </LineCard>
  );
}

function ConteoCard({
  title,
  items,
  empty,
  cantidadLabel,
}: {
  title: string;
  items: ReporteConteo[];
  empty: string;
  cantidadLabel: string;
}) {
  return (
    <LineCard title={title} empty={items.length === 0 ? empty : ""}>
      {items.length > 0 ? (
        <DataTable>
          <DataTableHead>
            <DataTableTh>Detalle</DataTableTh>
            <DataTableTh numeric>{cantidadLabel}</DataTableTh>
            <DataTableTh numeric>Monto</DataTableTh>
          </DataTableHead>
          <tbody>
            {items.map((item) => (
              <DataTableRow key={item.nombre}>
                <DataTableCell className="font-semibold">{item.nombre}</DataTableCell>
                <DataTableCell numeric>{item.cantidad}</DataTableCell>
                <DataTableCell numeric>{formatPrice(item.monto)}</DataTableCell>
              </DataTableRow>
            ))}
          </tbody>
        </DataTable>
      ) : null}
    </LineCard>
  );
}

function CajaStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg px-3 py-2" style={{ backgroundColor: "#F8FAF7" }}>
      <p className="text-xs text-brand-muted">{label}</p>
      <p className="mt-1 font-semibold tabular-nums" style={{ color: color ?? brand.ink }}>
        {value}
      </p>
    </div>
  );
}

function cajaHint(mes: ReporteMes, tasaUsdDop: number): string {
  if (mes.ledgerSalidasUsd > 0) {
    return `Más ${formatUsd(mes.ledgerSalidasUsd)} en salidas`;
  }
  if (tasaUsdDop > 0 && mes.cajaUsd > 0) {
    return `Tasa actual ${formatPrice(tasaUsdDop)} por dólar`;
  }
  return mes.turnos === 1 ? "1 turno de caja" : `${mes.turnos} turnos de caja`;
}

function formatSignedPercentPoints(ratio: number): string {
  const points = ratio * 100;
  const formatted = new Intl.NumberFormat("es-DO", { maximumFractionDigits: 1 }).format(Math.abs(points));
  if (points > 0) {
    return `+${formatted} pp`;
  }
  if (points < 0) {
    return `−${formatted} pp`;
  }
  return "0 pp";
}

function shortMonthLabel(label: string): string {
  const [month, year] = label.split(" ");
  return `${month.slice(0, 3)} ${year ?? ""}`.trim();
}

function formatAxisMoney(value: number): string {
  return new Intl.NumberFormat("es-DO", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number.isFinite(value) ? value : 0);
}
