import { getParametrosConfig, listMetasMensuales } from "@/lib/admin-parametros";
import { formatMetaMes, monthStartFromInput } from "@/lib/admin-parametros-shared";
import {
  nivelPorcentajeMeta,
  parseHistoricoMesParam,
  type VentasHistoricoDetalle,
  type VentasHistoricoDia,
  type VentasHistoricoMes,
  type VentasHistoricoResumen,
} from "@/lib/admin-ventas-historico-shared";
import { diaSemanaFromFecha, formatDiaSemana } from "@/lib/admin-ventas-shared";
import {
  getComprasDelMes,
  getMetaDelDia,
  getVentasAcumuladasMes,
  getVentasDiariasMes,
  isoWeekdayIndex,
  type DiaSemanaISO,
  type MesActivo,
} from "@/lib/finanzas";
import { addDaysToDayKey, yesterdayDayKey } from "@/lib/local-day";

const DIAS_SEMANA: DiaSemanaISO[] = [0, 1, 2, 3, 4, 5, 6];

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function toMesActivo(mes: string): MesActivo {
  const start = monthStartFromInput(mes);
  if (!start) {
    throw new Error("El mes no es válido");
  }
  const year = Number(start.slice(0, 4));
  const month = Number(start.slice(5, 7));
  return { year, month, diasEnMes: daysInMonth(year, month) };
}

function lastVisibleDay(mesActivo: MesActivo): string | null {
  const from = `${mesActivo.year}-${pad2(mesActivo.month)}-01`;
  const to = `${mesActivo.year}-${pad2(mesActivo.month)}-${pad2(mesActivo.diasEnMes)}`;
  const yesterday = yesterdayDayKey();
  if (yesterday < from) {
    return null;
  }
  return yesterday < to ? yesterday : to;
}

function mapMesResumen(
  mes: string,
  meta: number,
  ventasReales: number,
  comprasReales: number,
  ratioRecompra: number,
  umbralCuidado: number
): VentasHistoricoMes {
  const porcentajeMeta = meta > 0 ? ventasReales / meta : 0;
  return {
    mes,
    label: formatMetaMes(mes),
    ventasReales,
    meta,
    diferencia: ventasReales - meta,
    porcentajeMeta,
    comprasReales,
    presupuestoMaxCompras: ratioRecompra > 0 ? ventasReales / ratioRecompra : 0,
    nivel: nivelPorcentajeMeta(porcentajeMeta, umbralCuidado),
  };
}

export async function loadVentasHistoricoResumen(): Promise<VentasHistoricoResumen> {
  const [metas, parametros] = await Promise.all([listMetasMensuales(), getParametrosConfig()]);
  const meses = await Promise.all(
    metas.map(async (item) => {
      const mesActivo = toMesActivo(item.mes);
      const [ventasReales, comprasReales] = await Promise.all([
        getVentasAcumuladasMes(mesActivo),
        getComprasDelMes(mesActivo),
      ]);
      return mapMesResumen(
        item.mes,
        item.meta,
        ventasReales,
        comprasReales,
        parametros.ratioRecompra,
        parametros.umbralCuidado
      );
    })
  );

  return {
    mesActivo: parametros.mesActivo,
    umbralCuidado: parametros.umbralCuidado,
    ratioRecompra: parametros.ratioRecompra,
    meses,
  };
}

export async function loadVentasHistoricoDetalle(mesParam: string): Promise<VentasHistoricoDetalle> {
  const mesKey = parseHistoricoMesParam(mesParam);
  if (!mesKey) {
    throw new Error("El mes no es válido");
  }
  const mesActivo = toMesActivo(mesKey);
  const mes = `${mesActivo.year}-${pad2(mesActivo.month)}-01`;
  const hasta = lastVisibleDay(mesActivo);

  const [ventas, metasPorDia, parametros] = await Promise.all([
    getVentasDiariasMes(mesActivo),
    Promise.all(DIAS_SEMANA.map((dia) => getMetaDelDia(dia, mesActivo))),
    getParametrosConfig(),
  ]);

  const porFecha = new Map(ventas.map((venta) => [venta.fecha, venta.ventaReal]));
  const dias: VentasHistoricoDia[] = [];
  if (hasta) {
    let fecha = `${mesActivo.year}-${pad2(mesActivo.month)}-01`;
    let ventasAcumuladas = 0;
    let diferenciaAcumulada = 0;
    while (fecha <= hasta) {
      const ventaReal = porFecha.get(fecha) ?? 0;
      const weekday = isoWeekdayIndex(fecha);
      const metaDelDia = weekday == null ? 0 : metasPorDia[weekday] ?? 0;
      const diferencia = ventaReal - metaDelDia;
      ventasAcumuladas += ventaReal;
      diferenciaAcumulada += diferencia;
      dias.push({
        fecha,
        dia: formatDiaSemana(diaSemanaFromFecha(fecha)),
        ventaReal,
        metaDelDia,
        diferencia,
        diferenciaAcumulada,
        ventasAcumuladas,
        superado: ventaReal >= metaDelDia,
      });
      fecha = addDaysToDayKey(fecha, 1);
    }
  }

  return {
    mes,
    label: formatMetaMes(mes),
    esMesActivo: parametros.mesActivo === mes,
    hasta,
    dias,
  };
}
