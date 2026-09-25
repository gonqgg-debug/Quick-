import { formatMesActivoLabel } from "@/lib/admin-dashboard-shared";
import { isMonthKey, monthInputValue, monthStartFromInput } from "@/lib/admin-parametros-shared";
import { isDayKey } from "@/lib/local-day";
import { orderStatusLabel } from "@/lib/order-display";
import { toMoney } from "@/lib/money";

export type ReporteMes = {
  mes: string;
  label: string;
  ventas: number;
  diasConVenta: number;
  meta: number;
  diferenciaMeta: number;
  porcentajeMeta: number;
  compras: number;
  comprasPagadas: number;
  comprasPendientes: number;
  pagosProveedores: number;
  resultado: number;
  ratioCompras: number;
  deliveryCobrado: number;
  deliveryPedidos: number;
  deliveryCancelados: number;
  deliveryCanceladoMonto: number;
  turnos: number;
  turnosVerificados: number;
  cajaTarjeta: number;
  cajaEfectivoDop: number;
  cajaUsd: number;
  cajaVarianza: number;
  ledgerEntradasDop: number;
  ledgerSalidasDop: number;
  ledgerEntradasUsd: number;
  ledgerSalidasUsd: number;
};

export type ReporteConteo = {
  nombre: string;
  monto: number;
  cantidad: number;
};

export type ReporteProveedor = ReporteConteo & {
  pendiente: number;
};

export type ReporteMovimiento = {
  nombre: string;
  montoDop: number;
  montoUsd: number;
  cantidad: number;
};

export type ReporteDia = {
  fecha: string;
  ventas: number;
  compras: number;
};

export type ReporteDetalle = {
  mes: string;
  label: string;
  resumen: ReporteMes;
  anterior: ReporteMes | null;
  proveedores: ReporteProveedor[];
  salidas: ReporteMovimiento[];
  entradas: ReporteMovimiento[];
  deliveryPorPago: ReporteConteo[];
  deliveryPorEstado: ReporteConteo[];
  deliveryPorTienda: ReporteConteo[];
  dias: ReporteDia[];
};

export type ReporteFinanciero = {
  mesActivo: string;
  ratioRecompra: number;
  tasaUsdDop: number;
  meses: ReporteMes[];
  detalle: ReporteDetalle | null;
};

export type ReporteVenta = { fecha: string; ventaReal: number };
export type ReporteCompra = {
  monto: number;
  fecha: string;
  pagado: boolean;
  pagadoEn: string | null;
  proveedor: string;
};
export type ReporteMeta = { mes: string; meta: number };
export type ReporteTurno = {
  fecha: string;
  sistemaTarjeta: number;
  sistemaEfectivo: number;
  reportadoTarjeta: number;
  reportadoEfectivo: number;
  reportadoUsd: number;
  verificado: boolean;
};
export type ReporteLedger = {
  fecha: string;
  moneda: "DOP" | "USD";
  tipo: "Entrada" | "Salida";
  monto: number;
  concepto: string | null;
};
export type ReportePedido = {
  fecha: string;
  estado: string;
  metodoPago: string;
  total: number;
  tienda: string;
};

const COBRADOS = new Set(["completada", "despachada"]);
const TOP_LINEAS = 12;

const PAGO_LABEL: Record<string, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
};

const TIENDA_LABEL: Record<string, string> = {
  quick: "Quick",
  pharmaquick: "PharmaQuick",
};

export const REPORTE_EXPORT_HEADERS = [
  "Mes",
  "Ventas",
  "Días con venta",
  "Meta",
  "Diferencia vs meta",
  "% de meta",
  "Compras",
  "Compras pagadas",
  "Compras pendientes",
  "Pagos a proveedores",
  "Ventas − compras",
  "Compras / ventas %",
  "Delivery cobrado",
  "Pedidos delivery cobrados",
  "Pedidos cancelados",
  "Monto cancelado",
  "Turnos",
  "Turnos verificados",
  "Tarjeta reportada",
  "Efectivo DOP",
  "USD reportado",
  "Varianza de caja",
  "Entradas de caja DOP",
  "Salidas de caja DOP",
  "Entradas de caja USD",
  "Salidas de caja USD",
];

