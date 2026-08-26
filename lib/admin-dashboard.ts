import {
  formatMesActivoLabel,
  formatTendenciaFecha,
  type AdminDashboardData,
  type DashboardFactura,
  type DashboardSparkPoint,
  type DashboardTendenciaDia,
} from "@/lib/admin-dashboard-shared";
import {
  getComprasDelMes,
  getComprasSemanaActual,
  getDiasTranscurridos,
  getDisponibleMes,
  getDisponibleSemanaActual,
  getFacturasPorVencerEn3Dias,
  getFacturasVencidas,
  getForecastCierreMes,
  getMesActivo,
  getMetaDelDia,
  getMetaMensual,
  getPresupuestoMaximoMes,
  getPresupuestoSemanaActual,
  getUmbralesSemaforo,
  getVentasAcumuladasMes,
  getVentasDiariasMes,
  isoWeekdayIndex,
  type DiaSemanaISO,
  type FacturaPendiente,
  type MesActivo,
} from "@/lib/finanzas";
import { addDaysToDayKey, yesterdayDayKey } from "@/lib/local-day";

const SPARKLINE_DAYS = 14;
const TENDENCIA_DAYS = 7;
const WEEKDAYS: DiaSemanaISO[] = [0, 1, 2, 3, 4, 5, 6];

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function previousMes(mes: MesActivo): MesActivo {
  if (mes.month === 1) {
    return { year: mes.year - 1, month: 12, diasEnMes: 31 };
  }
  const month = mes.month - 1;
  return { year: mes.year, month, diasEnMes: daysInMonth(mes.year, month) };
}

function mapFactura(factura: FacturaPendiente): DashboardFactura {
  return {
    id: factura.id,
    proveedorId: factura.proveedorId,
    proveedorNombre: factura.proveedorNombre,
    monto: factura.monto,
    fecha: factura.fecha,
    dueDate: factura.dueDate,
  };
}

async function loadTendencias(mesActivo: MesActivo): Promise<{
  sparkline14: DashboardSparkPoint[];
  tendencia7: DashboardTendenciaDia[];
}> {
  const yesterday = yesterdayDayKey();
  const monthStart = `${mesActivo.year}-${pad2(mesActivo.month)}-01`;
  const monthEnd = `${mesActivo.year}-${pad2(mesActivo.month)}-${pad2(mesActivo.diasEnMes)}`;
  const sparkFrom = addDaysToDayKey(yesterday, -(SPARKLINE_DAYS - 1));
  const needsPrevMonth = sparkFrom < monthStart;

  const [ventasMes, ventasPrev, metasPorDia] = await Promise.all([
    getVentasDiariasMes(mesActivo),
    needsPrevMonth ? getVentasDiariasMes(previousMes(mesActivo)) : Promise.resolve([]),
    Promise.all(WEEKDAYS.map((dia) => getMetaDelDia(dia, mesActivo))),
  ]);

  const porFecha = new Map(
    [...ventasPrev, ...ventasMes].map((venta) => [venta.fecha, venta.ventaReal] as const)
  );

  const sparkline14: DashboardSparkPoint[] = [];
  for (let offset = 0; offset < SPARKLINE_DAYS; offset += 1) {
    const fecha = addDaysToDayKey(sparkFrom, offset);
    if (fecha > yesterday) {
      break;
    }
    sparkline14.push({ fecha, ventaReal: porFecha.get(fecha) ?? 0 });
  }

  const mesDias: DashboardTendenciaDia[] = [];
  if (yesterday >= monthStart) {
    let fecha = monthStart;
    let acumuladoMes = 0;
    const last = yesterday < monthEnd ? yesterday : monthEnd;
    while (fecha <= last) {
      const weekday = isoWeekdayIndex(fecha);
      const ventaReal = porFecha.get(fecha) ?? 0;
      const metaDelDia = weekday == null ? 0 : metasPorDia[weekday] ?? 0;
      const diferencia = ventaReal - metaDelDia;
      acumuladoMes += diferencia;
      mesDias.push({
        fecha,
        label: formatTendenciaFecha(fecha),
        ventaReal,
        metaDelDia,
        diferencia,
        acumuladoMes,
      });
      fecha = addDaysToDayKey(fecha, 1);
    }
  }

  return {
    sparkline14,
    tendencia7: mesDias.slice(-TENDENCIA_DAYS),
  };
}

export async function loadAdminDashboard(): Promise<AdminDashboardData> {
  const mesActivo = await getMesActivo();
  const [
    ventasAcumuladas,
    metaMensual,
    forecastCierreMes,
    diasTranscurridos,
    comprasDelMes,
    presupuestoMaximoMes,
    disponibleMes,
    presupuestoSemana,
    comprasSemana,
    disponibleSemana,
    facturasVencidas,
    facturasPorVencer,
    umbrales,
    tendencias,
  ] = await Promise.all([
    getVentasAcumuladasMes(mesActivo),
    getMetaMensual(mesActivo),
    getForecastCierreMes(mesActivo),
    getDiasTranscurridos(mesActivo),
    getComprasDelMes(mesActivo),
    getPresupuestoMaximoMes(mesActivo),
    getDisponibleMes(mesActivo),
    getPresupuestoSemanaActual(mesActivo),
    getComprasSemanaActual(),
    getDisponibleSemanaActual(mesActivo),
    getFacturasVencidas(),
    getFacturasPorVencerEn3Dias(),
    getUmbralesSemaforo(),
    loadTendencias(mesActivo),
  ]);

  return {
    mesActivo: formatMesActivoLabel(mesActivo.year, mesActivo.month),
    ventasAcumuladas,
    metaMensual,
    diferenciaVsMeta: ventasAcumuladas - metaMensual,
    porcentajeMeta: metaMensual > 0 ? ventasAcumuladas / metaMensual : 0,
    forecastCierreMes,
    diasRestantes: Math.max(0, mesActivo.diasEnMes - diasTranscurridos),
    comprasDelMes,
    ratioComprasVentas: ventasAcumuladas > 0 ? comprasDelMes / ventasAcumuladas : 0,
    presupuestoMaximoMes,
    disponibleMes,
    presupuestoSemana,
    comprasSemana,
    disponibleSemana,
    facturasVencidas: facturasVencidas.map(mapFactura),
    facturasPorVencer: facturasPorVencer.map(mapFactura),
    umbralCuidado: umbrales.umbralCuidado,
    umbralStop: umbrales.umbralStop,
    sparkline14: tendencias.sparkline14,
    tendencia7: tendencias.tendencia7,
  };
}
