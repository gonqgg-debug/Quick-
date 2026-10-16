import { margenConsumo } from "@/lib/pos-domain";

/** Versión de la fórmula que guarda cada variante y el snapshot de una prueba. */
export const FORMULA_PROMO = "combo-v1";

export const TIPOS_PROMO = ["combo", "acompanamiento", "compra_minima", "horario", "salida_inventario"] as const;
export type TipoPromo = (typeof TIPOS_PROMO)[number];

export type LineaPromo = {
  productId: string;
  cantidad: number;
  precioHabitual: number;
  precioPromo: number | null;
  costo: number | null;
  tasa: number | null;
};

export type SupuestosPromo = {
  ticketsElegibles: number | null;
  yaCompraban: number | null;
  adopcion: number | null;
  sustitucion: number | null;
  /** Costo, por ticket que ya superaba el umbral, del beneficio de una compra mínima. */
  costoBeneficio: number | null;
  margenIncrementalUmbral: number | null;
  conservador: number | null;
  favorable: number | null;
};

export type EntradaPromo = {
  tipo: TipoPromo;
  lineas: LineaPromo[];
  precioCombo: number | null;
  descuento: number | null;
  supuestos: SupuestosPromo;
};

export type CombinacionPromo = {
  ingreso: number | null;
  costo: number | null;
  margen: number | null;
  margenHabitual: number | null;
  diferenciaPrecio: number | null;
  margenCedido: number | null;
  limitacion: string | null;
};

export type EscenarioPromo = {
  nombre: "base" | "conservador" | "central" | "favorable";
  adopcion: number | null;
  redencionesExistentes: number | null;
  redencionesNuevas: number | null;
  costoSobreExistentes: number | null;
  margenNuevas: number | null;
  resultado: number | null;
  supuesto: string;
  limitacion: string | null;
};

export type ResultadoPromo = {
  formula: typeof FORMULA_PROMO;
  combinacion: CombinacionPromo;
  escenarios: EscenarioPromo[];
  equilibrio: { tasa: number | null; limitacion: string | null };
  sensibilidad: { eje: string; puntos: Array<{ supuesto: number; resultado: number | null }> };
  probabilidad: null;
};

const EJE = "Adopción supuesta entre quienes no compraban la combinación. No es un pronóstico.";

export function supuestosVacios(): SupuestosPromo {
  return {
    ticketsElegibles: null,
    yaCompraban: null,
    adopcion: null,
    sustitucion: null,
    costoBeneficio: null,
    margenIncrementalUmbral: null,
    conservador: null,
    favorable: null,
  };
}

export function calcularPromo(entrada: EntradaPromo): ResultadoPromo {
  const combinacion = calcularCombinacion(entrada);
  const escenarios = armarEscenarios(entrada, combinacion);
  return {
    formula: FORMULA_PROMO,
    combinacion,
    escenarios,
    equilibrio: equilibrioDe(entrada, combinacion),
    sensibilidad: sensibilidadDe(entrada, combinacion),
    probabilidad: null,
  };
}

function calcularCombinacion(entrada: EntradaPromo): CombinacionPromo {
  const habitual = suma(entrada.lineas.map((linea) => linea.precioHabitual * linea.cantidad));
  const costo = costoDe(entrada.lineas);
  const margenHabitual = margenDe(entrada.lineas, (linea) => linea.precioHabitual);
  if (habitual == null) {
    return vacia("Falta el precio habitual de algún producto.");
  }
  const promo = ingresoPromo(entrada, habitual);
  if (promo.ingreso == null) {
    return { ...vacia(promo.limitacion), costo, margenHabitual: margenHabitual.valor };
  }
  const margen = margenPromo(entrada, promo.ingreso);
  const diferencia = redondear(habitual - promo.ingreso);
  const margenCedido = margenHabitual.valor != null && margen.valor != null ? redondear(margenHabitual.valor - margen.valor) : null;
  const extra = entrada.tipo === "salida_inventario" ? "Una salida de inventario no dice cuánto se va a vender." : entrada.tipo === "compra_minima" ? "En compra mínima, el beneficio otorgado a quien ya superaba el umbral es un costo, no una venta nueva." : null;
  const limitacion = [promo.limitacion, margen.limitacion, extra].filter(Boolean).join(" ") || null;
  return {
    ingreso: promo.ingreso,
    costo,
    margen: margen.valor,
    margenHabitual: margenHabitual.valor,
    diferenciaPrecio: diferencia,
    margenCedido,
    limitacion,
  };
}

