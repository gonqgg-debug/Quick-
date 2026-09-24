import { formatMesActivoLabel } from "@/lib/admin-dashboard-shared";
import { dueDateFromCredit } from "@/lib/admin-compras-shared";
import { isMonthKey } from "@/lib/admin-parametros-shared";
import { parseReporteMesParam } from "@/lib/admin-reporte-shared";
import { diaSemanaFromFecha } from "@/lib/admin-ventas-shared";
import { isDayKey } from "@/lib/local-day";
import { toMoney } from "@/lib/money";
import { formatOrderNumber, orderStatusLabel } from "@/lib/order-display";

const COBRADOS = new Set(["completada", "despachada"]);

export type ContableComprobacion = {
  id: string;
  titulo: string;
  formula: string;
  izquierda: number;
  derecha: number;
  diferencia: number;
  cuadra: boolean;
};

export type ContableAlerta = {
  codigo: string;
  mensaje: string;
};

export type ContableDefinicion = {
  campo: string;
  significado: string;
};

export type ContableVenta = {
  id: string;
  fecha: string;
  ventaReal: number;
  diaSemanaCalculado: string;
  diaSemanaRegistrado: string | null;
  diaSemanaCoincide: boolean;
};

export type ContableCompra = {
  id: string;
  proveedorId: string;
  proveedorNombre: string;
  monto: number;
  fecha: string;
  dueDate: string;
  pagado: boolean;
  pagadoEn: string | null;
  vencida: boolean;
  vencimientoEsperado: string;
  vencimientoCoincide: boolean;
};

export type ContablePago = ContableCompra & {
  facturaDeOtroMes: boolean;
};

export type ContableProveedor = {
  id: string;
  nombre: string;
  tieneCredito: boolean;
  diasCredito: number;
  notas: string | null;
  facturasEnMes: number;
  montoFacturadoEnMes: number;
  pendienteEnMes: number;
  pagosEnMes: number;
};

export type ContableTurno = {
  id: string;
  fecha: string;
  turno: string;
  sistemaTarjeta: number;
  sistemaEfectivo: number;
  reportadoTarjeta: number;
  reportadoEfectivo: number;
  reportadoUsd: number;
  verificado: boolean;
  notas: string | null;
  efectivoDop: number;
  varTarjeta: number;
  varEfectivo: number;
  varTotal: number;
};

export type ContableLedger = {
  id: string;
  fecha: string;
  caja: "Fuerte" | "Chica";
  moneda: "DOP" | "USD";
  tipo: "Entrada" | "Salida";
  monto: number;
  concepto: string | null;
  referencia: string | null;
};

export type ContablePedido = {
  id: string;
  numero: string;
  createdAt: string;
  fecha: string;
  estado: string;
  estadoLabel: string;
  metodoPago: string;
  totalEstimado: number;
  pagoCon: number | null;
  tienda: string;
  esPrueba: boolean;
  cuentaComoCobrado: boolean;
};

export type ContableOmitida = {
  fuente: string;
  id: string | null;
  motivo: string;
};

export type ContableCajaMovimiento = {
  caja: "Fuerte" | "Chica";
  moneda: "DOP" | "USD";
  entradas: number;
  salidas: number;
};

export type ContableSaldos = {
  nota: string;
  fuerteDop: number;
  fuerteUsd: number;
  chicaDop: number;
  saldoInicialFuerteDop: number;
  saldoInicialFuerteUsd: number;
  saldoInicialChicaDop: number;
  turnosVerificadosHastaCierre: number;
  efectivoTurnosVerificadosDop: number;
  usdTurnosVerificados: number;
  ledgerHastaCierre: ContableCajaMovimiento[];
};

