import { formatPrice, toMoney } from "@/lib/money";

export type DashboardFactura = {
  id: string;
  proveedorId: string;
  proveedorNombre: string;
  monto: number;
  fecha: string;
  dueDate: string;
};

export type AdminDashboardData = {
  mesActivo: string;
  ventasAcumuladas: number;
  metaMensual: number;
  diferenciaVsMeta: number;
  porcentajeMeta: number;
  forecastCierreMes: number;
  diasRestantes: number;
  comprasDelMes: number;
  ratioComprasVentas: number;
  presupuestoMaximoMes: number;
  disponibleMes: number;
  presupuestoSemana: number;
  comprasSemana: number;
  disponibleSemana: number;
  facturasVencidas: DashboardFactura[];
  facturasPorVencer: DashboardFactura[];
  umbralCuidado: number;
  umbralStop: number;
};

export type SemaforoNivel = "ok" | "cuidado" | "stop";

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

export function formatMesActivoLabel(year: number, month: number): string {
  return `${MESES[month - 1] ?? ""} ${year}`.trim();
}

export function formatPercent(ratio: number): string {
  const amount = Number.isFinite(ratio) ? ratio * 100 : 0;
  return `${new Intl.NumberFormat("es-DO", { maximumFractionDigits: 0 }).format(amount)}%`;
}

export function formatRatio(value: number): string {
  return new Intl.NumberFormat("es-DO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatSignedPrice(value: number): string {
  const amount = toMoney(value);
  if (amount > 0) {
    return `+${formatPrice(amount)}`;
  }
  if (amount < 0) {
    return `−${formatPrice(Math.abs(amount))}`;
  }
  return formatPrice(0);
}

export function semaforoDisponible(
  disponible: number,
  presupuesto: number,
  umbralCuidado: number,
  umbralStop: number
): SemaforoNivel {
  if (disponible < 0) {
    return "stop";
  }
  if (!(presupuesto > 0)) {
    return "ok";
  }
  const ratio = disponible / presupuesto;
  if (ratio < umbralStop) {
    return "stop";
  }
  if (ratio <= umbralCuidado) {
    return "cuidado";
  }
  return "ok";
}
