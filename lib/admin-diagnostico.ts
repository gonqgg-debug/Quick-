import { DIAGNOSTICO_DIAS, mesRefLabel, type DiagnosticoForecast } from "@/lib/admin-diagnostico-shared";
import {
  getDiasTranscurridos,
  getForecastCierreMes,
  getMesActivo,
  getPromediosPonderadosDesglose,
  getPromediosPonderadosPorDiaSemana,
  getVentasAcumuladasMes,
  sumaPromediosPonderados,
} from "@/lib/finanzas";

export async function loadDiagnosticoForecast(): Promise<DiagnosticoForecast> {
  const mesActivo = await getMesActivo();
  const [ponderados, desglose, forecastCierreMes, ventasAcumuladas, diasTranscurridos] = await Promise.all([
    getPromediosPonderadosPorDiaSemana(mesActivo),
    getPromediosPonderadosDesglose(mesActivo),
    getForecastCierreMes(mesActivo),
    getVentasAcumuladasMes(mesActivo),
    getDiasTranscurridos(mesActivo),
  ]);

  const sumaPonderado = sumaPromediosPonderados(ponderados);
  const diasRestantes = Math.max(0, mesActivo.diasEnMes - diasTranscurridos);

  return {
    mesActivo: { ...mesRefLabel(mesActivo.year, mesActivo.month), diasEnMes: mesActivo.diasEnMes },
    meses: {
      m1: mesRefLabel(desglose.m1.year, desglose.m1.month),
      m2: mesRefLabel(desglose.m2.year, desglose.m2.month),
      m3: mesRefLabel(desglose.m3.year, desglose.m3.month),
    },
    pesos: {
      reciente: desglose.pesoReciente,
      intermedio: desglose.pesoIntermedio,
      antiguo: desglose.pesoAntiguo,
    },
    dias: DIAGNOSTICO_DIAS.map((dia) => ({
      iso: dia.iso,
      nombre: dia.nombre,
      avgM1: desglose.avgM1[dia.iso],
      avgM2: desglose.avgM2[dia.iso],
      avgM3: desglose.avgM3[dia.iso],
      ponderado: ponderados[dia.iso],
    })),
    sumaPonderado,
    ventasAcumuladas,
    diasTranscurridos,
    diasRestantes,
    forecastCierreMes,
  };
}
