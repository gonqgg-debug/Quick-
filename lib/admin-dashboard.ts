import {
  formatMesActivoLabel,
  type AdminDashboardData,
  type DashboardFactura,
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
  getMetaMensual,
  getPresupuestoMaximoMes,
  getPresupuestoSemanaActual,
  getUmbralesSemaforo,
  getVentasAcumuladasMes,
  type FacturaPendiente,
} from "@/lib/finanzas";

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
  };
}