function ingresoPromo(entrada: EntradaPromo, habitual: number): { ingreso: number | null; limitacion: string | null } {
  if (entrada.precioCombo != null) {
    if (entrada.precioCombo < 0) return { ingreso: null, limitacion: "El precio del combo no puede ser negativo." };
    return { ingreso: redondear(entrada.precioCombo), limitacion: null };
  }
  if (entrada.lineas.some((linea) => linea.precioPromo != null)) {
    const total = suma(entrada.lineas.map((linea) => (linea.precioPromo ?? linea.precioHabitual) * linea.cantidad));
    return { ingreso: total, limitacion: null };
  }
  if (entrada.descuento != null) {
    if (entrada.descuento < 0) return { ingreso: null, limitacion: "El descuento no puede ser negativo." };
    if (entrada.descuento > habitual) return { ingreso: null, limitacion: "El descuento es mayor que el precio habitual." };
    return { ingreso: redondear(habitual - entrada.descuento), limitacion: null };
  }
  return { ingreso: redondear(habitual), limitacion: null };
}

function margenPromo(entrada: EntradaPromo, ingreso: number): { valor: number | null; limitacion: string | null } {
  if (entrada.precioCombo != null) {
    return margenUnico(entrada.lineas, ingreso);
  }
  if (entrada.descuento != null && !entrada.lineas.some((linea) => linea.precioPromo != null)) {
    const habitual = suma(entrada.lineas.map((linea) => linea.precioHabitual * linea.cantidad)) ?? 0;
    const factor = habitual === 0 ? 0 : ingreso / habitual;
    const valor = suma(entrada.lineas.map((linea) => {
      if (linea.costo == null || linea.tasa == null) return Number.NaN;
      return margenConsumo(linea.precioHabitual * linea.cantidad * factor, linea.cantidad, linea.costo, linea.tasa) ?? Number.NaN;
    }));
    if (valor == null || !Number.isFinite(valor)) return { valor: null, limitacion: "Falta el costo o la tasa para calcular el margen del descuento." };
    return { valor, limitacion: null };
  }
  const valor = suma(entrada.lineas.map((linea) => {
    const precio = linea.precioPromo ?? linea.precioHabitual;
    if (linea.costo == null || linea.tasa == null) return Number.NaN;
    return margenConsumo(precio * linea.cantidad, linea.cantidad, linea.costo, linea.tasa) ?? Number.NaN;
  }));
  if (valor == null || !Number.isFinite(valor)) {
    return { valor: null, limitacion: "Falta el costo actual o la tasa de ITBIS de algún producto. No se usa una tasa única para todo el catálogo." };
  }
  return { valor, limitacion: null };
}

function margenUnico(lineas: LineaPromo[], ingreso: number): { valor: number | null; limitacion: string | null } {
  const costo = costoDe(lineas);
  const tasas = tasasDe(lineas);
  if (costo == null) return { valor: null, limitacion: "Falta el costo actual de algún producto." };
  if (tasas == null) return { valor: null, limitacion: "Falta la tasa de ITBIS de algún producto." };
  if (new Set(tasas).size > 1) {
    return { valor: null, limitacion: "El combo tiene un solo precio y los productos no comparten la misma tasa de ITBIS." };
  }
  if (tasas.length === 0) return { valor: null, limitacion: "Falta la tasa de ITBIS de algún producto." };
  const unidades = lineas.reduce((sum, linea) => sum + linea.cantidad, 0);
  const costoUnitario = unidades === 0 ? null : costo / unidades;
  return { valor: margenConsumo(ingreso, unidades, costoUnitario, tasas[0]), limitacion: null };
}

function margenDe(lineas: LineaPromo[], precio: (linea: LineaPromo) => number): { valor: number | null } {
  const valor = suma(lineas.map((linea) => {
    if (linea.costo == null || linea.tasa == null) return Number.NaN;
    return margenConsumo(precio(linea) * linea.cantidad, linea.cantidad, linea.costo, linea.tasa) ?? Number.NaN;
  }));
  return { valor: valor != null && Number.isFinite(valor) ? valor : null };
}