type Bucket = {
  ventas: number;
  dias: Set<string>;
  meta: number;
  compras: number;
  comprasPagadas: number;
  pagos: number;
  deliveryCobrado: number;
  deliveryPedidos: number;
  deliveryCancelados: number;
  deliveryCanceladoMonto: number;
  turnos: number;
  turnosVerificados: number;
  cajaTarjeta: number;
  cajaEfectivoDop: number;
  cajaUsd: number;
  cajaVarianza: number;
  ledgerEntradasDop: number;
  ledgerSalidasDop: number;
  ledgerEntradasUsd: number;
  ledgerSalidasUsd: number;
  proveedores: Map<string, ReporteProveedor>;
  salidas: Map<string, ReporteMovimiento>;
  entradas: Map<string, ReporteMovimiento>;
  deliveryPago: Map<string, ReporteConteo>;
  deliveryEstado: Map<string, ReporteConteo>;
  deliveryTienda: Map<string, ReporteConteo>;
  ventasDia: Map<string, number>;
  comprasDia: Map<string, number>;
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function parseReporteMesParam(value: unknown): string | null {
  if (value == null || String(value).trim() === "") {
    return null;
  }
  const start = monthStartFromInput(value);
  if (!start || !isMonthKey(start.slice(0, 7))) {
    return null;
  }
  return start.slice(0, 7);
}

function monthKeyFromDay(fecha: string): string | null {
  if (!isDayKey(fecha)) {
    return null;
  }
  return fecha.slice(0, 7);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function addMonthKey(monthKey: string, delta: number): string {
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7));
  const shifted = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}`;
}

function labelMes(monthKey: string): string {
  return formatMesActivoLabel(Number(monthKey.slice(0, 4)), Number(monthKey.slice(5, 7)));
}

function emptyBucket(): Bucket {
  return {
    ventas: 0,
    dias: new Set(),
    meta: 0,
    compras: 0,
    comprasPagadas: 0,
    pagos: 0,
    deliveryCobrado: 0,
    deliveryPedidos: 0,
    deliveryCancelados: 0,
    deliveryCanceladoMonto: 0,
    turnos: 0,
    turnosVerificados: 0,
    cajaTarjeta: 0,
    cajaEfectivoDop: 0,
    cajaUsd: 0,
    cajaVarianza: 0,
    ledgerEntradasDop: 0,
    ledgerSalidasDop: 0,
    ledgerEntradasUsd: 0,
    ledgerSalidasUsd: 0,
    proveedores: new Map(),
    salidas: new Map(),
    entradas: new Map(),
    deliveryPago: new Map(),
    deliveryEstado: new Map(),
    deliveryTienda: new Map(),
    ventasDia: new Map(),
    comprasDia: new Map(),
  };
}

function toMes(monthKey: string, bucket: Bucket): ReporteMes {
  const ventas = bucket.ventas;
  const compras = bucket.compras;
  const meta = bucket.meta;
  return {
    mes: `${monthKey}-01`,
    label: labelMes(monthKey),
    ventas,
    diasConVenta: bucket.dias.size,
    meta,
    diferenciaMeta: ventas - meta,
    porcentajeMeta: meta > 0 ? ventas / meta : 0,
    compras,
    comprasPagadas: bucket.comprasPagadas,
    comprasPendientes: compras - bucket.comprasPagadas,
    pagosProveedores: bucket.pagos,
    resultado: ventas - compras,
    ratioCompras: ventas > 0 ? compras / ventas : 0,
    deliveryCobrado: bucket.deliveryCobrado,
    deliveryPedidos: bucket.deliveryPedidos,
    deliveryCancelados: bucket.deliveryCancelados,
    deliveryCanceladoMonto: bucket.deliveryCanceladoMonto,
    turnos: bucket.turnos,
    turnosVerificados: bucket.turnosVerificados,
    cajaTarjeta: bucket.cajaTarjeta,
    cajaEfectivoDop: bucket.cajaEfectivoDop,
    cajaUsd: bucket.cajaUsd,
    cajaVarianza: bucket.cajaVarianza,
    ledgerEntradasDop: bucket.ledgerEntradasDop,
    ledgerSalidasDop: bucket.ledgerSalidasDop,
    ledgerEntradasUsd: bucket.ledgerEntradasUsd,
    ledgerSalidasUsd: bucket.ledgerSalidasUsd,
  };
}

function conceptoKey(concepto: string | null): { key: string; nombre: string } {
  const trimmed = concepto?.trim() ?? "";
  if (!trimmed) {
    return { key: "sin concepto", nombre: "Sin concepto" };
  }
  return { key: trimmed.toLocaleLowerCase("es"), nombre: trimmed };
}

function addMovimiento(
  map: Map<string, ReporteMovimiento>,
  concepto: string | null,
  moneda: "DOP" | "USD",
  monto: number
) {
  const { key, nombre } = conceptoKey(concepto);
  const current = map.get(key) ?? { nombre, montoDop: 0, montoUsd: 0, cantidad: 0 };
  current.cantidad += 1;
  if (moneda === "USD") {
    current.montoUsd += monto;
  } else {
    current.montoDop += monto;
  }
  map.set(key, current);
}

function addConteo(map: Map<string, ReporteConteo>, nombre: string, monto: number) {
  const current = map.get(nombre) ?? { nombre, monto: 0, cantidad: 0 };
  current.monto += monto;
  current.cantidad += 1;
  map.set(nombre, current);
}

function pagoLabel(metodo: string): string {
  const key = metodo.trim().toLowerCase();
  return PAGO_LABEL[key] ?? (metodo.trim() || "Sin método");
}

function tiendaLabel(tienda: string): string {
  const key = tienda.trim().toLowerCase();
  return TIENDA_LABEL[key] ?? (tienda.trim() || "Sin tienda");
}

function topConteos(items: ReporteConteo[]): ReporteConteo[] {
  const sorted = [...items].sort(
    (a, b) => b.monto - a.monto || a.nombre.localeCompare(b.nombre, "es")
  );
  if (sorted.length <= TOP_LINEAS) {
    return sorted;
  }
  const head = sorted.slice(0, TOP_LINEAS);
  const rest = sorted.slice(TOP_LINEAS);
  head.push({
    nombre: "Otros",
    monto: rest.reduce((sum, item) => sum + item.monto, 0),
    cantidad: rest.reduce((sum, item) => sum + item.cantidad, 0),
  });
  return head;
}

function topProveedores(items: ReporteProveedor[]): ReporteProveedor[] {
  const sorted = [...items].sort(
    (a, b) => b.monto - a.monto || a.nombre.localeCompare(b.nombre, "es")
  );
  if (sorted.length <= TOP_LINEAS) {
    return sorted;
  }
  const head = sorted.slice(0, TOP_LINEAS);
  const rest = sorted.slice(TOP_LINEAS);
  head.push({
    nombre: "Otros",
    monto: rest.reduce((sum, item) => sum + item.monto, 0),
    cantidad: rest.reduce((sum, item) => sum + item.cantidad, 0),
    pendiente: rest.reduce((sum, item) => sum + item.pendiente, 0),
  });
  return head;
}

function topMovimientos(items: ReporteMovimiento[]): ReporteMovimiento[] {
  const sorted = [...items].sort(
    (a, b) => b.montoDop - a.montoDop || b.montoUsd - a.montoUsd || a.nombre.localeCompare(b.nombre, "es")
  );
  if (sorted.length <= TOP_LINEAS) {
    return sorted;
  }
  const head = sorted.slice(0, TOP_LINEAS);
  const rest = sorted.slice(TOP_LINEAS);
  head.push({
    nombre: "Otros",
    montoDop: rest.reduce((sum, item) => sum + item.montoDop, 0),
    montoUsd: rest.reduce((sum, item) => sum + item.montoUsd, 0),
    cantidad: rest.reduce((sum, item) => sum + item.cantidad, 0),
  });
  return head;
}

function efectivoDop(turno: ReporteTurno, tasaUsdDop: number): number {
  if (!(tasaUsdDop > 0)) {
    return turno.reportadoEfectivo;
  }
  return turno.reportadoEfectivo - turno.reportadoUsd * tasaUsdDop;
}

function varianzaTurno(turno: ReporteTurno): number {
  return turno.reportadoTarjeta + turno.reportadoEfectivo - turno.sistemaTarjeta - turno.sistemaEfectivo;
}

function diasDelMes(monthKey: string, today: string): ReporteDia[] {
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7));
  const from = `${monthKey}-01`;
  const to = `${monthKey}-${pad2(daysInMonth(year, month))}`;
  if (!isDayKey(today) || today < from) {
    return [];
  }
  const last = today < to ? today : to;
  const dias: ReporteDia[] = [];
  let fecha = from;
  while (fecha <= last) {
    dias.push({ fecha, ventas: 0, compras: 0 });
    const next = new Date(Date.UTC(year, month - 1, Number(fecha.slice(8, 10)) + 1));
    fecha = next.toISOString().slice(0, 10);
  }
  return dias;
}

export function buildReporteFinanciero(input: {
  mesActivo: string;
  ratioRecompra: number;
  tasaUsdDop: number;
  requestedMes: string | null;
  today: string;
  ventas: ReporteVenta[];
  compras: ReporteCompra[];
  metas: ReporteMeta[];
  turnos: ReporteTurno[];
  ledger: ReporteLedger[];
  pedidos: ReportePedido[];
}): ReporteFinanciero {
  const buckets = new Map<string, Bucket>();
  const ensure = (monthKey: string | null): Bucket | null => {
    if (!monthKey || !isMonthKey(monthKey)) {
      return null;
    }
    const existing = buckets.get(monthKey);
    if (existing) {
      return existing;
    }
    const created = emptyBucket();
    buckets.set(monthKey, created);
    return created;
  };

  const mesActivoKey = parseReporteMesParam(input.mesActivo);
  ensure(mesActivoKey);
  ensure(input.requestedMes);

  for (const meta of input.metas) {
    const monthKey = parseReporteMesParam(meta.mes);
    const bucket = ensure(monthKey);
    if (bucket) {
      bucket.meta += toMoney(meta.meta);
    }
  }

  for (const venta of input.ventas) {
    const monthKey = monthKeyFromDay(venta.fecha);
    const bucket = ensure(monthKey);
    if (!bucket) {
      continue;
    }
    const monto = toMoney(venta.ventaReal);
    bucket.ventas += monto;
    bucket.dias.add(venta.fecha);
    bucket.ventasDia.set(venta.fecha, (bucket.ventasDia.get(venta.fecha) ?? 0) + monto);
  }

  for (const compra of input.compras) {
    const monto = toMoney(compra.monto);
    const monthKey = monthKeyFromDay(compra.fecha);
    const bucket = ensure(monthKey);
    if (bucket) {
      bucket.compras += monto;
      if (compra.pagado) {
        bucket.comprasPagadas += monto;
      }
      const nombre = compra.proveedor.trim() || "Sin proveedor";
      const key = nombre.toLocaleLowerCase("es");
      const current = bucket.proveedores.get(key) ?? { nombre, monto: 0, cantidad: 0, pendiente: 0 };
      current.monto += monto;
      current.cantidad += 1;
      if (!compra.pagado) {
        current.pendiente += monto;
      }
      bucket.proveedores.set(key, current);
      bucket.comprasDia.set(compra.fecha, (bucket.comprasDia.get(compra.fecha) ?? 0) + monto);
    }
    if (compra.pagado && compra.pagadoEn) {
      const pagoBucket = ensure(monthKeyFromDay(compra.pagadoEn));
      if (pagoBucket) {
        pagoBucket.pagos += monto;
      }
    }
  }

  for (const turno of input.turnos) {
    const bucket = ensure(monthKeyFromDay(turno.fecha));
    if (!bucket) {
      continue;
    }
    bucket.turnos += 1;
    if (turno.verificado) {
      bucket.turnosVerificados += 1;
    }
    bucket.cajaTarjeta += toMoney(turno.reportadoTarjeta);
    bucket.cajaEfectivoDop += efectivoDop(turno, input.tasaUsdDop);
    bucket.cajaUsd += toMoney(turno.reportadoUsd);
    bucket.cajaVarianza += varianzaTurno(turno);
  }

  for (const movimiento of input.ledger) {
    const bucket = ensure(monthKeyFromDay(movimiento.fecha));
    if (!bucket) {
      continue;
    }
    const monto = toMoney(movimiento.monto);
    const salida = movimiento.tipo === "Salida";
    if (movimiento.moneda === "USD") {
      if (salida) {
        bucket.ledgerSalidasUsd += monto;
      } else {
        bucket.ledgerEntradasUsd += monto;
      }
    } else if (salida) {
      bucket.ledgerSalidasDop += monto;
    } else {
      bucket.ledgerEntradasDop += monto;
    }
    addMovimiento(salida ? bucket.salidas : bucket.entradas, movimiento.concepto, movimiento.moneda, monto);
  }

  for (const pedido of input.pedidos) {
    const bucket = ensure(monthKeyFromDay(pedido.fecha));
    if (!bucket) {
      continue;
    }
    const total = toMoney(pedido.total);
    const estado = pedido.estado.trim().toLowerCase();
    addConteo(bucket.deliveryEstado, orderStatusLabel(estado), total);
    if (estado === "cancelada") {
      bucket.deliveryCancelados += 1;
      bucket.deliveryCanceladoMonto += total;
      continue;
    }
    if (!COBRADOS.has(estado)) {
      continue;
    }
    bucket.deliveryCobrado += total;
    bucket.deliveryPedidos += 1;
    addConteo(bucket.deliveryPago, pagoLabel(pedido.metodoPago), total);
    addConteo(bucket.deliveryTienda, tiendaLabel(pedido.tienda), total);
  }

  const monthKeys = Array.from(buckets.keys()).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  const meses = monthKeys.map((monthKey) => toMes(monthKey, buckets.get(monthKey)!));
  const byKey = new Map(monthKeys.map((monthKey, index) => [monthKey, meses[index]]));

  const selectedKey =
    (input.requestedMes && buckets.has(input.requestedMes) ? input.requestedMes : null) ??
    (mesActivoKey && buckets.has(mesActivoKey) ? mesActivoKey : null) ??
    monthKeys[0] ??
    null;

  let detalle: ReporteDetalle | null = null;
  if (selectedKey) {
    const bucket = buckets.get(selectedKey)!;
    const resumen = byKey.get(selectedKey)!;
    const anterior = byKey.get(addMonthKey(selectedKey, -1)) ?? null;
    const dias = diasDelMes(selectedKey, input.today).map((dia) => ({
      fecha: dia.fecha,
      ventas: bucket.ventasDia.get(dia.fecha) ?? 0,
      compras: bucket.comprasDia.get(dia.fecha) ?? 0,
    }));
    detalle = {
      mes: resumen.mes,
      label: resumen.label,
      resumen,
      anterior,
      proveedores: topProveedores(Array.from(bucket.proveedores.values())),
      salidas: topMovimientos(Array.from(bucket.salidas.values())),
      entradas: topMovimientos(Array.from(bucket.entradas.values())),
      deliveryPorPago: topConteos(Array.from(bucket.deliveryPago.values())),
      deliveryPorEstado: topConteos(Array.from(bucket.deliveryEstado.values())),
      deliveryPorTienda: topConteos(Array.from(bucket.deliveryTienda.values())),
      dias,
    };
  }

  return {
    mesActivo: monthStartFromInput(input.mesActivo) ?? "",
    ratioRecompra: toMoney(input.ratioRecompra),
    tasaUsdDop: toMoney(input.tasaUsdDop),
    meses,
    detalle,
  };
}

export function reporteExportRows(meses: ReporteMes[]): (string | number)[][] {
  return meses.map((mes) => [
    mes.label,
    mes.ventas,
    mes.diasConVenta,
    mes.meta,
    mes.diferenciaMeta,
    Math.round(mes.porcentajeMeta * 1000) / 10,
    mes.compras,
    mes.comprasPagadas,
    mes.comprasPendientes,
    mes.pagosProveedores,
    mes.resultado,
    Math.round(mes.ratioCompras * 1000) / 10,
    mes.deliveryCobrado,
    mes.deliveryPedidos,
    mes.deliveryCancelados,
    mes.deliveryCanceladoMonto,
    mes.turnos,
    mes.turnosVerificados,
    mes.cajaTarjeta,
    mes.cajaEfectivoDop,
    mes.cajaUsd,
    mes.cajaVarianza,
    mes.ledgerEntradasDop,
    mes.ledgerSalidasDop,
    mes.ledgerEntradasUsd,
    mes.ledgerSalidasUsd,
  ]);
}

export function reporteMesInput(mes: string): string {
  return monthInputValue(mes);
}
