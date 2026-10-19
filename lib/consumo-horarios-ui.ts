import { fechasEsperadas, type ModoComparacion } from "@/lib/consumo-metricas";
import { fechaComparadaDe, prepararHallazgo, textoAlcance, type AlcanceHallazgo, type HallazgoDestacado } from "@/lib/consumo-resumen-ui";
import { isoWeekdayMonday1, STAFF_TIMEZONE } from "@/lib/local-day";
import { leerVisual } from "@/lib/miles-presentacion";
import { formatNumero, formatPct, formatRd, formatUnidades } from "@/lib/pos-domain";

export const NOTA_ZONA = "Horas locales de República Dominicana.";

export const NOTA_HORARIO =
  "No hay un horario de tienda configurado. Se muestran las 24 horas. No se deduce el horario a partir de las ventas. Una hora sin transacciones no indica que la tienda estuviera cerrada ni que falten datos.";

export const CRITERIO_TURNO =
  "AM y PM dependen de la hora en que se abrió la caja: antes de las 2:00 p. m. es AM y desde esa hora es PM. No es un corte de las ventas a las 2:00 p. m. Son las transacciones del periodo, agrupadas por el tipo de sesión al que pertenecen.";

export const NOTA_TICKET_CATEGORIA =
  "Ticket promedio de la categoría: venta de la categoría dividida entre los tickets distintos que la contienen. No es el importe completo de la canasta.";

export const TEXTO_RELOJ = {
  real: "Hora de la transacción. Cada venta queda en su fecha y hora local, también si ocurre después de medianoche.",
  caja: "Día operativo de caja. La venta queda en el día en que se abrió la caja. Una venta después de medianoche sigue en ese día. La hora sigue siendo la de la transacción.",
} as const;