function armarEscenarios(entrada: EntradaPromo, combinacion: CombinacionPromo): EscenarioPromo[] {
  const pedidos: Array<["base" | "conservador" | "central" | "favorable", number | null, string]> = [
    ["base", 0, "Solo quienes ya compraban. No se suma ninguna compra adicional."],
  ];
  if (entrada.supuestos.conservador != null) pedidos.push(["conservador", entrada.supuestos.conservador, "Adopción supuesta, escenario conservador."]);
  if (entrada.supuestos.adopcion != null) pedidos.push(["central", entrada.supuestos.adopcion, textoAdopcion(entrada)]);
  if (entrada.supuestos.favorable != null) pedidos.push(["favorable", entrada.supuestos.favorable, "Adopción supuesta, escenario favorable."]);
  return pedidos.map(([nombre, adopcion, supuesto]) => escenario(entrada, combinacion, nombre, adopcion, supuesto));
}

function escenario(
  entrada: EntradaPromo,
  combinacion: CombinacionPromo,
  nombre: EscenarioPromo["nombre"],
  adopcion: number | null,
  supuesto: string,
): EscenarioPromo {
  const base = {
    nombre,
    adopcion,
    redencionesExistentes: null,
    redencionesNuevas: null,
    costoSobreExistentes: null,
    margenNuevas: null,
    resultado: null,
    supuesto,
    limitacion: null as string | null,
  };
  const tickets = entrada.supuestos.ticketsElegibles;
  const existentes = entrada.supuestos.yaCompraban;
  if (tickets == null || existentes == null) {
    return { ...base, limitacion: "Faltan los tickets elegibles o cuántos ya compraban la combinación." };
  }
  if (existentes > tickets) {
    return { ...base, limitacion: "Quienes ya compraban no pueden ser más que los tickets elegibles." };
  }
  const restantes = tickets - existentes;
  const nuevas = adopcion == null ? null : redondear(restantes * adopcion);
  const costoExistentes = costoDeExistentes(entrada, combinacion, existentes);
  let margenNuevas: number | null = null;
  let limitacion: string | null = null;
  if (entrada.tipo === "salida_inventario") {
    limitacion = "Una salida de inventario no proyecta cuánto se va a vender.";
  } else if (entrada.tipo === "horario" && entrada.supuestos.sustitucion == null) {
    limitacion = "Falta el supuesto de desplazamiento entre horarios. No se asume cero.";
  } else if (nuevas == null) {
    limitacion = "No hay una adopción supuesta para este escenario.";
  } else if (entrada.tipo === "compra_minima") {
    if (entrada.supuestos.costoBeneficio == null) {
      limitacion = "Falta el costo del beneficio que reciben los tickets que ya superaban la compra mínima.";
    } else if (entrada.supuestos.margenIncrementalUmbral == null && adopcion !== 0) {
      limitacion = "En compra mínima no se infiere el margen del ticket que cruza el umbral.";
    } else {
      margenNuevas = redondear(nuevas * (entrada.supuestos.margenIncrementalUmbral ?? 0) * (1 - (entrada.supuestos.sustitucion ?? 0)));
    }
  } else if (combinacion.margen == null || costoExistentes == null) {
    limitacion = combinacion.limitacion ?? "Sin margen de la combinación no hay resultado total.";
  } else {
    margenNuevas = redondear(nuevas * combinacion.margen * (1 - (entrada.supuestos.sustitucion ?? 0)));
  }
  const resultado = margenNuevas != null && costoExistentes != null ? redondear(margenNuevas - costoExistentes) : null;
  return {
    ...base,
    redencionesExistentes: existentes,
    redencionesNuevas: nuevas,
    costoSobreExistentes: costoExistentes,
    margenNuevas,
    resultado,
    limitacion,
  };
}

