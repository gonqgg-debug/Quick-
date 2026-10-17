import {
  anioAnterior,
  coberturaDifiere,
  diasInclusivos,
  estadoHora,
  fechasEsperadas,
  promedioOcurrencia,
  variacionPct,
  type EstadoComparacion,
  type EstadoHora,
  type ModoComparacion,
} from "@/lib/consumo-metricas";
import { addDaysToDayKey, diffDayKeys, formatDayKey, isDayKey } from "@/lib/local-day";
import { leerVisual, visualCoherente, esResuelto } from "@/lib/miles-presentacion";
import { formatNumero, formatPct, formatRd, lunesDe } from "@/lib/pos-domain";

export type Granularidad = "dia" | "semana" | "mes";

export const ETIQUETA_GRANULARIDAD: Record<Granularidad, string> = {
  dia: "Por día",
  semana: "Por semana",
  mes: "Por mes",
};

export type DiaSerie = { fecha: string; venta: number; ordenes: number };

export type PuntoSerie = {
  id: string;
  etiqueta: string;
  desde: string;
  hasta: string;
  venta: number | null;
  ordenes: number | null;
  ticket: number | null;
  diasConDatos: number;
  diasEsperados: number;
  incompleta: boolean;
  fechaComparadaDesde: string | null;
  fechaComparadaHasta: string | null;
  ventaComparada: number | null;
  ordenesComparadas: number | null;
  ticketComparado: number | null;
  comparacionParcial: boolean;
};

export type TextoVariacion = { texto: string; tono: "sube" | "baja" | "igual" | "neutro" };

export type CascadaVenta = {
  anterior: number;
  efectoTickets: number;
  efectoTicket: number;
  actual: number;
  delta: number;
  conclusion: string;
};

export type AlcanceHallazgo = "periodo" | "fuera" | "sin_periodo";

export type HallazgoDestacado = {
  id: string;
  titulo: string;
  tipo: string;
  resumen: string;
  periodoDesde: string | null;
  periodoHasta: string | null;
  publicadoEn: string | null;
  actualizadoEn: string | null;
  cifra: string | null;
  alcance: AlcanceHallazgo;
  accion: { etiqueta: string; href: string };
};

export type FranjaHorario = {
  dow: number;
  desdeHora: number;
  hastaHora: number;
  venta: number | null;
  promedio: number | null;
  ocurrencias: number;
  ordenes: number;
  incompletas: number;
  horasConDatos: number;
  horasEnFranja: number;
  estado: EstadoHora;
};

const FRANJAS = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22] as const;

export function granularidadDe(dias: number): Granularidad {
  if (dias <= 45) return "dia";
  if (dias <= 180) return "semana";
  return "mes";
}

export function fechaComparadaDe(
  fecha: string,
  modo: ModoComparacion | "off",
  tramo: { desde: string; hasta: string } | null,
  anterior: { desde: string; hasta: string } | null,
): string | null {
  if (modo === "off" || !tramo || !anterior) return null;
  if (fecha < tramo.desde || fecha > tramo.hasta) return null;
  if (modo === "anio") return anioAnterior(fecha);
  return addDaysToDayKey(fecha, diffDayKeys(tramo.desde, anterior.desde));
}

function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}

function etiquetaCorta(fecha: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (!match) return fecha;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat("es-DO", { timeZone: "UTC", day: "numeric", month: "short" }).format(date);
}

function etiquetaRango(desde: string, hasta: string): string {
  if (desde === hasta) return etiquetaCorta(desde);
  if (desde.slice(0, 7) === hasta.slice(0, 7)) {
    return `${Number(desde.slice(8))}–${etiquetaCorta(hasta)}`;
  }
  return `${etiquetaCorta(desde)} – ${etiquetaCorta(hasta)}`;
}

function etiquetaMes(fecha: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (!match) return fecha;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat("es-DO", { timeZone: "UTC", month: "short", year: "numeric" }).format(date);
}