export type ContableResumen = {
  ventas: number;
  diasConVenta: number;
  meta: number | null;
  diferenciaMeta: number | null;
  compras: number;
  comprasPagadas: number;
  comprasPendientes: number;
  pagosProveedores: number;
  resultado: number;
  ratioCompras: number | null;
  deliveryCobrado: number;
  deliveryPedidos: number;
  deliveryCancelado: number;
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

export type ReporteContable = {
  version: 1;
  generadoEn: string;
  zonaHoraria: "America/Santo_Domingo";
  monedaPrincipal: "DOP";
  mes: string;
  label: string;
  periodo: { desde: string; hasta: string };
  uso: string;
  revision: { aritmeticaCuadra: boolean; alertas: number; filasOmitidas: number };
  advertencias: ContableAlerta[];
  definiciones: ContableDefinicion[];
  parametros: {
    mesActivo: string;
    ratioRecompra: number;
    umbralCuidado: number;
    umbralStop: number;
    pesoReciente: number;
    pesoIntermedio: number;
    pesoAntiguo: number;
    tasaUsdDop: number | null;
    objetivoCajaChicaDop: number | null;
  };
  meta: number | null;
  resumen: ContableResumen;
  cruces: {
    delivery: { ventasTienda: number; deliveryCobrado: number; diferencia: number; nota: string };
    caja: { ventasTienda: number; tarjetaReportada: number; efectivoDop: number; usdReportado: number; nota: string };
  };
  saldosAlCierre: ContableSaldos | null;
  comprobaciones: ContableComprobacion[];
  conteos: {
    ventas: number;
    compras: number;
    pagos: number;
    proveedoresConMovimiento: number;
    proveedoresSinMovimiento: number;
    turnos: number;
    ledger: number;
    pedidos: number;
    pedidosPrueba: number;
  };
  ventasDiarias: ContableVenta[];
  compras: ContableCompra[];
  pagosProveedores: ContablePago[];
  proveedores: ContableProveedor[];
  turnos: ContableTurno[];
  ledger: ContableLedger[];
  pedidos: ContablePedido[];
  pedidosPrueba: ContablePedido[];
  filasOmitidas: ContableOmitida[];
};

export type ContableVentaInput = {
  id: string;
  fecha: string;
  ventaReal: number;
  diaSemanaRegistrado: string | null;
};

export type ContableCompraInput = {
  id: string;
  proveedorId: string;
  proveedorNombre: string;
  monto: number;
  fecha: string;
  dueDate: string;
  pagado: boolean;
  pagadoEn: string | null;
};

export type ContableProveedorInput = {
  id: string;
  nombre: string;
  tieneCredito: boolean;
  diasCredito: number;
  notas: string | null;
};

export type ContableTurnoInput = {
  id: string;
  fecha: string;
  turno: string;
  sistemaTarjeta: number;
  sistemaEfectivo: number;
  reportadoTarjeta: number;
  reportadoEfectivo: number;
  reportadoUsd: number;
  verificado: boolean;
  notas: string | null;
};

export type ContableLedgerInput = {
  id: string;
  fecha: string;
  caja: "Fuerte" | "Chica";
  moneda: "DOP" | "USD";
  tipo: "Entrada" | "Salida";
  monto: number;
  concepto: string | null;
  referencia: string | null;
};

export type ContablePedidoInput = {
  id: string;
  createdAt: string;
  fecha: string;
  estado: string;
  metodoPago: string;
  totalEstimado: number;
  pagoCon: number | null;
  tienda: string;
  esPrueba: boolean;
};

export type ReporteContableInput = {
  generadoEn: string;
  today: string;
  monthKey: string;
  mesActivo: string;
  ratioRecompra: number;
  umbralCuidado: number;
  umbralStop: number;
  pesoReciente: number;
  pesoIntermedio: number;
  pesoAntiguo: number;
  meta: number | null;
  tasaUsdDop: number | null;
  objetivoCajaChicaDop: number | null;
  saldosIniciales: { fuerteDop: number; fuerteUsd: number; chicaDop: number } | null;
  ventas: ContableVentaInput[];
  compras: ContableCompraInput[];
  proveedores: ContableProveedorInput[];
  turnos: ContableTurnoInput[];
  ledger: ContableLedgerInput[];
  pedidos: ContablePedidoInput[];
  filasOmitidas: ContableOmitida[];
};

export const REPORTE_CONTABLE_DEFINICIONES: ContableDefinicion[] = [
  {
    campo: "ventasDiarias",
    significado:
      "Filas de ventas_diarias con fecha dentro del mes. Es el registro de venta de tienda. Un día sin fila no es una venta en cero: no existe.",
  },
  {
    campo: "compras",
    significado:
      "Facturas de compras con fecha dentro del mes. El monto es el de la factura, no el costo de lo vendido. pagado y pagadoEn son el estado actual, no un cierre histórico.",
  },
  {
    campo: "pagosProveedores",
    significado:
      "Facturas marcadas pagadas cuyo pagadoEn cae en el mes, aunque la factura sea de otro mes. Es el desembolso registrado, no una salida de caja automática.",
  },
  {
    campo: "proveedores",
    significado:
      "Proveedores con facturas o pagos en el mes. diasCredito y tieneCredito salen del catálogo vigente. proveedoresSinMovimiento cuenta el resto del catálogo, que no se lista.",
  },
  {
    campo: "turnos",
    significado:
      "Cierres de caja_turnos del mes, verificados y no verificados. efectivoDop = reportadoEfectivo - reportadoUsd * tasaUsdDop. varTotal = reportadoTarjeta + reportadoEfectivo - sistemaTarjeta - sistemaEfectivo. La tarjeta no entra al saldo de caja.",
  },
  {
    campo: "ledger",
    significado:
      "Movimientos de caja_ledger con fecha dentro del mes, por caja (Fuerte o Chica), moneda y tipo. concepto y referencia son texto libre.",
  },
  {
    campo: "pedidos",
    significado:
      "Pedidos reales creados en el mes, hora de America/Santo_Domingo. cuentaComoCobrado es verdadero si el estado es despachada o completada. El resumen no incluye pruebas ni se suma a ventasDiarias.",
  },
  {
    campo: "pedidosPrueba",
    significado: "Pedidos con es_prueba. Están listados para no ocultarlos y no entran en deliveryCobrado.",
  },
  {
    campo: "saldosAlCierre",
    significado:
      "Saldo estimado al último día del mes: saldo inicial configurado + turnos verificados con fecha hasta ese día + ledger hasta ese día. Usa la tasa USD vigente, no la del día del turno. Los turnos no verificados no entran.",
  },
  {
    campo: "comprobaciones",
    significado:
      "Cada fila recompute un total a partir de las líneas y lo compara con resumen o con la fórmula de saldo. cuadra es falso si la diferencia pasa de un centavo. revision.aritmeticaCuadra resume todas.",
  },
  {
    campo: "resumen.resultado",
    significado: "ventas del mes menos compras con fecha en el mes. No resta el ledger ni el delivery.",
  },
];

const USO =
  "Paquete de detalle contable de un mes. Usa las líneas y las comprobaciones para armar o verificar asientos. No completes huecos: un día o un concepto ausente no es cero. Lee advertencias antes de interpretar saldos, pagos o delivery.";

export function reporteContablePeriodo(monthKey: string): { from: string; to: string; mes: string; label: string } | null {
  const key = parseReporteMesParam(monthKey);
  if (!key || !isMonthKey(key)) {
    return null;
  }
  const year = Number(key.slice(0, 4));
  const month = Number(key.slice(5, 7));
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const from = `${key}-01`;
  const to = `${key}-${String(days).padStart(2, "0")}`;
  return { from, to, mes: from, label: formatMesActivoLabel(year, month) };
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + toMoney(value), 0);
}

