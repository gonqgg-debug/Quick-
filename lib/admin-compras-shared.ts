import { addDaysToDayKey, diffDayKeys, isDayKey, todayDayKey } from "@/lib/local-day";

export const PROVEEDOR_FORMAS_PAGO = [
  { id: "efectivo", label: "Efectivo" },
  { id: "transferencia", label: "Transferencia" },
  { id: "mixto", label: "Mixto" },
] as const;

export type ProveedorFormaPago = (typeof PROVEEDOR_FORMAS_PAGO)[number]["id"];

export type Proveedor = {
  id: string;
  nombre: string;
  rnc: string | null;
  tieneCredito: boolean;
  diasCredito: number;
  formaPago: ProveedorFormaPago | null;
  notas: string | null;
};

export function parseFormaPago(value: unknown): ProveedorFormaPago | null {
  const text = typeof value === "string" ? value.trim().toLowerCase() : "";
  return PROVEEDOR_FORMAS_PAGO.find((item) => item.id === text)?.id ?? null;
}

export const COMPRA_MEDIOS_PAGO = [
  { id: "caja_chica", label: "Caja chica" },
  { id: "caja_fuerte", label: "Caja fuerte" },
  { id: "transferencia", label: "Transferencia" },
] as const;

export type CompraMedioPago = (typeof COMPRA_MEDIOS_PAGO)[number]["id"];

export function parseCompraMedio(value: unknown): CompraMedioPago | null {
  const text = typeof value === "string" ? value.trim().toLowerCase().replace(/\s+/g, "_") : "";
  if (text === "cajachica" || text === "chica") {
    return "caja_chica";
  }
  if (text === "cajafuerte" || text === "fuerte") {
    return "caja_fuerte";
  }
  if (text === "banco") {
    return "transferencia";
  }
  return COMPRA_MEDIOS_PAGO.find((item) => item.id === text)?.id ?? null;
}

export function medioDesdeCaja(caja: string): CompraMedioPago | null {
  if (caja === "Chica") {
    return "caja_chica";
  }
  if (caja === "Fuerte") {
    return "caja_fuerte";
  }
  return null;
}

export type Compra = {
  id: string;
  proveedorId: string;
  proveedorNombre: string;
  monto: number;
  /** Suma de las notas de crédito ya aplicadas. */
  notasCredito: number;
  /** Monto menos notas de crédito. Es lo que queda por pagar. */
  saldo: number;
  fecha: string;
  dueDate: string;
  pagado: boolean;
  pagadoEn: string | null;
  medioPago: CompraMedioPago | null;
  ledgerId: string | null;
  movimientoId: string | null;
  rnc: string | null;
  ncf: string | null;
  tieneCaptura: boolean;
};

export type CompraCambio = {
  campo: string;
  antes: string | null;
  despues: string | null;
};

const CAMPOS_AUDITABLES: Array<{ campo: string; valor: (compra: Compra) => string | null }> = [
  { campo: "proveedor", valor: (compra) => compra.proveedorNombre },
  { campo: "monto", valor: (compra) => String(compra.monto) },
  { campo: "fecha", valor: (compra) => compra.fecha },
  { campo: "rnc", valor: (compra) => compra.rnc },
  { campo: "ncf", valor: (compra) => compra.ncf },
  { campo: "pagado", valor: (compra) => (compra.pagado ? "sí" : "no") },
  { campo: "pagadoEn", valor: (compra) => compra.pagadoEn },
  { campo: "medioPago", valor: (compra) => compra.medioPago },
  { campo: "ledgerId", valor: (compra) => compra.ledgerId },
  { campo: "movimientoId", valor: (compra) => compra.movimientoId },
];

export function cambiosEntreCompras(antes: Compra, despues: Compra): CompraCambio[] {
  const cambios: CompraCambio[] = [];
  for (const item of CAMPOS_AUDITABLES) {
    const previo = item.valor(antes);
    const siguiente = item.valor(despues);
    if (previo !== siguiente) {
      cambios.push({ campo: item.campo, antes: previo, despues: siguiente });
    }
  }
  return cambios;
}

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

export function saldoCompra(monto: number, notasCredito: number | null | undefined): number {
  return Math.max(0, Math.round((monto - (notasCredito ?? 0)) * 100) / 100);
}

export function summarizePendientes(
  compras: Array<Pick<Compra, "pagado" | "monto" | "dueDate"> & { notasCredito?: number }>,
  today = todayDayKey()
): ComprasSummary {
  const weekEnd = addDaysToDayKey(today, COMPRAS_WEEK_DAYS);
  return compras.reduce((summary, compra) => {
    if (compra.pagado) {
      return summary;
    }
    const saldo = saldoCompra(compra.monto, compra.notasCredito);
    summary.totalPendiente += saldo;
    if (compra.dueDate < today) {
      summary.vencidas += saldo;
    } else if (compra.dueDate <= weekEnd) {
      summary.venceEstaSemana += saldo;
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