function equilibrioDe(entrada: EntradaPromo, combinacion: CombinacionPromo): { tasa: number | null; limitacion: string | null } {
  const tickets = entrada.supuestos.ticketsElegibles;
  const existentes = entrada.supuestos.yaCompraban;
  if (tickets == null || existentes == null || existentes > tickets) {
    return { tasa: null, limitacion: "El equilibrio necesita los tickets elegibles y cuántos ya compraban." };
  }
  if (entrada.tipo === "salida_inventario") {
    return { tasa: null, limitacion: "Una salida de inventario no tiene equilibrio de adopción." };
  }
  if (entrada.tipo === "horario" && entrada.supuestos.sustitucion == null) {
    return { tasa: null, limitacion: "El equilibrio de un horario necesita el supuesto de desplazamiento." };
  }
  const restantes = tickets - existentes;
  if (restantes === 0) return { tasa: null, limitacion: "No quedan tickets fuera de quienes ya compraban." };
  const costo = costoDeExistentes(entrada, combinacion, existentes);
  const aporte = entrada.tipo === "compra_minima" ? entrada.supuestos.margenIncrementalUmbral : combinacion.margen;
  if (entrada.tipo === "compra_minima" && (entrada.supuestos.costoBeneficio == null || aporte == null)) {
    return { tasa: null, limitacion: "En compra mínima no se calcula equilibrio sin el costo del beneficio ya otorgado y el margen de la compra que cruza el umbral." };
  }
  if (costo == null || aporte == null) {
    return { tasa: null, limitacion: "Falta el margen para calcular el equilibrio." };
  }
  const neto = aporte * (1 - (entrada.supuestos.sustitucion ?? 0));
  if (neto <= 0) return { tasa: null, limitacion: "El margen de una compra nueva no cubre el incentivo. No hay equilibrio." };
  if (costo <= 0) return { tasa: 0, limitacion: null };
  return { tasa: redondearTasa(costo / (restantes * neto)), limitacion: null };
}

function costoDeExistentes(entrada: EntradaPromo, combinacion: CombinacionPromo, existentes: number): number | null {
  if (entrada.tipo === "compra_minima") {
    if (entrada.supuestos.costoBeneficio == null) return null;
    return redondear(existentes * entrada.supuestos.costoBeneficio);
  }
  if (combinacion.margenCedido == null) return null;
  return redondear(existentes * combinacion.margenCedido);
}

function textoAdopcion(entrada: EntradaPromo): string {
  if (entrada.supuestos.sustitucion == null) {
    return "Adopción supuesta, escenario central. Sin supuesto de sustitución: no se descuenta reemplazo.";
  }
  return "Adopción supuesta, escenario central.";
}

export function revisarAritmetica(escenario: Record<string, unknown>): Record<string, unknown> {
  if (typeof escenario.ingreso !== "number" || typeof escenario.costo !== "number" || typeof escenario.margen !== "number" || typeof escenario.tasa !== "number") {
    return { ...escenario, aritmetica: "sin_revisar" };
  }
  const esperado = (escenario.ingreso - escenario.costo) / (1 + escenario.tasa / 100);
  const tolerancia = Math.max(0.05, Math.abs(esperado) * 0.001);
  return {
    ...escenario,
    aritmetica: Math.abs(esperado - escenario.margen) <= tolerancia ? "coincide" : "difiere",
    margenEsperado: Math.round(esperado * 100) / 100,
  };
}

function sensibilidadDe(entrada: EntradaPromo, combinacion: CombinacionPromo): ResultadoPromo["sensibilidad"] {
  const puntos = Array.from({ length: 11 }, (_, index) => {
    const supuesto = redondear(index / 10);
    const fila = escenario(entrada, combinacion, "central", supuesto, "Punto de la curva.");
    return { supuesto, resultado: fila.resultado };
  });
  const sirve = puntos.some((punto) => punto.resultado != null);
  return { eje: EJE, puntos: sirve ? puntos : [] };
}

function costoDe(lineas: LineaPromo[]): number | null {
  if (lineas.some((linea) => linea.costo == null)) return null;
  return suma(lineas.map((linea) => (linea.costo ?? 0) * linea.cantidad));
}

function tasasDe(lineas: LineaPromo[]): number[] | null {
  if (lineas.some((linea) => linea.tasa == null)) return null;
  return lineas.map((linea) => linea.tasa ?? 0);
}

function suma(valores: number[]): number | null {
  if (valores.some((valor) => !Number.isFinite(valor))) return null;
  return redondear(valores.reduce((total, valor) => total + valor, 0));
}

function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}

function redondearTasa(valor: number): number {
  return Math.round(valor * 10000) / 10000;
}

function vacia(limitacion: string | null): CombinacionPromo {
  return {
    ingreso: null,
    costo: null,
    margen: null,
    margenHabitual: null,
    diferenciaPrecio: null,
    margenCedido: null,
    limitacion,
  };
}
