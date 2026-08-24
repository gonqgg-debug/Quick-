"use client";

import Link from "next/link";
import { daysRemaining, formatDaysRemaining } from "@/lib/admin-compras-shared";
import {
  formatPercent,
  formatRatio,
  formatSignedPrice,
  semaforoDisponible,
  type AdminDashboardData,
  type DashboardFactura,
  type SemaforoNivel,
} from "@/lib/admin-dashboard-shared";
import { formatDayKey, todayDayKey } from "@/lib/local-day";
import { formatPrice } from "@/lib/money";
import { brand } from "@/lib/theme";

const SEMAFORO: Record<SemaforoNivel, { border: string; background: string; color: string; label: string }> = {
  ok: { border: brand.green, background: "#F4F9EC", color: brand.green, label: "Dentro del presupuesto" },
  cuidado: { border: brand.orange, background: "#FFF6EB", color: brand.orange, label: "Cuidado" },
  stop: { border: brand.error, background: "#FEF2F2", color: brand.error, label: "Stop" },
};

export function AdminDashboard({ data }: { data: AdminDashboardData }) {
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
    <div className="mt-6 space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Ventas acumuladas" value={formatPrice(data.ventasAcumuladas)} />
        <MetricCard label="Meta del mes" value={formatPrice(data.metaMensual)} />
        <MetricCard
          label="Diferencia"
          value={formatSignedPrice(data.diferenciaVsMeta)}
          color={data.diferenciaVsMeta >= 0 ? brand.green : brand.error}
        />
        <MetricCard
          label="% de meta"
          value={formatPercent(data.porcentajeMeta)}
          color={data.porcentajeMeta >= 1 ? brand.green : brand.ink}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Forecast cierre mes" value={formatPrice(data.forecastCierreMes)} />
        <MetricCard
          label="Días restantes"
          value={String(data.diasRestantes)}
          hint={data.diasRestantes === 1 ? "día" : "días"}
        />
        <MetricCard label="Compras realizadas" value={formatPrice(data.comprasDelMes)} />
        <MetricCard label="Ratio compras/ventas" value={formatRatio(data.ratioComprasVentas)} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
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
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  color = brand.ink,
}: {
  label: string;
  value: string;
  hint?: string;
  color?: string;
}) {
  return (
    <section className="rounded-[24px] border bg-white px-4 py-4" style={{ borderColor: "#E5E7EB" }}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-brand-muted">{label}</p>
      <p className="mt-1 font-display text-xl font-bold tabular-nums sm:text-2xl" style={{ color }}>
        {value}
        {hint ? <span className="ml-1 text-sm font-semibold text-brand-muted">{hint}</span> : null}
      </p>
    </section>
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
  return (
    <section className="rounded-[28px] border px-5 py-5" style={{ borderColor: tone.border, backgroundColor: tone.background }}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: tone.color }}>
          {title}
        </p>
        <span
          className="rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white"
          style={{ backgroundColor: tone.color }}
        >
          {tone.label}
        </span>
      </div>
      <p className="mt-3 font-display text-3xl font-bold tabular-nums sm:text-4xl" style={{ color: tone.color }}>
        {formatSignedPrice(disponible)}
      </p>
      <p className="mt-2 text-sm text-brand-muted">
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
    <section className="rounded-[24px] border bg-white p-5" style={{ borderColor: "#E5E7EB" }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold">Alertas</h2>
        <Link href="/admin/compras" className="text-sm font-bold" style={{ color: brand.green }}>
          Ver compras
        </Link>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <FacturaList
          title="Facturas vencidas"
          empty="No hay facturas vencidas"
          facturas={vencidas}
          tone="stop"
        />
        <FacturaList
          title="Por vencer en 3 días"
          empty="No hay facturas por vencer"
          facturas={porVencer}
          tone="cuidado"
        />
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
  const color = SEMAFORO[tone].color;
  const background = SEMAFORO[tone].background;
  const today = todayDayKey();

  return (
    <div className="rounded-2xl px-4 py-3" style={{ backgroundColor: background }}>
      <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color }}>
        {title}
        {facturas.length > 0 ? ` · ${facturas.length}` : null}
      </p>
      {facturas.length === 0 ? (
        <p className="mt-2 text-sm text-brand-muted">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {facturas.map((factura) => (
            <li key={factura.id}>
              <Link href="/admin/compras" className="flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{factura.proveedorNombre}</p>
                  <p className="text-xs text-brand-muted">
                    {formatDayKey(factura.dueDate)} · {formatDaysRemaining(daysRemaining(factura.dueDate, today))}
                  </p>
                </div>
                <p className="shrink-0 font-bold tabular-nums" style={{ color }}>
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