function inRange(fecha: string, from: string, to: string): boolean {
  return isDayKey(fecha) && fecha >= from && fecha <= to;
}

function normDia(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/á/g, "a")
    .replace(/é/g, "e")
    .replace(/í/g, "i")
    .replace(/ó/g, "o")
    .replace(/ú/g, "u")
    .replace(/ü/g, "u");
}

function check(id: string, titulo: string, formula: string, izquierda: number, derecha: number): ContableComprobacion {
  const diferencia = Math.round((izquierda - derecha) * 100) / 100;
  return {
    id,
    titulo,
    formula,
    izquierda,
    derecha,
    diferencia,
    cuadra: Math.round(izquierda * 100) === Math.round(derecha * 100),
  };
}

function byFechaId<T extends { fecha: string; id: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id));
}

function efectivoDop(reportadoEfectivo: number, reportadoUsd: number, tasaUsdDop: number): number {
  return reportadoEfectivo - reportadoUsd * tasaUsdDop;
}

function ledgerTotales(rows: ContableLedgerInput[]): ContableCajaMovimiento[] {
  const map = new Map<string, ContableCajaMovimiento>();
  for (const row of rows) {
    const key = `${row.caja}:${row.moneda}`;
    const current = map.get(key) ?? { caja: row.caja, moneda: row.moneda, entradas: 0, salidas: 0 };
    if (row.tipo === "Entrada") {
      current.entradas += toMoney(row.monto);
    } else {
      current.salidas += toMoney(row.monto);
    }
    map.set(key, current);
  }
  return Array.from(map.values()).sort((a, b) => a.caja.localeCompare(b.caja) || a.moneda.localeCompare(b.moneda));
}

function montoLedger(rows: ContableCajaMovimiento[], caja: "Fuerte" | "Chica", moneda: "DOP" | "USD", tipo: "entradas" | "salidas"): number {
  return rows.find((row) => row.caja === caja && row.moneda === moneda)?.[tipo] ?? 0;
}