export const DIAS_LARGOS = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"] as const;
export const DIAS_CORTOS = ["", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;

export type MetricaId = "venta" | "tickets" | "ticket" | "unidades";
export type CalculoId = "total" | "promedio";
export type VistaId = "actividad" | "cambio";
export type CambioModo = "absoluto" | "porcentaje";
export type RelojId = "real" | "caja";
export type CoberturaHora = "completa" | "parcial" | "desconocida";
export type EstadoVisual = "con_ventas" | "cero" | "sin_datos" | "parcial" | "desconocida";

export type FilaHora = {
  fecha: string;
  hora: number;
  venta: number;
  tickets: number;
  unidades: number;
  cobertura: CoberturaHora;
};

export type CambioValor = {
  estado: "sin_comparacion" | "sin_base" | "ambos_cero" | "ok";
  absoluto: number | null;
  porcentaje: number | null;
  base: "total" | "promedio" | "ticket";
  observacionesActual: number;
  observacionesAnterior: number;
};

export type ComparacionCelda = {
  fechasEquivalentes: number;
  fechasCompletas: number;
  venta: number | null;
  tickets: number | null;
  unidades: number | null;
  promedioVenta: number | null;
  promedioTickets: number | null;
  promedioUnidades: number | null;
  ticket: number | null;
  ventaCambio: CambioValor;
  ticketsCambio: CambioValor;
  unidadesCambio: CambioValor;
  ticketCambio: CambioValor;
  exposicionDistinta: boolean;
  nota: string;
};

export type CeldaMapa = {
  dow: number;
  hora: number;
  venta: number | null;
  tickets: number | null;
  unidades: number | null;
  ventaCubierta: number;
  ticketsCubiertos: number;
  unidadesCubiertas: number;
  elegibles: number;
  fechasCompletas: string[];
  fechasParciales: string[];
  fechasDesconocidas: string[];
  fechasSinDatos: number;
  promedioVenta: number | null;
  promedioTickets: number | null;
  promedioUnidades: number | null;
  ticket: number | null;
  estado: EstadoVisual;
  ventasFueraDeCobertura: boolean;
  comparacion: ComparacionCelda | null;
};

export type FilaDia = {
  dow: number;
  venta: number | null;
  tickets: number | null;
  unidades: number | null;
  ticket: number | null;
  promedioVenta: number | null;
  promedioTickets: number | null;
  promedioUnidades: number | null;
  fechasComparables: number;
  elegibles: number;
  comparacion: ComparacionCelda | null;
};

export type MapaHorario = {
  celdas: CeldaMapa[];
  dias: FilaDia[];
  ventaPeriodo: number | null;
  ticketsPeriodo: number | null;
  unidadesPeriodo: number | null;
  baseFiable: boolean;
  muestraCorta: boolean;
  diasPeriodo: number;
  hayParcial: boolean;
  hayDesconocida: boolean;
  hayVentas: boolean;
  hayCobertura: boolean;
  notaComparacion: string | null;
  colisionFechas: string[];
  horarioConfigurado: false;
  notaHorario: string;
};

export type TurnoCaja = {
  turno: "am" | "pm";
  venta: number | null;
  tickets: number | null;
  unidades: number | null;
  ticket: number | null;
  unidadesPorTicket: number | null;
  sesiones: number;
  aperturaMin: string | null;
  aperturaMax: string | null;
  cierreMin: string | null;
  cierreMax: string | null;
  participacion: number | null;
};

export type ProductoFranja = {
  codigo: string;
  productId: string | null;
  nombre: string;
  unidades: number;
  venta: number;
  tickets: number;
};

export function cerrarTurnos(rows: Array<Omit<TurnoCaja, "participacion">>): TurnoCaja[] {
  const conocidos = rows.filter((row) => row.venta != null);
  const total = conocidos.reduce((sum, row) => sum + (row.venta ?? 0), 0);
  return rows.map((row) => ({
    ...row,
    participacion: row.venta != null && total > 0 ? row.venta / total : null,
  }));
}

export type ControlesHorario = {
  metrica: MetricaId;
  calculo: CalculoId;
  vista: VistaId;
  cambio: CambioModo;
  reloj: RelojId;
  categoria: string;
};

type Ventana = { desde: string; hasta: string };

type AcumFecha = {
  fecha: string;
  dow: number;
  venta: number;
  tickets: number;
  unidades: number;
  ventaCubierta: number;
  ticketsCubiertos: number;
  unidadesCubiertas: number;
  cubierta: boolean;
  tieneValor: boolean;
  horas: Map<number, FilaHora>;
};

function redondear(valor: number, decimales = 2): number {
  const factor = 10 ** decimales;
  return Math.round(valor * factor) / factor;
}

function finito(valor: number | null | undefined): valor is number {
  return valor != null && Number.isFinite(valor);
}

export function coberturaDe(valor: unknown): CoberturaHora {
  if (valor === "completa" || valor === "parcial" || valor === "desconocida") return valor;
  return "desconocida";
}

export function leerFranja(raw: string | null): { dow: number; hora: number } | null {
  const match = /^([1-7])-([0-9]|1[0-9]|2[0-3])$/.exec(raw ?? "");
  if (!match) return null;
  return { dow: Number(match[1]), hora: Number(match[2]) };
}

export function leerControles(params: { get(name: string): string | null }): ControlesHorario {
  const raw = params.get("metrica");
  let metrica: MetricaId = "venta";
  let calculo: CalculoId = "promedio";
  if (raw === "ordenes" || raw === "tickets") metrica = "tickets";
  else if (raw === "unidades") metrica = "unidades";
  else if (raw === "ticket") metrica = "ticket";
  else if (raw === "promedio") metrica = "venta";
  else metrica = "venta";
  if (params.get("calculo") === "total") calculo = "total";
  if (params.get("calculo") === "promedio") calculo = "promedio";
  return {
    metrica,
    calculo,
    vista: params.get("vista") === "cambio" ? "cambio" : "actividad",
    cambio: params.get("cambio") === "porcentaje" ? "porcentaje" : "absoluto",
    reloj: params.get("reloj") === "caja" ? "caja" : "real",
    categoria: (params.get("categoria") ?? "").slice(0, 80),
  };
}

export function calculoAplicado(pedido: CalculoId, metrica: MetricaId, baseFiable: boolean): { aplicado: CalculoId; aviso: string | null } {
  if (metrica === "ticket") {
    return { aplicado: "total", aviso: null };
  }
  if (pedido === "promedio" && !baseFiable) {
    return {
      aplicado: "total",
      aviso: "No hay sesiones cerradas para calcular el promedio por fecha observada. El mapa muestra el total del periodo.",
    };
  }
  return { aplicado: pedido, aviso: null };
}

export function vistaAplicada(pedida: VistaId, comparar: boolean): { aplicada: VistaId; aviso: string | null } {
  if (pedida === "cambio" && !comparar) {
    return { aplicada: "actividad", aviso: "La vista de cambio necesita un periodo comparado." };
  }
  return { aplicada: pedida, aviso: null };
}

function parteHora(hora: number): { n: number; sufijo: "a. m." | "p. m." } {
  const normal = ((hora % 24) + 24) % 24;
  return { n: normal % 12 === 0 ? 12 : normal % 12, sufijo: normal < 12 ? "a. m." : "p. m." };
}

export function etiquetaHoraCorta(hora: number): string {
  const parte = parteHora(hora);
  return `${parte.n} ${parte.sufijo}`;
}

export function etiquetaFranja(hora: number): string {
  const inicio = parteHora(hora);
  const fin = parteHora(hora + 1);
  if (inicio.sufijo === fin.sufijo) return `${inicio.n}–${fin.n} ${inicio.sufijo}`;
  return `${inicio.n} ${inicio.sufijo}–${fin.n} ${fin.sufijo}`;
}

export function etiquetaSeleccion(dow: number, hora: number): string {
  return `${DIAS_LARGOS[dow] ?? "Día"} · ${etiquetaFranja(hora)}`;
}

export function horaLocalCorta(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("es-DO", { timeZone: STAFF_TIMEZONE, hour: "numeric", minute: "2-digit" }).format(date);
}

export function textoRangoSesion(min: string | null, max: string | null): string | null {
  const desde = horaLocalCorta(min);
  const hasta = horaLocalCorta(max);
  if (!desde && !hasta) return null;
  if (desde && hasta && desde !== hasta) return `${desde} – ${hasta}`;
  return desde || hasta;
}

function acumular(filas: FilaHora[]): Map<string, AcumFecha> {
  const mapa = new Map<string, AcumFecha>();
  for (const fila of filas) {
    if (!isoWeekdayMonday1(fila.fecha) || fila.hora < 0 || fila.hora > 23) continue;
    const actual = mapa.get(fila.fecha) ?? {
      fecha: fila.fecha,
      dow: isoWeekdayMonday1(fila.fecha) as number,
      venta: 0,
      tickets: 0,
      unidades: 0,
      ventaCubierta: 0,
      ticketsCubiertos: 0,
      unidadesCubiertas: 0,
      cubierta: false,
      tieneValor: false,
      horas: new Map<number, FilaHora>(),
    };
    const previa = actual.horas.get(fila.hora);
    const venta = (previa?.venta ?? 0) + fila.venta;
    const tickets = (previa?.tickets ?? 0) + fila.tickets;
    const unidades = (previa?.unidades ?? 0) + fila.unidades;
    const cobertura = previa?.cobertura === "completa" || fila.cobertura === "completa" ? "completa" : previa?.cobertura === "parcial" || fila.cobertura === "parcial" ? "parcial" : "desconocida";
    actual.horas.set(fila.hora, { fecha: fila.fecha, hora: fila.hora, venta, tickets, unidades, cobertura });
    mapa.set(fila.fecha, actual);
  }
  for (const actual of Array.from(mapa.values())) {
    for (const hora of Array.from(actual.horas.values())) {
      const hay = hora.venta !== 0 || hora.tickets !== 0 || hora.unidades !== 0;
      if (hora.cobertura === "completa" || hay) actual.tieneValor = true;
      if (hora.cobertura === "completa" || hay) {
        actual.venta += hora.venta;
        actual.tickets += hora.tickets;
        actual.unidades += hora.unidades;
      }
      if (hora.cobertura === "completa") {
        actual.cubierta = true;
        actual.ventaCubierta += hora.venta;
        actual.ticketsCubiertos += hora.tickets;
        actual.unidadesCubiertas += hora.unidades;
      }
    }
  }
  return mapa;
}

function cambioDe(input: {
  actual: number | null;
  anterior: number | null;
  datosActuales: boolean;
  datosAnteriores: boolean;
  observacionesActual: number;
  observacionesAnterior: number;
  base: CambioValor["base"];
  ambosCero: boolean;
}): CambioValor {
  const comun = {
    base: input.base,
    observacionesActual: input.observacionesActual,
    observacionesAnterior: input.observacionesAnterior,
  };
  if (!input.datosAnteriores || !input.datosActuales) {
    return { ...comun, estado: "sin_comparacion", absoluto: null, porcentaje: null };
  }
  if (input.ambosCero) {
    return { ...comun, estado: "ambos_cero", absoluto: 0, porcentaje: 0 };
  }
  if (!finito(input.actual) || !finito(input.anterior)) {
    return { ...comun, estado: "sin_comparacion", absoluto: null, porcentaje: null };
  }
  const absoluto = redondear(input.actual - input.anterior, input.base === "ticket" ? 2 : 2);
  if (input.anterior === 0) {
    if (input.actual === 0) return { ...comun, estado: "ambos_cero", absoluto: 0, porcentaje: 0 };
    return { ...comun, estado: "sin_base", absoluto, porcentaje: null };
  }
  const porcentaje = (input.actual - input.anterior) / Math.abs(input.anterior);
  if (!Number.isFinite(porcentaje)) {
    return { ...comun, estado: "sin_base", absoluto, porcentaje: null };
  }
  return { ...comun, estado: "ok", absoluto, porcentaje };
}

function notaExposicion(actual: number, anterior: number, usaPromedio: boolean): string {
  if (usaPromedio && actual !== anterior) {
    return `Promedios comparables: ${actual} y ${anterior} observaciones. No se comparan totales de distinta exposición.`;
  }
  if (actual === anterior) return `${actual} ${actual === 1 ? "observación" : "observaciones"} en cada periodo.`;
  return `${actual} y ${anterior} observaciones.`;
}

function compararLado(input: {
  totalActual: number | null;
  totalAnterior: number | null;
  promedioActual: number | null;
  promedioAnterior: number | null;
  observacionesActual: number;
  observacionesAnterior: number;
  datosActuales: boolean;
  datosAnteriores: boolean;
}): { cambio: CambioValor; exposicionDistinta: boolean } {
  const distinta = input.observacionesActual !== input.observacionesAnterior;
  const usarPromedio = distinta || input.observacionesActual === 0 || input.observacionesAnterior === 0;
  const actual = usarPromedio ? input.promedioActual : input.totalActual;
  const anterior = usarPromedio ? input.promedioAnterior : input.totalAnterior;
  const ambosCero = input.datosActuales && input.datosAnteriores && (actual ?? 0) === 0 && (anterior ?? 0) === 0 && finito(actual) && finito(anterior);
  return {
    exposicionDistinta: distinta,
    cambio: cambioDe({
      actual,
      anterior,
      datosActuales: input.datosActuales && (!usarPromedio || input.observacionesActual > 0),
      datosAnteriores: input.datosAnteriores && (!usarPromedio || input.observacionesAnterior > 0),
      observacionesActual: input.observacionesActual,
      observacionesAnterior: input.observacionesAnterior,
      base: usarPromedio ? "promedio" : "total",
      ambosCero,
    }),
  };
}

function ticketDe(venta: number | null, tickets: number | null): number | null {
  if (!finito(venta) || !finito(tickets) || tickets <= 0) return null;
  return redondear(venta / tickets);
}

type Lado = {
  fechas: string[];
  completas: string[];
  venta: number | null;
  tickets: number | null;
  unidades: number | null;
  ventaCubierta: number;
  ticketsCubiertos: number;
  unidadesCubiertas: number;
  datos: boolean;
};

function ladoDe(fechas: string[], horas: Map<string, FilaHora>, hora: number): Lado {
  const completas: string[] = [];
  let venta = 0;
  let tickets = 0;
  let unidades = 0;
  let ventaCubierta = 0;
  let ticketsCubiertos = 0;
  let unidadesCubiertas = 0;
  let datos = false;
  for (const fecha of fechas) {
    const fila = horas.get(`${fecha}|${hora}`);
    if (!fila) continue;
    const hay = fila.venta !== 0 || fila.tickets !== 0 || fila.unidades !== 0;
    if (fila.cobertura === "completa" || hay) {
      datos = true;
      venta += fila.venta;
      tickets += fila.tickets;
      unidades += fila.unidades;
    }
    if (fila.cobertura === "completa") {
      completas.push(fecha);
      ventaCubierta += fila.venta;
      ticketsCubiertos += fila.tickets;
      unidadesCubiertas += fila.unidades;
    }
  }
  const conocidas = completas.length > 0 || datos;
  return {
    fechas,
    completas,
    venta: conocidas ? redondear(venta) : null,
    tickets: conocidas ? tickets : null,
    unidades: conocidas ? redondear(unidades, 3) : null,
    ventaCubierta: redondear(ventaCubierta),
    ticketsCubiertos,
    unidadesCubiertas: redondear(unidadesCubiertas, 3),
    datos: conocidas,
  };
}

function comparacionDe(actual: Lado, anterior: Lado | null, hora: boolean): ComparacionCelda | null {
  if (!anterior) return null;
  const observacionesActual = actual.completas.length;
  const observacionesAnterior = anterior.completas.length;
  const promedioVenta = observacionesActual > 0 ? redondear(actual.ventaCubierta / observacionesActual) : null;
  const promedioVentaAnt = observacionesAnterior > 0 ? redondear(anterior.ventaCubierta / observacionesAnterior) : null;
  const promedioTickets = observacionesActual > 0 ? redondear(actual.ticketsCubiertos / observacionesActual, 2) : null;
  const promedioTicketsAnt = observacionesAnterior > 0 ? redondear(anterior.ticketsCubiertos / observacionesAnterior, 2) : null;
  const promedioUnidades = observacionesActual > 0 ? redondear(actual.unidadesCubiertas / observacionesActual, 3) : null;
  const promedioUnidadesAnt = observacionesAnterior > 0 ? redondear(anterior.unidadesCubiertas / observacionesAnterior, 3) : null;
  const venta = compararLado({
    totalActual: actual.ventaCubierta,
    totalAnterior: anterior.ventaCubierta,
    promedioActual: promedioVenta,
    promedioAnterior: promedioVentaAnt,
    observacionesActual,
    observacionesAnterior,
    datosActuales: observacionesActual > 0,
    datosAnteriores: observacionesAnterior > 0,
  });
  const tickets = compararLado({
    totalActual: actual.ticketsCubiertos,
    totalAnterior: anterior.ticketsCubiertos,
    promedioActual: promedioTickets,
    promedioAnterior: promedioTicketsAnt,
    observacionesActual,
    observacionesAnterior,
    datosActuales: observacionesActual > 0,
    datosAnteriores: observacionesAnterior > 0,
  });
  const unidades = compararLado({
    totalActual: actual.unidadesCubiertas,
    totalAnterior: anterior.unidadesCubiertas,
    promedioActual: promedioUnidades,
    promedioAnterior: promedioUnidadesAnt,
    observacionesActual,
    observacionesAnterior,
    datosActuales: observacionesActual > 0,
    datosAnteriores: observacionesAnterior > 0,
  });
  const ticketActual = ticketDe(actual.venta, actual.tickets);
  const ticketAnterior = ticketDe(anterior.venta, anterior.tickets);
  const ceroActual = actual.datos && observacionesActual > 0 && (actual.tickets ?? 0) === 0;
  const ceroAnterior = anterior.datos && observacionesAnterior > 0 && (anterior.tickets ?? 0) === 0;
  const ticketCambio = cambioDe({
    actual: ticketActual ?? (ceroActual ? 0 : null),
    anterior: ticketAnterior ?? (ceroAnterior ? 0 : null),
    datosActuales: actual.datos && (ticketActual != null || ceroActual),
    datosAnteriores: anterior.datos && (ticketAnterior != null || ceroAnterior),
    observacionesActual: actual.tickets ?? 0,
    observacionesAnterior: anterior.tickets ?? 0,
    base: "ticket",
    ambosCero: (ceroActual && ceroAnterior) || (ticketActual === 0 && ticketAnterior === 0),
  });
  const distinta = venta.exposicionDistinta || tickets.exposicionDistinta || unidades.exposicionDistinta;
  return {
    fechasEquivalentes: anterior.fechas.length,
    fechasCompletas: observacionesAnterior,
    venta: anterior.venta,
    tickets: anterior.tickets,
    unidades: anterior.unidades,
    promedioVenta: promedioVentaAnt,
    promedioTickets: promedioTicketsAnt,
    promedioUnidades: promedioUnidadesAnt,
    ticket: ticketAnterior,
    ventaCambio: venta.cambio,
    ticketsCambio: tickets.cambio,
    unidadesCambio: unidades.cambio,
    ticketCambio,
    exposicionDistinta: distinta,
    nota: hora
      ? notaExposicion(observacionesActual, observacionesAnterior, venta.cambio.base === "promedio")
      : notaExposicion(observacionesActual, observacionesAnterior, venta.cambio.base === "promedio"),
  };
}

export function construirMapa(input: {
  desde: string;
  hasta: string;
  filas: FilaHora[];
  filasComparadas: FilaHora[];
  comparar: boolean;
  modo: ModoComparacion | "off";
  tramo: Ventana | null;
  anterior: Ventana | null;
}): MapaHorario {
  const elegibles = fechasEsperadas(input.desde, input.hasta);
  const porFecha = acumular(input.filas);
  const comparado = input.comparar ? acumular(input.filasComparadas) : new Map<string, AcumFecha>();
  const horas = new Map<string, FilaHora>();
  for (const fecha of Array.from(porFecha.values())) {
    for (const fila of Array.from(fecha.horas.values())) horas.set(`${fila.fecha}|${fila.hora}`, fila);
  }
  const horasComparadas = new Map<string, FilaHora>();
  for (const fecha of Array.from(comparado.values())) {
    for (const fila of Array.from(fecha.horas.values())) horasComparadas.set(`${fila.fecha}|${fila.hora}`, fila);
  }
  const porDow = new Map<number, string[]>();
  for (const fecha of elegibles) {
    const dow = isoWeekdayMonday1(fecha);
    if (!dow) continue;
    const lista = porDow.get(dow) ?? [];
    lista.push(fecha);
    porDow.set(dow, lista);
  }
  const usoEquivalente = new Map<string, string[]>();
  function equivalentes(fechas: string[]): string[] {
    if (!input.comparar || !input.tramo || !input.anterior || input.modo === "off") return [];
    const unicas: string[] = [];
    const vistas = new Set<string>();
    for (const fecha of fechas) {
      if (fecha < input.tramo.desde || fecha > input.tramo.hasta) continue;
      const equiv = fechaComparadaDe(fecha, input.modo, input.tramo, input.anterior);
      if (!equiv) continue;
      const duenos = usoEquivalente.get(equiv) ?? [];
      if (!duenos.includes(fecha)) duenos.push(fecha);
      usoEquivalente.set(equiv, duenos);
      if (vistas.has(equiv)) continue;
      vistas.add(equiv);
      unicas.push(equiv);
    }
    return unicas;
  }

  const celdas: CeldaMapa[] = [];
  const dias: FilaDia[] = [];
  for (let dow = 1; dow <= 7; dow += 1) {
    const fechas = porDow.get(dow) ?? [];
    const equivDia = equivalentes(fechas);
    let ventaDia = 0;
    let ticketsDia = 0;
    let unidadesDia = 0;
    let diaConocido = false;
    let ventaProm = 0;
    let ticketsProm = 0;
    let unidadesProm = 0;
    let fechasComparables = 0;
    for (const fecha of fechas) {
      const acum = porFecha.get(fecha);
      if (!acum) continue;
      if (acum.tieneValor) {
        diaConocido = true;
        ventaDia += acum.venta;
        ticketsDia += acum.tickets;
        unidadesDia += acum.unidades;
      }
      if (acum.cubierta) {
        fechasComparables += 1;
        ventaProm += acum.venta;
        ticketsProm += acum.tickets;
        unidadesProm += acum.unidades;
      }
    }
    const ladoDia: Lado = {
      fechas,
      completas: fechas.filter((fecha) => porFecha.get(fecha)?.cubierta),
      venta: diaConocido ? redondear(ventaDia) : null,
      tickets: diaConocido ? ticketsDia : null,
      unidades: diaConocido ? redondear(unidadesDia, 3) : null,
      ventaCubierta: redondear(ventaProm),
      ticketsCubiertos: ticketsProm,
      unidadesCubiertas: redondear(unidadesProm, 3),
      datos: diaConocido,
    };
    const ladoDiaAntReal = input.comparar
      ? (() => {
          const completas = equivDia.filter((fecha) => comparado.get(fecha)?.cubierta);
          let venta = 0;
          let tickets = 0;
          let unidades = 0;
          let ventaCubierta = 0;
          let ticketsCubiertos = 0;
          let unidadesCubiertas = 0;
          let datos = false;
          for (const fecha of equivDia) {
            const acum = comparado.get(fecha);
            if (!acum) continue;
            if (acum.tieneValor) {
              datos = true;
              venta += acum.venta;
              tickets += acum.tickets;
              unidades += acum.unidades;
            }
            if (acum.cubierta) {
              ventaCubierta += acum.venta;
              ticketsCubiertos += acum.tickets;
              unidadesCubiertas += acum.unidades;
            }
          }
          return {
            fechas: equivDia,
            completas,
            venta: datos ? redondear(venta) : null,
            tickets: datos ? tickets : null,
            unidades: datos ? redondear(unidades, 3) : null,
            ventaCubierta: redondear(ventaCubierta),
            ticketsCubiertos,
            unidadesCubiertas: redondear(unidadesCubiertas, 3),
            datos,
          } satisfies Lado;
        })()
      : null;
    dias.push({
      dow,
      venta: ladoDia.venta,
      tickets: ladoDia.tickets,
      unidades: ladoDia.unidades,
      ticket: ticketDe(ladoDia.venta, ladoDia.tickets),
      promedioVenta: fechasComparables > 0 ? redondear(ventaProm / fechasComparables) : null,
      promedioTickets: fechasComparables > 0 ? redondear(ticketsProm / fechasComparables) : null,
      promedioUnidades: fechasComparables > 0 ? redondear(unidadesProm / fechasComparables, 3) : null,
      fechasComparables,
      elegibles: fechas.length,
      comparacion: comparacionDe(
        {
          ...ladoDia,
          ventaCubierta: redondear(ventaProm),
          ticketsCubiertos: ticketsProm,
          unidadesCubiertas: redondear(unidadesProm, 3),
          completas: ladoDia.completas,
        },
        ladoDiaAntReal,
        false,
      ),
    });

    for (let hora = 0; hora <= 23; hora += 1) {
      const completas: string[] = [];
      const parciales: string[] = [];
      const desconocidas: string[] = [];
      let sinDatos = 0;
      let venta = 0;
      let tickets = 0;
      let unidades = 0;
      let ventaCubierta = 0;
      let ticketsCubiertos = 0;
      let unidadesCubiertas = 0;
      let conocido = false;
      let fuera = false;
      for (const fecha of fechas) {
        const fila = horas.get(`${fecha}|${hora}`);
        if (!fila) {
          sinDatos += 1;
          continue;
        }
        const hay = fila.venta !== 0 || fila.tickets !== 0 || fila.unidades !== 0;
        if (fila.cobertura === "completa") {
          completas.push(fecha);
          conocido = true;
          venta += fila.venta;
          tickets += fila.tickets;
          unidades += fila.unidades;
          ventaCubierta += fila.venta;
          ticketsCubiertos += fila.tickets;
          unidadesCubiertas += fila.unidades;
        } else if (fila.cobertura === "parcial") {
          parciales.push(fecha);
          if (hay) {
            conocido = true;
            fuera = true;
            venta += fila.venta;
            tickets += fila.tickets;
            unidades += fila.unidades;
          }
        } else {
          desconocidas.push(fecha);
          conocido = true;
          fuera = true;
          venta += fila.venta;
          tickets += fila.tickets;
          unidades += fila.unidades;
        }
      }
      const estado: EstadoVisual =
        completas.length > 0 && (venta !== 0 || tickets !== 0 || unidades !== 0)
          ? "con_ventas"
          : completas.length > 0
            ? "cero"
            : desconocidas.length > 0
              ? "desconocida"
              : parciales.length > 0
                ? "parcial"
                : "sin_datos";
      const ventaN = conocido ? redondear(venta) : null;
      const ticketsN = conocido ? tickets : null;
      const unidadesN = conocido ? redondear(unidades, 3) : null;
      const lado: Lado = {
        fechas,
        completas,
        venta: ventaN,
        tickets: ticketsN,
        unidades: unidadesN,
        ventaCubierta: redondear(ventaCubierta),
        ticketsCubiertos,
        unidadesCubiertas: redondear(unidadesCubiertas, 3),
        datos: conocido,
      };
      const equiv = equivalentes(fechas);
      const anteriorLado = input.comparar ? ladoDe(equiv, horasComparadas, hora) : null;
      celdas.push({
        dow,
        hora,
        venta: estado === "sin_datos" || estado === "parcial" ? null : ventaN,
        tickets: estado === "sin_datos" || estado === "parcial" ? null : ticketsN,
        unidades: estado === "sin_datos" || estado === "parcial" ? null : unidadesN,
        ventaCubierta: redondear(ventaCubierta),
        ticketsCubiertos,
        unidadesCubiertas: redondear(unidadesCubiertas, 3),
        elegibles: fechas.length,
        fechasCompletas: completas,
        fechasParciales: parciales,
        fechasDesconocidas: desconocidas,
        fechasSinDatos: sinDatos,
        promedioVenta: completas.length > 0 ? redondear(ventaCubierta / completas.length) : null,
        promedioTickets: completas.length > 0 ? redondear(ticketsCubiertos / completas.length) : null,
        promedioUnidades: completas.length > 0 ? redondear(unidadesCubiertas / completas.length, 3) : null,
        ticket: ticketDe(ventaN, ticketsN),
        estado,
        ventasFueraDeCobertura: fuera && completas.length > 0,
        comparacion: comparacionDe(lado, anteriorLado, true),
      });
    }
  }

  const colisionFechas = Array.from(usoEquivalente.entries()).filter(([, fechas]) => fechas.length > 1).map(([fecha]) => fecha);
  const conValor = celdas.filter((celda) => celda.venta != null || celda.tickets != null);
  const ventaPeriodo = conValor.length > 0 ? redondear(conValor.reduce((sum, celda) => sum + (celda.venta ?? 0), 0)) : null;
  const ticketsPeriodo = conValor.length > 0 ? conValor.reduce((sum, celda) => sum + (celda.tickets ?? 0), 0) : null;
  const unidadesPeriodo = conValor.length > 0 ? redondear(conValor.reduce((sum, celda) => sum + (celda.unidades ?? 0), 0), 3) : null;
  const hayCobertura = celdas.some((celda) => celda.fechasCompletas.length > 0);
  const hayVentas = celdas.some((celda) => (celda.venta ?? 0) !== 0 || (celda.tickets ?? 0) !== 0);
  const notaComparacion = input.comparar
    ? "Cada fecha del tramo se compara con su fecha equivalente y después se agrupa en el día de la semana de ese periodo. No se empareja la celda solo por su posición."
    : null;
  return {
    celdas,
    dias,
    ventaPeriodo,
    ticketsPeriodo,
    unidadesPeriodo,
    baseFiable: hayCobertura,
    muestraCorta: elegibles.length > 0 && elegibles.length <= 7,
    diasPeriodo: elegibles.length,
    hayParcial: celdas.some((celda) => celda.fechasParciales.length > 0),
    hayDesconocida: celdas.some((celda) => celda.estado === "desconocida" || celda.ventasFueraDeCobertura),
    hayVentas,
    hayCobertura,
    notaComparacion: colisionFechas.length > 0 && notaComparacion ? `${notaComparacion} Hay fechas equivalentes compartidas; no se suman dos veces dentro de la misma celda.` : notaComparacion,
    colisionFechas,
    horarioConfigurado: false,
    notaHorario: NOTA_HORARIO,
  };
}

export function celdaEn(mapa: MapaHorario, dow: number, hora: number): CeldaMapa | null {
  return mapa.celdas.find((celda) => celda.dow === dow && celda.hora === hora) ?? null;
}

export function valorMostrado(celda: CeldaMapa | FilaDia, metrica: MetricaId, calculo: CalculoId): number | null {
  if (metrica === "ticket") return celda.ticket;
  if (calculo === "promedio") {
    if (metrica === "tickets") return celda.promedioTickets;
    if (metrica === "unidades") return celda.promedioUnidades;
    return celda.promedioVenta;
  }
  if (metrica === "tickets") return celda.tickets;
  if (metrica === "unidades") return celda.unidades;
  return celda.venta;
}

export function cambioMostrado(comparacion: ComparacionCelda | null, metrica: MetricaId): CambioValor | null {
  if (!comparacion) return null;
  if (metrica === "tickets") return comparacion.ticketsCambio;
  if (metrica === "unidades") return comparacion.unidadesCambio;
  if (metrica === "ticket") return comparacion.ticketCambio;
  return comparacion.ventaCambio;
}

export function cambioVisible(celda: CeldaMapa | FilaDia, metrica: MetricaId, calculo: CalculoId): CambioValor | null {
  const bruto = cambioMostrado(celda.comparacion, metrica);
  if (!bruto || metrica === "ticket" || bruto.base === "promedio" || calculo === "total" || bruto.estado === "sin_comparacion") return bruto;
  const actual = valorMostrado(celda, metrica, "promedio");
  const anterior =
    metrica === "tickets" ? celda.comparacion?.promedioTickets ?? null : metrica === "unidades" ? celda.comparacion?.promedioUnidades ?? null : celda.comparacion?.promedioVenta ?? null;
  return cambioDe({
    actual,
    anterior,
    datosActuales: actual != null,
    datosAnteriores: anterior != null,
    observacionesActual: bruto.observacionesActual,
    observacionesAnterior: bruto.observacionesAnterior,
    base: "promedio",
    ambosCero: actual === 0 && anterior === 0,
  });
}

export function numeroCambio(cambio: CambioValor | null, modo: CambioModo): number | null {
  if (!cambio) return null;
  if (cambio.estado === "sin_comparacion" || cambio.estado === "sin_base") {
    return modo === "absoluto" && cambio.estado === "sin_base" ? cambio.absoluto : null;
  }
  const valor = modo === "porcentaje" ? cambio.porcentaje : cambio.absoluto;
  return finito(valor) ? valor : null;
}

export function textoEstado(estado: EstadoVisual): string {
  if (estado === "cero") return "Cero con cobertura válida";
  if (estado === "sin_datos") return "Sin datos";
  if (estado === "parcial") return "Cobertura parcial";
  if (estado === "desconocida") return "Cobertura desconocida";
  return "Con ventas";
}

export function textoMetrica(metrica: MetricaId, categoria: boolean): string {
  if (metrica === "venta") return "Ventas";
  if (metrica === "tickets") return categoria ? "Tickets con la categoría" : "Tickets";
  if (metrica === "unidades") return "Unidades";
  return categoria ? "Ticket promedio de la categoría" : "Ticket promedio";
}

export function textoValor(valor: number | null, metrica: MetricaId): string {
  if (!finito(valor)) return "—";
  if (metrica === "venta" || metrica === "ticket") return formatRd(valor);
  if (metrica === "unidades") return formatUnidades(valor);
  return formatNumero(valor, Number.isInteger(valor) ? 0 : 2);
}

export function textoDelta(valor: number | null, metrica: MetricaId, modo: CambioModo): string {
  if (!finito(valor)) return "—";
  if (modo === "porcentaje") return formatPct(valor);
  const base = textoValor(Math.abs(valor), metrica);
  if (valor > 0) return `+${base}`;
  if (valor < 0) return `−${base}`;
  return textoValor(0, metrica);
}

export function textoCambio(cambio: CambioValor | null, metrica: MetricaId, modo: CambioModo): string {
  if (!cambio || cambio.estado === "sin_comparacion") return "Sin comparación";
  if (modo === "porcentaje" && (cambio.estado === "sin_base" || cambio.porcentaje == null)) return "Sin base porcentual";
  if (cambio.estado === "ambos_cero") return modo === "porcentaje" ? "0%" : textoDelta(0, metrica, "absoluto");
  return textoDelta(modo === "porcentaje" ? cambio.porcentaje : cambio.absoluto, metrica, modo);
}

export function participacionFranja(venta: number | null, total: number | null): number | null {
  if (!finito(venta) || !finito(total) || !(total > 0)) return null;
  return venta / total;
}

export function maxAbsoluto(valores: Array<number | null>): number {
  return valores.reduce<number>((max, valor) => (finito(valor) ? Math.max(max, Math.abs(valor)) : max), 0);
}

export type HallazgoHorarioVista = HallazgoDestacado & {
  limitaciones: string | null;
  muestra: number | null;
};

function muestraDe(muestras: unknown, visual: number | null): number | null {
  if (finito(visual)) return visual;
  if (!muestras || typeof muestras !== "object" || Array.isArray(muestras)) return null;
  for (const clave of ["observaciones", "muestra", "n", "elegibles", "dias"]) {
    const valor = (muestras as Record<string, unknown>)[clave];
    if (typeof valor === "number" && Number.isFinite(valor)) return valor;
  }
  return null;
}

function esDeHorarios(row: Record<string, unknown>): boolean {
  const visual = leerVisual(row.visual);
  if (visual.visual?.tipo === "horarios" || visual.visual?.explorar?.pantalla === "horarios") return true;
  const evidencia = row.evidencia;
  if (!evidencia || typeof evidencia !== "object") return false;
  const enlaces = (evidencia as { enlaces?: unknown }).enlaces;
  return Array.isArray(enlaces) && enlaces.some((enlace) => enlace && typeof enlace === "object" && (enlace as { pantalla?: unknown }).pantalla === "horarios");
}

export function elegirHallazgoHorario(rows: Record<string, unknown>[], ventana: Ventana): HallazgoHorarioVista | null {
  const peso: Record<AlcanceHallazgo, number> = { periodo: 0, sin_periodo: 1, fuera: 2 };
  const listos = rows
    .filter(esDeHorarios)
    .map((row) => {
      const base = prepararHallazgo(row, ventana);
      if (!base) return null;
      const visual = leerVisual(row.visual);
      return {
        ...base,
        limitaciones: typeof row.limitaciones === "string" && row.limitaciones.trim() ? row.limitaciones.trim() : null,
        muestra: muestraDe(row.muestras, visual.visual?.muestra ?? null),
      };
    })
    .filter((row): row is HallazgoHorarioVista => row != null)
    .sort((a, b) => peso[a.alcance] - peso[b.alcance]);
  return listos[0] ?? null;
}

export function textoMuestraHallazgo(hallazgo: HallazgoHorarioVista): string {
  if (hallazgo.muestra == null) return hallazgo.limitaciones ? "Sin cantidad de observaciones declarada." : "Sin cantidad de observaciones declarada.";
  if (hallazgo.muestra <= 1) return `${formatNumero(hallazgo.muestra)} observación. No es un patrón estable.`;
  return `${formatNumero(hallazgo.muestra)} observaciones.`;
}

export { textoAlcance };
