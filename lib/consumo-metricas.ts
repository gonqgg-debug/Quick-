import { addDaysToDayKey, diffDayKeys, isDayKey, todayDayKey, yesterdayDayKey } from "@/lib/local-day";

export const ZONA_CONSUMO = "America/Santo_Domingo";

export const COSTO_METODO = "ultimo_disponible" as const;

export const COSTO_METODO_TEXTO =
  "El costo es el manual del producto si existe; si no, el de la última factura de compra. No es el costo del día de la venta. Aplicarlo a ventas viejas es una estimación. Un producto sin costo no entra como cero.";

export type ModoComparacion = "anterior" | "semana" | "anio";

export type Ventana = { desde: string; hasta: string };

export type ComparacionResuelta = {
  modo: ModoComparacion | "off";
  algoritmo: string;
  tramo: Ventana | null;
  anterior: Ventana | null;
  recortado: boolean;
};

export function diasInclusivos(desde: string, hasta: string): number {
  return diffDayKeys(desde, hasta) + 1;
}

export function anioAnterior(fecha: string): string {
  if (!isDayKey(fecha)) {
    return fecha;
  }
  const year = Number(fecha.slice(0, 4)) - 1;
  const month = Number(fecha.slice(5, 7));
  const day = Number(fecha.slice(8, 10));
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const clamped = Math.min(day, last);
  return `${year}-${String(month).padStart(2, "0")}-${String(clamped).padStart(2, "0")}`;
}

/** El día en curso no entra en la comparación. Un periodo ya cerrado se usa completo. */
export function tramoCompleto(desde: string, hasta: string, now = Date.now()): { tramo: Ventana | null; recortado: boolean } {
  const hoy = todayDayKey(now);
  if (hasta < hoy) {
    return { tramo: { desde, hasta }, recortado: false };
  }
  const fin = yesterdayDayKey(now);
  if (fin < desde) {
    return { tramo: null, recortado: true };
  }
  return { tramo: { desde, hasta: fin }, recortado: fin < hasta };
}

export function ventanaComparada(tramo: Ventana, modo: ModoComparacion): { anterior: Ventana; algoritmo: string } {
  const largo = diasInclusivos(tramo.desde, tramo.hasta);
  if (modo === "anterior") {
    const hasta = addDaysToDayKey(tramo.desde, -1);
    const desde = addDaysToDayKey(hasta, -(largo - 1));
    return {
      anterior: { desde, hasta },
      algoritmo: "Periodo anterior equivalente: la misma cantidad de días completos, terminando el día antes del tramo.",
    };
  }
  if (modo === "semana") {
    const semanas = Math.max(1, Math.ceil(largo / 7));
    const shift = semanas * 7;
    return {
      anterior: { desde: addDaysToDayKey(tramo.desde, -shift), hasta: addDaysToDayKey(tramo.hasta, -shift) },
      algoritmo: `Mismos días de la semana: la ventana se corre ${shift} días, un múltiplo de 7, para que cada fecha caiga en el mismo día y las ventanas no se solapen.`,
    };
  }
  return {
    anterior: { desde: anioAnterior(tramo.desde), hasta: anioAnterior(tramo.hasta) },
    algoritmo: "Año anterior: las mismas fechas del año previo. El 29 de febrero se compara con el 28.",
  };
}

export function resolverComparacion(
  desde: string,
  hasta: string,
  modo: ModoComparacion | "off",
  now = Date.now(),
): ComparacionResuelta {
  const { tramo, recortado } = tramoCompleto(desde, hasta, now);
  if (modo === "off") {
    return { modo, algoritmo: "Sin comparación.", tramo, anterior: null, recortado };
  }
  if (!tramo) {
    return {
      modo,
      algoritmo: "El periodo todavía no tiene un día completo. La comparación espera a que cierre el día.",
      tramo: null,
      anterior: null,
      recortado,
    };
  }
  const comparado = ventanaComparada(tramo, modo);
  return { modo, algoritmo: comparado.algoritmo, tramo, anterior: comparado.anterior, recortado };
}

export function fechasEsperadas(desde: string, hasta: string): string[] {
  const fechas: string[] = [];
  const total = diasInclusivos(desde, hasta);
  for (let index = 0; index < total; index += 1) {
    fechas.push(addDaysToDayKey(desde, index));
  }
  return fechas;
}

/** Una fecha sin fila no es una venta en cero. Si falta alguna, la comparación no se muestra. */
export function coberturaDeFechas(presentes: Iterable<string>, desde: string, hasta: string): { completa: boolean; dias: number; esperados: number } {
  const set = new Set(presentes);
  const esperados = fechasEsperadas(desde, hasta);
  const dias = esperados.filter((fecha) => set.has(fecha)).length;
  return { completa: dias === esperados.length && esperados.length > 0, dias, esperados: esperados.length };
}

export type EstadoComparacion = "off" | "ok" | "no_disponible" | "sin_base";

export function estadoComparacion(input: {
  pedida: boolean;
  coberturaCompleta: boolean;
  base: number | null;
}): EstadoComparacion {
  if (!input.pedida) {
    return "off";
  }
  if (!input.coberturaCompleta) {
    return "no_disponible";
  }
  if (input.base == null || input.base === 0) {
    return "sin_base";
  }
  return "ok";
}

export function variacionPct(actual: number | null, anterior: number | null): number | null {
  if (actual == null || anterior == null || anterior === 0) {
    return null;
  }
  return (actual - anterior) / Math.abs(anterior);
}