export function buildReporteContable(input: ReporteContableInput): ReporteContable {
  const periodo = reporteContablePeriodo(input.monthKey);
  if (!periodo) {
    throw new Error("El mes no es válido");
  }
  const { from, to } = periodo;
  const tasa = input.tasaUsdDop ?? 0;
  const proveedoresPorId = new Map(input.proveedores.map((proveedor) => [proveedor.id, proveedor]));
  const advertencias: ContableAlerta[] = [];

  const ventasDiarias = byFechaId(
    input.ventas.filter((venta) => inRange(venta.fecha, from, to)).map((venta) => {
      const calculado = diaSemanaFromFecha(venta.fecha);
      const registrado = venta.diaSemanaRegistrado?.trim() || null;
      const coincide = !registrado || normDia(registrado) === normDia(calculado);
      return {
        id: venta.id,
        fecha: venta.fecha,
        ventaReal: toMoney(venta.ventaReal),
        diaSemanaCalculado: calculado,
        diaSemanaRegistrado: registrado,
        diaSemanaCoincide: coincide,
      };
    })
  );
  const diasDistintos = ventasDiarias.filter((venta) => !venta.diaSemanaCoincide);
  if (diasDistintos.length > 0) {
    advertencias.push({
      codigo: "dia-semana",
      mensaje: `${diasDistintos.length} ventas tienen un día de semana registrado distinto al de la fecha: ${diasDistintos
        .map((venta) => venta.fecha)
        .join(", ")}.`,
    });
  }

  const compras: ContableCompra[] = byFechaId(
    input.compras.filter((compra) => inRange(compra.fecha, from, to)).map((compra) => mapCompra(compra, proveedoresPorId, input.today))
  );
  const pagosProveedores: ContablePago[] = byFechaId(
    input.compras
      .filter((compra) => compra.pagado && compra.pagadoEn != null && inRange(compra.pagadoEn, from, to))
      .map((compra) => ({
        ...mapCompra(compra, proveedoresPorId, input.today),
        facturaDeOtroMes: !inRange(compra.fecha, from, to),
      }))
  );

  const vencimientosDistintos = compras.filter((compra) => !compra.vencimientoCoincide);
  if (vencimientosDistintos.length > 0) {
    advertencias.push({
      codigo: "vencimiento",
      mensaje: `${vencimientosDistintos.length} facturas del mes vencen en una fecha distinta a la calculada con los días de crédito del proveedor.`,
    });
  }
  const proveedoresDesconocidos = compras.filter((compra) => !proveedoresPorId.has(compra.proveedorId));
  if (proveedoresDesconocidos.length > 0) {
    advertencias.push({
      codigo: "proveedor-desconocido",
      mensaje: `${proveedoresDesconocidos.length} facturas apuntan a un proveedor que no está en el catálogo.`,
    });
  }

  const actividad = new Map<string, ContableProveedor>();
  const ensureProveedor = (proveedorId: string, nombre: string): ContableProveedor => {
    const existing = actividad.get(proveedorId);
    if (existing) {
      return existing;
    }
    const catalogo = proveedoresPorId.get(proveedorId);
    const creado: ContableProveedor = {
      id: proveedorId,
      nombre: catalogo?.nombre || nombre || "Sin proveedor",
      tieneCredito: catalogo?.tieneCredito ?? false,
      diasCredito: catalogo?.diasCredito ?? 0,
      notas: catalogo?.notas ?? null,
      facturasEnMes: 0,
      montoFacturadoEnMes: 0,
      pendienteEnMes: 0,
      pagosEnMes: 0,
    };
    actividad.set(proveedorId, creado);
    return creado;
  };
  for (const compra of compras) {
    const row = ensureProveedor(compra.proveedorId, compra.proveedorNombre);
    row.facturasEnMes += 1;
    row.montoFacturadoEnMes += compra.monto;
    if (!compra.pagado) {
      row.pendienteEnMes += compra.monto;
    }
  }
  for (const pago of pagosProveedores) {
    const row = ensureProveedor(pago.proveedorId, pago.proveedorNombre);
    row.pagosEnMes += pago.monto;
  }
  const proveedores = Array.from(actividad.values()).sort(
    (a, b) => b.montoFacturadoEnMes - a.montoFacturadoEnMes || a.nombre.localeCompare(b.nombre, "es")
  );

  const turnosMes = byFechaId(input.turnos.filter((turno) => inRange(turno.fecha, from, to))).map((turno) => {
    const reportadoEfectivo = toMoney(turno.reportadoEfectivo);
    const reportadoUsd = toMoney(turno.reportadoUsd);
    const reportadoTarjeta = toMoney(turno.reportadoTarjeta);
    const sistemaTarjeta = toMoney(turno.sistemaTarjeta);
    const sistemaEfectivo = toMoney(turno.sistemaEfectivo);
    const efectivo = efectivoDop(reportadoEfectivo, reportadoUsd, tasa);
    return {
      id: turno.id,
      fecha: turno.fecha,
      turno: turno.turno,
      sistemaTarjeta,
      sistemaEfectivo,
      reportadoTarjeta,
      reportadoEfectivo,
      reportadoUsd,
      verificado: turno.verificado,
      notas: turno.notas,
      efectivoDop: efectivo,
      varTarjeta: reportadoTarjeta - sistemaTarjeta,
      varEfectivo: reportadoEfectivo - sistemaEfectivo,
      varTotal: reportadoTarjeta + reportadoEfectivo - sistemaTarjeta - sistemaEfectivo,
    };
  });
  const turnosSinVerificar = turnosMes.filter((turno) => !turno.verificado).length;
  if (turnosSinVerificar > 0) {
    advertencias.push({
      codigo: "turnos-sin-verificar",
      mensaje: `${turnosSinVerificar} turnos del mes no están verificados. Entran al detalle y a la varianza, pero no al saldo de caja.`,
    });
  }

  const ledgerMes = byFechaId(input.ledger.filter((row) => inRange(row.fecha, from, to))).map((row) => ({
    ...row,
    monto: toMoney(row.monto),
  }));
  if (ledgerMes.some((row) => row.caja === "Chica" && row.moneda === "USD")) {
    advertencias.push({
      codigo: "caja-chica-usd",
      mensaje: "Hay movimientos en USD de caja chica. Esa combinación no se usa en los saldos.",
    });
  }

  const pedidosTodos = input.pedidos
    .filter((pedido) => inRange(pedido.fecha, from, to))
    .map((pedido) => mapPedido(pedido))
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id));
  const pedidos = pedidosTodos.filter((pedido) => !pedido.esPrueba);
  const pedidosPrueba = pedidosTodos.filter((pedido) => pedido.esPrueba);

  const ventas = sum(ventasDiarias.map((venta) => venta.ventaReal));
  const comprasTotal = sum(compras.map((compra) => compra.monto));
  const comprasPagadas = sum(compras.filter((compra) => compra.pagado).map((compra) => compra.monto));
  const pagosTotal = sum(pagosProveedores.map((pago) => pago.monto));
  const deliveryCobrado = sum(pedidos.filter((pedido) => pedido.cuentaComoCobrado).map((pedido) => pedido.totalEstimado));
  const deliveryCancelado = sum(pedidos.filter((pedido) => pedido.estado === "cancelada").map((pedido) => pedido.totalEstimado));
  const resumen: ContableResumen = {
    ventas,
    diasConVenta: new Set(ventasDiarias.map((venta) => venta.fecha)).size,
    meta: input.meta,
    diferenciaMeta: input.meta == null ? null : ventas - input.meta,
    compras: comprasTotal,
    comprasPagadas,
    comprasPendientes: comprasTotal - comprasPagadas,
    pagosProveedores: pagosTotal,
    resultado: ventas - comprasTotal,
    ratioCompras: ventas > 0 ? comprasTotal / ventas : null,
    deliveryCobrado,
    deliveryPedidos: pedidos.filter((pedido) => pedido.cuentaComoCobrado).length,
    deliveryCancelado,
    turnos: turnosMes.length,
    turnosVerificados: turnosMes.filter((turno) => turno.verificado).length,
    cajaTarjeta: sum(turnosMes.map((turno) => turno.reportadoTarjeta)),
    cajaEfectivoDop: sum(turnosMes.map((turno) => turno.efectivoDop)),
    cajaUsd: sum(turnosMes.map((turno) => turno.reportadoUsd)),
    cajaVarianza: sum(turnosMes.map((turno) => turno.varTotal)),
    ledgerEntradasDop: sum(ledgerMes.filter((row) => row.moneda === "DOP" && row.tipo === "Entrada").map((row) => row.monto)),
    ledgerSalidasDop: sum(ledgerMes.filter((row) => row.moneda === "DOP" && row.tipo === "Salida").map((row) => row.monto)),
    ledgerEntradasUsd: sum(ledgerMes.filter((row) => row.moneda === "USD" && row.tipo === "Entrada").map((row) => row.monto)),
    ledgerSalidasUsd: sum(ledgerMes.filter((row) => row.moneda === "USD" && row.tipo === "Salida").map((row) => row.monto)),
  };

  if (tasa <= 0 && (resumen.cajaUsd > 0 || resumen.ledgerEntradasUsd > 0 || resumen.ledgerSalidasUsd > 0)) {
    advertencias.push({
      codigo: "sin-tasa-usd",
      mensaje: "No hay tasa USD vigente. El efectivo en pesos no resta los dólares contados dentro del turno.",
    });
  }
  if (input.filasOmitidas.length > 0) {
    advertencias.push({
      codigo: "filas-omitidas",
      mensaje: `${input.filasOmitidas.length} filas no entraron al detalle porque les faltaba un dato obligatorio. Están en filasOmitidas.`,
    });
  }
  if (input.saldosIniciales == null) {
    advertencias.push({
      codigo: "sin-parametros-caja",
      mensaje: "No hay parámetros de caja. El paquete no trae saldo al cierre.",
    });
  }

  const turnosSaldo = input.turnos.filter((turno) => turno.verificado && isDayKey(turno.fecha) && turno.fecha <= to);
  const efectivoTurnos = sum(
    turnosSaldo.map((turno) => efectivoDop(toMoney(turno.reportadoEfectivo), toMoney(turno.reportadoUsd), tasa))
  );
  const usdTurnos = sum(turnosSaldo.map((turno) => toMoney(turno.reportadoUsd)));
  const ledgerSaldo = ledgerTotales(input.ledger.filter((row) => isDayKey(row.fecha) && row.fecha <= to));
  const saldosAlCierre = input.saldosIniciales
    ? {
        nota: "Saldo al cierre del mes con la fórmula viva de caja: inicial + turnos verificados hasta el cierre + ledger hasta el cierre. La tasa USD es la vigente hoy.",
        fuerteDop:
          input.saldosIniciales.fuerteDop +
          efectivoTurnos +
          montoLedger(ledgerSaldo, "Fuerte", "DOP", "entradas") -
          montoLedger(ledgerSaldo, "Fuerte", "DOP", "salidas"),
        fuerteUsd:
          input.saldosIniciales.fuerteUsd +
          usdTurnos +
          montoLedger(ledgerSaldo, "Fuerte", "USD", "entradas") -
          montoLedger(ledgerSaldo, "Fuerte", "USD", "salidas"),
        chicaDop:
          input.saldosIniciales.chicaDop +
          montoLedger(ledgerSaldo, "Chica", "DOP", "entradas") -
          montoLedger(ledgerSaldo, "Chica", "DOP", "salidas"),
        saldoInicialFuerteDop: input.saldosIniciales.fuerteDop,
        saldoInicialFuerteUsd: input.saldosIniciales.fuerteUsd,
        saldoInicialChicaDop: input.saldosIniciales.chicaDop,
        turnosVerificadosHastaCierre: turnosSaldo.length,
        efectivoTurnosVerificadosDop: efectivoTurnos,
        usdTurnosVerificados: usdTurnos,
        ledgerHastaCierre: ledgerSaldo,
      }
    : null;

  const comprobaciones: ContableComprobacion[] = [
    check("ventas-suma", "Ventas", "sum(ventasDiarias.ventaReal) = resumen.ventas", sum(ventasDiarias.map((venta) => venta.ventaReal)), resumen.ventas),
    check("compras-suma", "Compras del mes", "sum(compras.monto) = resumen.compras", sum(compras.map((compra) => compra.monto)), resumen.compras),
    check(
      "compras-pagadas",
      "Compras pagadas",
      "sum(compras pagadas) = resumen.comprasPagadas",
      sum(compras.filter((compra) => compra.pagado).map((compra) => compra.monto)),
      resumen.comprasPagadas
    ),
    check(
      "compras-pendientes",
      "Compras pendientes",
      "compras - comprasPagadas = resumen.comprasPendientes",
      resumen.compras - resumen.comprasPagadas,
      resumen.comprasPendientes
    ),
    check("pagos-suma", "Pagos a proveedores", "sum(pagosProveedores.monto) = resumen.pagosProveedores", sum(pagosProveedores.map((pago) => pago.monto)), resumen.pagosProveedores),
    check("resultado", "Ventas menos compras", "ventas - compras = resumen.resultado", resumen.ventas - resumen.compras, resumen.resultado),
    check(
      "proveedores-facturado",
      "Facturado por proveedor",
      "sum(proveedores.montoFacturadoEnMes) = resumen.compras",
      sum(proveedores.map((proveedor) => proveedor.montoFacturadoEnMes)),
      resumen.compras
    ),
    check(
      "proveedores-pagos",
      "Pagos por proveedor",
      "sum(proveedores.pagosEnMes) = resumen.pagosProveedores",
      sum(proveedores.map((proveedor) => proveedor.pagosEnMes)),
      resumen.pagosProveedores
    ),
    check("turnos-tarjeta", "Tarjeta reportada", "sum(turnos.reportadoTarjeta) = resumen.cajaTarjeta", sum(turnosMes.map((turno) => turno.reportadoTarjeta)), resumen.cajaTarjeta),
    check("turnos-efectivo", "Efectivo DOP", "sum(turnos.efectivoDop) = resumen.cajaEfectivoDop", sum(turnosMes.map((turno) => turno.efectivoDop)), resumen.cajaEfectivoDop),
    check("turnos-varianza", "Varianza de turnos", "sum(turnos.varTotal) = resumen.cajaVarianza", sum(turnosMes.map((turno) => turno.varTotal)), resumen.cajaVarianza),
    check(
      "ledger-salidas-dop",
      "Salidas DOP",
      "sum(ledger salida DOP) = resumen.ledgerSalidasDop",
      sum(ledgerMes.filter((row) => row.moneda === "DOP" && row.tipo === "Salida").map((row) => row.monto)),
      resumen.ledgerSalidasDop
    ),
    check(
      "ledger-entradas-dop",
      "Entradas DOP",
      "sum(ledger entrada DOP) = resumen.ledgerEntradasDop",
      sum(ledgerMes.filter((row) => row.moneda === "DOP" && row.tipo === "Entrada").map((row) => row.monto)),
      resumen.ledgerEntradasDop
    ),
    check(
      "delivery-cobrado",
      "Delivery cobrado",
      "sum(pedidos reales despachados o completados) = resumen.deliveryCobrado",
      sum(pedidos.filter((pedido) => pedido.cuentaComoCobrado).map((pedido) => pedido.totalEstimado)),
      resumen.deliveryCobrado
    ),
    check(
      "delivery-prueba-excluida",
      "Pruebas fuera del delivery cobrado",
      "delivery cobrado + pruebas cobrables = todos los pedidos cobrables",
      resumen.deliveryCobrado +
        sum(pedidosPrueba.filter((pedido) => pedido.cuentaComoCobrado).map((pedido) => pedido.totalEstimado)),
      sum(
        pedidosTodos.filter((pedido) => pedido.cuentaComoCobrado).map((pedido) => pedido.totalEstimado)
      )
    ),
  ];
  if (saldosAlCierre && input.saldosIniciales) {
    comprobaciones.push(
      check(
        "saldo-fuerte-dop",
        "Saldo caja fuerte DOP",
        "inicial + efectivo de turnos verificados hasta el cierre + entradas ledger - salidas ledger",
        input.saldosIniciales.fuerteDop +
          saldosAlCierre.efectivoTurnosVerificadosDop +
          montoLedger(saldosAlCierre.ledgerHastaCierre, "Fuerte", "DOP", "entradas") -
          montoLedger(saldosAlCierre.ledgerHastaCierre, "Fuerte", "DOP", "salidas"),
        saldosAlCierre.fuerteDop
      ),
      check(
        "saldo-fuerte-usd",
        "Saldo caja fuerte USD",
        "inicial + USD de turnos verificados hasta el cierre + entradas ledger - salidas ledger",
        input.saldosIniciales.fuerteUsd +
          saldosAlCierre.usdTurnosVerificados +
          montoLedger(saldosAlCierre.ledgerHastaCierre, "Fuerte", "USD", "entradas") -
          montoLedger(saldosAlCierre.ledgerHastaCierre, "Fuerte", "USD", "salidas"),
        saldosAlCierre.fuerteUsd
      ),
      check(
        "saldo-chica-dop",
        "Saldo caja chica DOP",
        "inicial + entradas ledger - salidas ledger, sin turnos",
        input.saldosIniciales.chicaDop +
          montoLedger(saldosAlCierre.ledgerHastaCierre, "Chica", "DOP", "entradas") -
          montoLedger(saldosAlCierre.ledgerHastaCierre, "Chica", "DOP", "salidas"),
        saldosAlCierre.chicaDop
      )
    );
  }

  return {
    version: 1,
    generadoEn: input.generadoEn,
    zonaHoraria: "America/Santo_Domingo",
    monedaPrincipal: "DOP",
    mes: periodo.mes,
    label: periodo.label,
    periodo: { desde: from, hasta: to },
    uso: USO,
    revision: {
      aritmeticaCuadra: comprobaciones.every((item) => item.cuadra),
      alertas: advertencias.length,
      filasOmitidas: input.filasOmitidas.length,
    },
    advertencias,
    definiciones: REPORTE_CONTABLE_DEFINICIONES,
    parametros: {
      mesActivo: input.mesActivo,
      ratioRecompra: toMoney(input.ratioRecompra),
      umbralCuidado: input.umbralCuidado,
      umbralStop: input.umbralStop,
      pesoReciente: input.pesoReciente,
      pesoIntermedio: input.pesoIntermedio,
      pesoAntiguo: input.pesoAntiguo,
      tasaUsdDop: input.tasaUsdDop,
      objetivoCajaChicaDop: input.objetivoCajaChicaDop,
    },
    meta: input.meta,
    resumen,
    cruces: {
      delivery: {
        ventasTienda: ventas,
        deliveryCobrado,
        diferencia: ventas - deliveryCobrado,
        nota: "No se espera que la venta de tienda y el delivery cobrado sean iguales. Son registros distintos.",
      },
      caja: {
        ventasTienda: ventas,
        tarjetaReportada: resumen.cajaTarjeta,
        efectivoDop: resumen.cajaEfectivoDop,
        usdReportado: resumen.cajaUsd,
        nota: "El recuento de turnos no tiene que cuadrar con la venta diaria. Incluye fondo, dólares y diferencia de conteo.",
      },
    },
    saldosAlCierre,
    comprobaciones,
    conteos: {
      ventas: ventasDiarias.length,
      compras: compras.length,
      pagos: pagosProveedores.length,
      proveedoresConMovimiento: proveedores.length,
      proveedoresSinMovimiento: input.proveedores.filter((proveedor) => !actividad.has(proveedor.id)).length,
      turnos: turnosMes.length,
      ledger: ledgerMes.length,
      pedidos: pedidos.length,
      pedidosPrueba: pedidosPrueba.length,
    },
    ventasDiarias,
    compras,
    pagosProveedores,
    proveedores,
    turnos: turnosMes,
    ledger: ledgerMes,
    pedidos,
    pedidosPrueba,
    filasOmitidas: input.filasOmitidas,
  };
}

