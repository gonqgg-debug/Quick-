import { formatPrice, toMoney } from "@/lib/money";

export type DashboardFactura = {
  id: string;
  proveedorId: string;
  proveedorNombre: string;
  monto: number;
  fecha: string;
  dueDate: string;
};

export type DashboardSparkPoint = {
  fecha: string;
  ventaReal: number;
};

export type DashboardTendenciaDia = {
  fecha: string;
  label: string;
  ventaReal: number;
  metaDelDia: number;
  diferencia: number;
  acumuladoMes: number;
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
  sparkline14: DashboardSparkPoint[];
  tendencia7: DashboardTendenciaDia[];
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

/** Short weekday date, e.g. "Lun 18 ago". */
export function formatTendenciaFecha(fecha: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (!match) {
    return fecha;
  }
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  const raw = new Intl.DateTimeFormat("es-DO", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
  return raw.replace(/\./g, "").replace(/^./, (letter) => letter.toUpperCase());
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
  if (umbralStop > umbralCuidado) {
    const usado = (presupuesto - disponible) / presupuesto;
    if (usado >= umbralStop) {
      return "stop";
    }
    if (usado >= umbralCuidado) {
      return "cuidado";
    }
    return "ok";
  }
  const restante = disponible / presupuesto;
  if (restante < umbralStop) {
    return "stop";
  }
  if (restante <= umbralCuidado) {
    return "cuidado";
  }
  return "ok";
}