function gruposDe(desde: string, hasta: string, granularidad: Granularidad): Array<{ id: string; etiqueta: string; fechas: string[] }> {
  const fechas = fechasEsperadas(desde, hasta);
  if (granularidad === "dia") {
    return fechas.map((fecha) => ({ id: fecha, etiqueta: etiquetaCorta(fecha), fechas: [fecha] }));
  }
  const grupos = new Map<string, string[]>();
  for (const fecha of fechas) {
    const clave = granularidad === "semana" ? lunesDe(fecha) : fecha.slice(0, 7);
    const lista = grupos.get(clave) ?? [];
    lista.push(fecha);
    grupos.set(clave, lista);
  }
  return Array.from(grupos.entries()).map(([, lista]) => {
    const inicio = lista[0];
    const fin = lista[lista.length - 1];
    return {
      id: `${inicio}:${fin}`,
      etiqueta: granularidad === "mes" ? etiquetaMes(inicio) : etiquetaRango(inicio, fin),
      fechas: lista,
    };
  });
}

export function serieEvolucion(input: {
  desde: string;
  hasta: string;
  dias: DiaSerie[];
  diasComparados: DiaSerie[];
  comparacion: ModoComparacion | "off";
  tramo: { desde: string; hasta: string } | null;
  anterior: { desde: string; hasta: string } | null;
  mostrarComparacion: boolean;
}): { granularidad: Granularidad; puntos: PuntoSerie[] } {
  const dias = Math.max(0, diasInclusivos(input.desde, input.hasta));
  const granularidad = granularidadDe(dias);
  const actual = new Map(input.dias.map((dia) => [dia.fecha, dia]));
  const comparado = new Map(input.diasComparados.map((dia) => [dia.fecha, dia]));
  const puntos = gruposDe(input.desde, input.hasta, granularidad).map((grupo) => {
    const presentes = grupo.fechas.filter((fecha) => actual.has(fecha));
    const venta = presentes.length === 0 ? null : presentes.reduce((sum, fecha) => sum + (actual.get(fecha)?.venta ?? 0), 0);
    const ordenes = presentes.length === 0 ? null : presentes.reduce((sum, fecha) => sum + (actual.get(fecha)?.ordenes ?? 0), 0);
    const comparadas = grupo.fechas
      .map((fecha) => fechaComparadaDe(fecha, input.comparacion, input.tramo, input.anterior))
      .filter((fecha): fecha is string => Boolean(fecha));
    const faltaComparado = comparadas.some((fecha) => !comparado.has(fecha));
    const puedeComparar = input.mostrarComparacion && comparadas.length > 0 && !faltaComparado;
    const ventaComparada = puedeComparar ? comparadas.reduce((sum, fecha) => sum + (comparado.get(fecha)?.venta ?? 0), 0) : null;
    const ordenesComparadas = puedeComparar ? comparadas.reduce((sum, fecha) => sum + (comparado.get(fecha)?.ordenes ?? 0), 0) : null;
    return {
      id: grupo.id,
      etiqueta: grupo.etiqueta,
      desde: grupo.fechas[0],
      hasta: grupo.fechas[grupo.fechas.length - 1],
      venta,
      ordenes,
      ticket: venta != null && ordenes != null && ordenes > 0 ? venta / ordenes : null,
      diasConDatos: presentes.length,
      diasEsperados: grupo.fechas.length,
      incompleta: presentes.length < grupo.fechas.length,
      fechaComparadaDesde: comparadas[0] ?? null,
      fechaComparadaHasta: comparadas[comparadas.length - 1] ?? null,
      ventaComparada,
      ordenesComparadas,
      ticketComparado: ventaComparada != null && ordenesComparadas != null && ordenesComparadas > 0 ? ventaComparada / ordenesComparadas : null,
      comparacionParcial: puedeComparar && comparadas.length < grupo.fechas.length,
    };
  });
  return { granularidad, puntos };
}

/** Misma partición que desgloseVenta, con ticket = venta / tickets sin redondear. El centavo sobrante se asigna al efecto de mayor valor absoluto. */
export function cascadaVenta(
  actual: { venta: number; tickets: number },
  anterior: { venta: number; tickets: number },
): CascadaVenta | null {
  if (!(actual.tickets > 0) || !(anterior.tickets > 0)) return null;
  if (!Number.isFinite(actual.venta) || !Number.isFinite(anterior.venta)) return null;
  const ticketActual = actual.venta / actual.tickets;
  const ticketAnterior = anterior.venta / anterior.tickets;
  const efectoTickets = (actual.tickets - anterior.tickets) * ticketAnterior;
  const efectoTicket = (ticketActual - ticketAnterior) * actual.tickets;
  const delta = actual.venta - anterior.venta;
  let tickets = redondear(efectoTickets);
  let ticket = redondear(efectoTicket);
  const deltaRedondo = redondear(delta);
  const resto = redondear(deltaRedondo - tickets - ticket);
  if (resto !== 0) {
    if (Math.abs(efectoTickets) > Math.abs(efectoTicket)) tickets = redondear(tickets + resto);
    else ticket = redondear(ticket + resto);
  }
  return {
    anterior: redondear(anterior.venta),
    efectoTickets: tickets,
    efectoTicket: ticket,
    actual: redondear(actual.venta),
    delta: deltaRedondo,
    conclusion: conclusionCambio(tickets, ticket, deltaRedondo),
  };
}

