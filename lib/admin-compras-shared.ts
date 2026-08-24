import { addDaysToDayKey, diffDayKeys, isDayKey, todayDayKey } from "@/lib/local-day";

export type Proveedor = {
  id: string;
  nombre: string;
  tieneCredito: boolean;
  diasCredito: number;
  notas: string | null;
};

export type Compra = {
  id: string;
  proveedorId: string;
  proveedorNombre: string;
  monto: number;
  fecha: string;
  dueDate: string;
  pagado: boolean;
  pagadoEn: string | null;
};

export type ComprasSummary = {
  totalPendiente: number;
  venceEstaSemana: number;
  vencidas: number;
};

export type ComprasList = {
  compras: Compra[];
  summary: ComprasSummary;
  total: number;
};

export const COMPRAS_WEEK_DAYS = 6;
export const COMPRAS_PAGE_SIZE = 50;

export function emptyComprasSummary(): ComprasSummary {
  return { totalPendiente: 0, venceEstaSemana: 0, vencidas: 0 };
}

export function daysRemaining(dueDate: string, today = todayDayKey()): number {
  if (!isDayKey(dueDate) || !isDayKey(today)) {
    return 0;
  }
  return diffDayKeys(today, dueDate);
}

export function dueDateFromCredit(fecha: string, proveedor: Pick<Proveedor, "tieneCredito" | "diasCredito"> | null): string {
  if (!isDayKey(fecha)) {
    return fecha;
  }
  const days = proveedor?.tieneCredito ? Math.max(0, proveedor.diasCredito) : 0;
  return addDaysToDayKey(fecha, days);
}

export function summarizePendientes(compras: Array<Pick<Compra, "pagado" | "monto" | "dueDate">>, today = todayDayKey()): ComprasSummary {
  const weekEnd = addDaysToDayKey(today, COMPRAS_WEEK_DAYS);
  return compras.reduce((summary, compra) => {
    if (compra.pagado) {
      return summary;
    }
    summary.totalPendiente += compra.monto;
    if (compra.dueDate < today) {
      summary.vencidas += compra.monto;
    } else if (compra.dueDate <= weekEnd) {
      summary.venceEstaSemana += compra.monto;
    }
    return summary;
  }, emptyComprasSummary());
}

export function formatDaysRemaining(days: number): string {
  if (days === 0) {
    return "Hoy";
  }
  if (days === 1) {
    return "1 día";
  }
  if (days === -1) {
    return "Venció ayer";
  }
  if (days < 0) {
    return `Venció hace ${Math.abs(days)} d`;
  }
  return `${days} d`;
}

export function sortProveedores(proveedores: Proveedor[]): Proveedor[] {
  return [...proveedores].sort((left, right) =>
    left.nombre.localeCompare(right.nombre, "es", { sensitivity: "base" })
  );
}
