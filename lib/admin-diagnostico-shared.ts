import { formatMesActivoLabel } from "@/lib/admin-dashboard-shared";
import { toMoney } from "@/lib/money";

export type DiagnosticoDia = {
  iso: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  nombre: string;
  avgM1: number;
  avgM2: number;
  avgM3: number;
  ponderado: number;
};

export type DiagnosticoMesRef = {
  year: number;
  month: number;
  label: string;
};

export type DiagnosticoForecast = {
  mesActivo: DiagnosticoMesRef & { diasEnMes: number };
  meses: {
    m1: DiagnosticoMesRef;
    m2: DiagnosticoMesRef;
    m3: DiagnosticoMesRef;
  };
  pesos: {
    reciente: number;
    intermedio: number;
    antiguo: number;
  };
  dias: DiagnosticoDia[];
  sumaPonderado: number;
  ventasAcumuladas: number;
  diasTranscurridos: number;
  diasRestantes: number;
  forecastCierreMes: number;
};

export const DIAGNOSTICO_DIAS: Array<{ iso: DiagnosticoDia["iso"]; nombre: string }> = [
  { iso: 0, nombre: "Lunes" },
  { iso: 1, nombre: "Martes" },
  { iso: 2, nombre: "Miércoles" },
  { iso: 3, nombre: "Jueves" },
  { iso: 4, nombre: "Viernes" },
  { iso: 5, nombre: "Sábado" },
  { iso: 6, nombre: "Domingo" },
];

export function mesRefLabel(year: number, month: number): DiagnosticoMesRef {
  return { year, month, label: formatMesActivoLabel(year, month) };
}

export function formatDiagnosticoAmount(value: number): string {
  const amount = toMoney(value);
  const hasDecimals = Math.round(amount * 100) % 100 !== 0;
  return new Intl.NumberFormat("es-DO", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatPesoHeader(reciente: number, intermedio: number, antiguo: number): string {
  const pct = (value: number) => Math.round(toMoney(value) * 100);
  return `${pct(reciente)}/${pct(intermedio)}/${pct(antiguo)}`;
}

export function formulaForecastCierreMes(data: Pick<
  DiagnosticoForecast,
  "ventasAcumuladas" | "diasRestantes" | "sumaPonderado" | "forecastCierreMes"
>): string {
  return `${formatDiagnosticoAmount(data.ventasAcumuladas)} + ${data.diasRestantes} × (${formatDiagnosticoAmount(data.sumaPonderado)} / 7) = ${formatDiagnosticoAmount(data.forecastCierreMes)}`;
}