export function conclusionCambio(efectoTickets: number, efectoTicket: number, delta: number): string {
  if (Math.abs(delta) < 0.005) return "Las ventas del periodo comparable se mantienen.";
  const crecimiento = delta > 0;
  const ticketsEmpuja = efectoTickets === 0 || efectoTickets > 0 === crecimiento;
  const precioEmpuja = efectoTicket === 0 || efectoTicket > 0 === crecimiento;
  const principalTickets = Math.abs(efectoTickets) >= Math.abs(efectoTicket);
  if (principalTickets && ticketsEmpuja && !precioEmpuja) {
    return crecimiento
      ? "El crecimiento proviene principalmente de más tickets. El ticket promedio lo reduce."
      : "La baja proviene principalmente de menos tickets. El ticket promedio la compensa en parte.";
  }
  if (!principalTickets && precioEmpuja && !ticketsEmpuja) {
    return crecimiento
      ? "El crecimiento proviene principalmente de un ticket promedio más alto. Hay menos tickets."
      : "La baja proviene principalmente de un ticket promedio más bajo. Hay más tickets.";
  }
  if (principalTickets) {
    if (efectoTickets > 0) return crecimiento ? "El crecimiento proviene principalmente de más tickets." : "El cambio combina más tickets con un ticket promedio más bajo.";
    if (efectoTickets < 0) return crecimiento ? "El cambio combina menos tickets con un ticket promedio más alto." : "La baja proviene principalmente de menos tickets.";
  }
  if (efectoTicket > 0) return crecimiento ? "El crecimiento proviene principalmente de un ticket promedio más alto." : "El cambio combina un ticket promedio más alto con menos tickets.";
  if (efectoTicket < 0) return crecimiento ? "El cambio combina un ticket promedio más bajo con más tickets." : "La baja proviene principalmente de un ticket promedio más bajo.";
  return crecimiento ? "Las ventas crecen." : "Las ventas bajan.";
}

export function variacionConUnidad(
  estado: EstadoComparacion,
  actual: number | null,
  anterior: number | null,
  unidad: string,
): TextoVariacion | null {
  if (estado === "off") return null;
  if (estado === "no_disponible") return { texto: "Comparación no disponible", tono: "neutro" };
  if (estado === "sin_base" || anterior == null || anterior === 0 || actual == null || !Number.isFinite(actual) || !Number.isFinite(anterior)) {
    return { texto: "Sin base", tono: "neutro" };
  }
  const pct = variacionPct(actual, anterior);
  if (pct == null || !Number.isFinite(pct)) return { texto: "Sin base", tono: "neutro" };
  if (Math.abs(pct) < 0.0005) return { texto: `0,0% ${unidad}`, tono: "igual" };
  return { texto: `${formatPct(pct)} ${unidad}`, tono: pct > 0 ? "sube" : "baja" };
}

export function variacionUtilidad(
  estado: EstadoComparacion,
  actual: number | null,
  anterior: number | null,
): TextoVariacion | null {
  if (estado === "off") return null;
  if (estado === "no_disponible") return { texto: "Comparación no disponible", tono: "neutro" };
  if (estado === "sin_base") return { texto: "Sin base", tono: "neutro" };
  if (actual == null || anterior == null) return { texto: "Sin costo suficiente para comparar", tono: "neutro" };
  return variacionConUnidad("ok", actual, anterior, "utilidad");
}