/** venta = tickets × ticket. Los efectos suman el cambio en pesos; sus porcentajes no se suman. */
export function desgloseVenta(actual: { tickets: number; ticket: number | null }, anterior: { tickets: number; ticket: number | null }): {
  efectoTickets: number | null;
  efectoTicket: number | null;
  delta: number | null;
} {
  if (actual.ticket == null || anterior.ticket == null) {
    return { efectoTickets: null, efectoTicket: null, delta: null };
  }
  const efectoTickets = (actual.tickets - anterior.tickets) * anterior.ticket;
  const efectoTicket = (actual.ticket - anterior.ticket) * actual.tickets;
  return {
    efectoTickets: Math.round(efectoTickets * 100) / 100,
    efectoTicket: Math.round(efectoTicket * 100) / 100,
    delta: Math.round((efectoTickets + efectoTicket) * 100) / 100,
  };
}

export function participacion(venta: number, denominador: number): number | null {
  if (!(denominador > 0)) {
    return null;
  }
  return venta / denominador;
}

export function coberturaMonetaria(ventaConCosto: number, venta: number): number | null {
  if (!(venta > 0)) {
    return null;
  }
  return ventaConCosto / venta;
}

export function coberturaDifiere(actual: number | null, anterior: number | null, umbral = 0.05): boolean {
  if (actual == null || anterior == null) {
    return false;
  }
  return Math.abs(actual - anterior) >= umbral;
}

export function promedioOcurrencia(total: number, ocurrencias: number): number | null {
  if (!(ocurrencias > 0)) {
    return null;
  }
  return Math.round((total / ocurrencias) * 100) / 100;
}

export type EstadoHora = "con_ventas" | "abierto_sin_ventas" | "sin_datos" | "cobertura_incompleta";

/** No hay fuente de “cerrado”. Una hora sin ventas no se marca como tienda cerrada. */
export function estadoHora(input: { ocurrencias: number; ordenes: number; incompletas: number }): EstadoHora {
  if (input.ocurrencias <= 0 && input.ordenes <= 0 && input.incompletas <= 0) {
    return "sin_datos";
  }
  if (input.ocurrencias <= 0 && input.incompletas > 0) {
    return "cobertura_incompleta";
  }
  if (input.ordenes > 0) {
    return "con_ventas";
  }
  if (input.ocurrencias > 0) {
    return "abierto_sin_ventas";
  }
  return "sin_datos";
}

export function asociacionCanasta(input: { elegibles: number; conA: number; conB: number; conAmbos: number }): {
  proporcion: number | null;
  dadoA: number | null;
  fuerza: number | null;
  muestraPequena: boolean;
  limitacion: string | null;
} {
  const { elegibles, conA, conB, conAmbos } = input;
  const proporcion = elegibles > 0 ? conAmbos / elegibles : null;
  const dadoA = conA > 0 ? conAmbos / conA : null;
  const esperado = elegibles > 0 ? (conA / elegibles) * (conB / elegibles) : null;
  const fuerza = esperado != null && esperado > 0 && proporcion != null ? proporcion / esperado : null;
  const muestraPequena = elegibles < 50 || conAmbos < 20;
  return {
    proporcion,
    dadoA,
    fuerza,
    muestraPequena,
    limitacion: muestraPequena
      ? "Muestra pequeña: menos de 50 tickets elegibles o menos de 20 con ambos productos. No es una conclusión."
      : null,
  };
}

export function codigoVisible(codigo: string): string | null {
  if (codigo.startsWith("__export__")) {
    return null;
  }
  return codigo;
}

export const DEFINICIONES_CONSUMO = {
  venta:
    "Suma del total de las órdenes paid, done e invoiced. El total es lo que pagó el cliente, con el ITBIS incluido y las devoluciones ya restadas. draft y cancel se guardan y no entran. No se suma ventas_diarias encima: ese libro es el de finanzas.",
  tickets: "Órdenes paid, done e invoiced del periodo. Una devolución cuenta como orden si quedó en uno de esos estados, y su monto negativo resta en la venta.",
  ticket: "Venta con ITBIS dividida entre los tickets del mismo periodo.",
  unidadesTicket: "Unidades de las líneas de esas órdenes, divididas entre los tickets. Una cantidad negativa de devolución resta.",
  margen:
    "Solo las ventas que tienen costo. Venta y costo traen ITBIS: se les quita la tasa de la línea (o la del producto) y se restan. No se reparte el margen conocido sobre la venta que no tiene costo.",
  cobertura: "Venta con ITBIS de los productos que tienen costo, dividida entre la venta con ITBIS del periodo. Las dos usan la misma base.",
  margenPct: "Margen en pesos dividido entre la venta sin ITBIS de los productos que tienen costo. El denominador no incluye la venta sin costo.",
  costo: COSTO_METODO_TEXTO,
  horaReal:
    "Hora y día de la transacción en America/Santo_Domingo. fecha es timestamptz; se convierte una sola vez. No se vuelve a convertir hora_local.",
  horaCaja:
    "Día operativo: el día en que se abrió la caja, también en America/Santo_Domingo. Una venta después de medianoche sigue en ese día. hora_local ya quedó grabada en esa zona al ingerir.",
  comparacion: "Un día sin fila de resumen no es una venta en cero. Si al periodo comparado le falta alguno de sus días, la comparación no se muestra.",
  descuento:
    "El descuento de la línea ya está dentro de subtotal_con_itbis y del total de la orden. No se vuelve a restar.",
  participacion:
    "Venta del producto con ITBIS dividida entre la venta con ITBIS de todo el periodo, no entre la página ni entre la venta sin ITBIS.",
  canasta:
    "Un ticket contiene un producto si la suma de cantidades, sin las líneas marcadas como devolución, es mayor que cero. El producto repetido en el mismo ticket cuenta una vez. draft y cancel no entran.",
} as const;