function mapCompra(
  compra: ContableCompraInput,
  proveedores: Map<string, ContableProveedorInput>,
  today: string
): ContableCompra {
  const catalogo = proveedores.get(compra.proveedorId);
  const vencimientoEsperado = dueDateFromCredit(compra.fecha, catalogo ?? null);
  const pagadoEn = compra.pagadoEn && isDayKey(compra.pagadoEn) ? compra.pagadoEn : null;
  return {
    id: compra.id,
    proveedorId: compra.proveedorId,
    proveedorNombre: catalogo?.nombre || compra.proveedorNombre || "Sin proveedor",
    monto: toMoney(compra.monto),
    fecha: compra.fecha,
    dueDate: compra.dueDate,
    pagado: compra.pagado,
    pagadoEn,
    vencida: !compra.pagado && isDayKey(compra.dueDate) && isDayKey(today) && compra.dueDate < today,
    vencimientoEsperado,
    vencimientoCoincide: vencimientoEsperado === compra.dueDate,
  };
}

function mapPedido(pedido: ContablePedidoInput): ContablePedido {
  const estado = pedido.estado.trim().toLowerCase();
  const cuentaComoCobrado = COBRADOS.has(estado);
  return {
    id: pedido.id,
    numero: formatOrderNumber(pedido.id),
    createdAt: pedido.createdAt,
    fecha: pedido.fecha,
    estado,
    estadoLabel: orderStatusLabel(estado),
    metodoPago: pedido.metodoPago.trim().toLowerCase(),
    totalEstimado: toMoney(pedido.totalEstimado),
    pagoCon: pedido.pagoCon,
    tienda: pedido.tienda.trim().toLowerCase(),
    esPrueba: pedido.esPrueba,
    cuentaComoCobrado,
  };
}