export function avisoCobertura(actual: number | null, anterior: number | null): string | null {
  if (!coberturaDifiere(actual, anterior)) return null;
  const desde = anterior == null || !Number.isFinite(anterior) ? "—" : formatPct(anterior).replace(/^\+/, "");
  const hasta = actual == null || !Number.isFinite(actual) ? "—" : formatPct(actual).replace(/^\+/, "");
  return `La cobertura de costos pasó de ${desde} a ${hasta}. Ese cambio limita comparar la utilidad y no indica por sí solo que el negocio mejoró.`;
}

export function diferenciaPagos(mix: { efectivo: number; tarjeta: number; banco: number; credito: number; otro: number }, venta: number): number {
  const suma = mix.efectivo + mix.tarjeta + mix.banco + mix.credito + mix.otro;
  return redondear(suma - venta);
}

export function solapaPeriodo(desde: string | null, hasta: string | null, ventanaDesde: string, ventanaHasta: string): AlcanceHallazgo {
  if (!desde || !hasta) return "sin_periodo";
  if (hasta < ventanaDesde || desde > ventanaHasta) return "fuera";
  return "periodo";
}

export function elegirDestacados<T extends { alcance: AlcanceHallazgo }>(rows: T[], max = 3): T[] {
  const peso: Record<AlcanceHallazgo, number> = { periodo: 0, sin_periodo: 1, fuera: 2 };
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => peso[a.row.alcance] - peso[b.row.alcance] || a.index - b.index)
    .slice(0, max)
    .map((item) => item.row);
}

function diaClave(value: unknown): string | null {
  if (typeof value !== "string" || value.length < 10) return null;
  const clave = value.slice(0, 10);
  return isDayKey(clave) ? clave : null;
}

function primerEnlace(evidencia: unknown): { pantalla: string; query: string } | null {
  if (!evidencia || typeof evidencia !== "object") return null;
  const enlaces = (evidencia as { enlaces?: unknown }).enlaces;
  if (!Array.isArray(enlaces) || !enlaces[0] || typeof enlaces[0] !== "object") return null;
  const primero = enlaces[0] as { pantalla?: unknown; query?: unknown };
  if (typeof primero.pantalla !== "string") return null;
  return { pantalla: primero.pantalla, query: typeof primero.query === "string" ? primero.query : "" };
}

function hrefPantalla(pantalla: string, query: string): string {
  const base =
    pantalla === "productos"
      ? "/admin/consumo/productos"
      : pantalla === "horarios"
        ? "/admin/consumo/horarios"
        : pantalla === "canasta"
          ? "/admin/consumo/canasta"
          : "/admin/consumo";
  return query ? `${base}?${query}` : base;
}

function cifraDe(visual: unknown, metricas: unknown): string | null {
  const leido = leerVisual(visual);
  if (leido.error || !leido.visual?.metrica) return null;
  const fuente = metricas && typeof metricas === "object" ? (metricas as Record<string, unknown>) : {};
  if (!visualCoherente(leido.visual, fuente).ok) return null;
  const metrica = leido.visual.metrica;
  if (metrica.unidad === "rd") return formatRd(metrica.valor);
  if (metrica.unidad === "pct") return formatPct(metrica.valor).replace(/^\+/, "");
  return formatNumero(metrica.valor, Number.isInteger(metrica.valor) ? 0 : 2);
}

function accionDe(id: string, evidencia: unknown): { etiqueta: string; href: string } {
  const enlace = primerEnlace(evidencia);
  if (!enlace) return { etiqueta: "Ver hallazgo", href: `/admin/consumo/miles?hallazgo=${encodeURIComponent(id)}` };
  if (enlace.pantalla === "horarios") return { etiqueta: "Explorar horario", href: hrefPantalla(enlace.pantalla, enlace.query) };
  if (enlace.pantalla === "productos") return { etiqueta: "Ver productos", href: hrefPantalla(enlace.pantalla, enlace.query) };
  if (enlace.pantalla === "canasta") return { etiqueta: "Ver canasta", href: hrefPantalla(enlace.pantalla, enlace.query) };
  if (enlace.query) return { etiqueta: "Ver periodo del hallazgo", href: hrefPantalla("resumen", enlace.query) };
  return { etiqueta: "Ver hallazgo", href: `/admin/consumo/miles?hallazgo=${encodeURIComponent(id)}` };
}

export function prepararHallazgo(row: Record<string, unknown>, ventana: { desde: string; hasta: string }): HallazgoDestacado | null {
  if (esResuelto(row)) return null;
  const id = String(row.id ?? "");
  if (!id) return null;
  const periodoDesde = diaClave(row.periodo_desde);
  const periodoHasta = diaClave(row.periodo_hasta);
  return {
    id,
    titulo: String(row.titulo ?? "Hallazgo"),
    tipo: String(row.tipo ?? ""),
    resumen: typeof row.resumen === "string" ? row.resumen.trim() : "",
    periodoDesde,
    periodoHasta,
    publicadoEn: typeof row.publicado_en === "string" ? row.publicado_en : null,
    actualizadoEn: typeof row.actualizado_en === "string" ? row.actualizado_en : null,
    cifra: cifraDe(row.visual, row.metricas),
    alcance: solapaPeriodo(periodoDesde, periodoHasta, ventana.desde, ventana.hasta),
    accion: accionDe(id, row.evidencia),
  };
}

export function textoAlcance(hallazgo: Pick<HallazgoDestacado, "alcance" | "periodoDesde" | "periodoHasta">): string {
  const fechas = hallazgo.periodoDesde && hallazgo.periodoHasta ? `${formatDayKey(hallazgo.periodoDesde)} – ${formatDayKey(hallazgo.periodoHasta)}` : null;
  if (hallazgo.alcance === "periodo") return fechas ? `Periodo del hallazgo: ${fechas}` : "Coincide con el periodo seleccionado";
  if (hallazgo.alcance === "fuera") return fechas ? `Fuera del periodo seleccionado · ${fechas}` : "Fuera del periodo seleccionado";
  return "Sin periodo declarado. No describe por sí solo el periodo seleccionado.";
}

export function franjasHorario(
  celdas: Array<{ dow: number; hora: number; venta: number; ordenes: number; ocurrencias: number; incompletas: number }>,
): FranjaHorario[] {
  const mapa = new Map(celdas.map((celda) => [`${celda.dow}-${celda.hora}`, celda]));
  const franjas: FranjaHorario[] = [];
  for (let dow = 1; dow <= 7; dow += 1) {
    for (const desdeHora of FRANJAS) {
      const horas = [desdeHora, desdeHora + 1].map((hora) => mapa.get(`${dow}-${hora}`)).filter((celda): celda is NonNullable<typeof celda> => Boolean(celda));
      const ocurrencias = horas.reduce((sum, celda) => sum + celda.ocurrencias, 0);
      const ordenes = horas.reduce((sum, celda) => sum + celda.ordenes, 0);
      const incompletas = horas.reduce((sum, celda) => sum + celda.incompletas, 0);
      const venta = horas.length === 0 ? null : horas.reduce((sum, celda) => sum + celda.venta, 0);
      franjas.push({
        dow,
        desdeHora,
        hastaHora: desdeHora + 2,
        venta,
        promedio: venta == null ? null : promedioOcurrencia(venta, ocurrencias),
        ocurrencias,
        ordenes,
        incompletas,
        horasConDatos: horas.length,
        horasEnFranja: 2,
        estado: horas.length === 0 ? "sin_datos" : estadoHora({ ocurrencias, ordenes, incompletas }),
      });
    }
  }
  return franjas;
}

const QUITAR_CONSULTA = ["detalle", "pagina", "cursor", "vista", "orden", "sin_costo", "q", "categoria", "limit"];

export function consultaCompartida(consulta: string, extra: Record<string, string | null> = {}): string {
  const params = new URLSearchParams(consulta);
  for (const key of QUITAR_CONSULTA) params.delete(key);
  for (const [key, value] of Object.entries(extra)) {
    if (value == null || value === "") params.delete(key);
    else params.set(key, value);
  }
  return params.toString();
}

export function hrefAnalitica(base: string, consulta: string, extra: Record<string, string | null> = {}): string {
  const query = consultaCompartida(consulta, extra);
  return query ? `${base}?${query}` : base;
}

export function coberturaObservada(fechasPresentes: string[], desde: string, hasta: string): { presentes: number; esperados: number; completa: boolean } {
  const set = new Set(fechasPresentes);
  const esperados = fechasEsperadas(desde, hasta);
  const presentes = esperados.filter((fecha) => set.has(fecha)).length;
  return { presentes, esperados: esperados.length, completa: presentes === esperados.length && esperados.length > 0 };
}
