import { isDayKey } from "@/lib/local-day";

export const GRAFICA_TIPOS = [
  "linea",
  "barras",
  "barras_divergentes",
  "cascada",
  "histograma",
  "apiladas",
  "apiladas_100",
  "dona",
  "calor",
  "porcentaje",
] as const;

export type GraficaTipo = (typeof GRAFICA_TIPOS)[number];
export type GraficaUnidad = "rd" | "numero" | "pct";

export type PuntoGrafica = {
  etiqueta: string;
  valor: number | null;
  grupo: string | null;
  inicio: number | null;
  fin: number | null;
};

export type GraficaMiles = {
  titulo: string;
  tipo: GraficaTipo;
  unidad: GraficaUnidad;
  serie: PuntoGrafica[];
  periodo: { desde: string; hasta: string } | null;
  comparacion: string | null;
  agregacion: string | null;
  numerador: number | null;
  denominador: number | null;
  muestra: number | null;
  cobertura: string | null;
  proyeccion: boolean;
  definicion: string | null;
};

const PROHIBIDO = /<\s*\/?\s*(script|html|style|iframe)|javascript:|srcdoc/i;

function texto(value: unknown, campo: string, max: number, obligatorio: boolean): { valor: string | null; error: string | null } {
  if (value == null || value === "") return { valor: null, error: obligatorio ? `${campo} es obligatorio` : null };
  if (typeof value !== "string" || PROHIBIDO.test(value)) return { valor: null, error: `${campo} no es válido` };
  const limpio = value.trim();
  if (!limpio) return { valor: null, error: obligatorio ? `${campo} es obligatorio` : null };
  if (limpio.length > max) return { valor: null, error: `${campo} supera ${max} caracteres` };
  return { valor: limpio, error: null };
}

function numero(value: unknown, campo: string): { valor: number | null; error: string | null } {
  if (value == null || value === "") return { valor: null, error: null };
  if (typeof value !== "number" || !Number.isFinite(value)) return { valor: null, error: `${campo} tiene que ser un número finito` };
  return { valor: value, error: null };
}

function puntos(value: unknown): { puntos: PuntoGrafica[]; error: string | null } {
  if (value == null) return { puntos: [], error: null };
  if (!Array.isArray(value) || value.length > 60) return { puntos: [], error: "grafica.serie no es válida" };
  const salida: PuntoGrafica[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return { puntos: [], error: "grafica.serie no es válida" };
    const raw = item as Record<string, unknown>;
    const etiqueta = texto(raw.etiqueta, "etiqueta", 80, true);
    if (etiqueta.error || !etiqueta.valor) return { puntos: [], error: etiqueta.error };
    const valor = numero(raw.valor, "valor");
    if (valor.error) return { puntos: [], error: valor.error };
    const inicio = numero(raw.inicio, "inicio");
    if (inicio.error) return { puntos: [], error: inicio.error };
    const fin = numero(raw.fin, "fin");
    if (fin.error) return { puntos: [], error: fin.error };
    const grupo = texto(raw.grupo, "grupo", 40, false);
    if (grupo.error) return { puntos: [], error: grupo.error };
    salida.push({ etiqueta: etiqueta.valor, valor: valor.valor, grupo: grupo.valor, inicio: inicio.valor, fin: fin.valor });
  }
  return { puntos: salida, error: null };
}

export function leerGrafica(value: unknown): { grafica: GraficaMiles | null; error: string | null } {
  if (value == null) return { grafica: null, error: null };
  if (!value || typeof value !== "object" || Array.isArray(value)) return { grafica: null, error: "grafica tiene que ser un objeto" };
  const raw = value as Record<string, unknown>;
  if (PROHIBIDO.test(JSON.stringify(raw))) return { grafica: null, error: "grafica no acepta HTML ni código" };
  const titulo = texto(raw.titulo, "grafica.titulo", 80, true);
  if (titulo.error || !titulo.valor) return { grafica: null, error: titulo.error };
  if (typeof raw.tipo !== "string" || !GRAFICA_TIPOS.includes(raw.tipo as GraficaTipo)) return { grafica: null, error: "grafica.tipo no es válido" };
  if (raw.unidad !== "rd" && raw.unidad !== "numero" && raw.unidad !== "pct") return { grafica: null, error: "grafica.unidad no es válida" };
  const serie = puntos(raw.serie);
  if (serie.error) return { grafica: null, error: serie.error };
  const numerador = numero(raw.numerador, "numerador");
  if (numerador.error) return { grafica: null, error: numerador.error };
  const denominador = numero(raw.denominador, "denominador");
  if (denominador.error) return { grafica: null, error: denominador.error };
  const muestra = numero(raw.muestra, "muestra");
  if (muestra.error) return { grafica: null, error: muestra.error };
  let periodo: GraficaMiles["periodo"] = null;
  if (raw.periodo != null) {
    if (!raw.periodo || typeof raw.periodo !== "object" || Array.isArray(raw.periodo)) return { grafica: null, error: "grafica.periodo no es válido" };
    const rango = raw.periodo as Record<string, unknown>;
    if (typeof rango.desde !== "string" || typeof rango.hasta !== "string" || !isDayKey(rango.desde) || !isDayKey(rango.hasta) || rango.desde > rango.hasta) {
      return { grafica: null, error: "grafica.periodo tiene que ser YYYY-MM-DD" };
    }
    periodo = { desde: rango.desde, hasta: rango.hasta };
  }
  const comparacion = texto(raw.comparacion, "grafica.comparacion", 120, false);
  if (comparacion.error) return { grafica: null, error: comparacion.error };
  const agregacion = texto(raw.agregacion, "grafica.agregacion", 160, false);
  if (agregacion.error) return { grafica: null, error: agregacion.error };
  const cobertura = texto(raw.cobertura, "grafica.cobertura", 160, false);
  if (cobertura.error) return { grafica: null, error: cobertura.error };
  const definicion = texto(raw.definicion, "grafica.definicion", 240, false);
  if (definicion.error) return { grafica: null, error: definicion.error };
  if (typeof raw.proyeccion !== "boolean" && raw.proyeccion != null) return { grafica: null, error: "grafica.proyeccion tiene que ser sí o no" };
  const grafica: GraficaMiles = {
    titulo: titulo.valor,
    tipo: raw.tipo as GraficaTipo,
    unidad: raw.unidad,
    serie: serie.puntos,
    periodo,
    comparacion: comparacion.valor,
    agregacion: agregacion.valor,
    numerador: numerador.valor,
    denominador: denominador.valor,
    muestra: muestra.valor,
    cobertura: cobertura.valor,
    proyeccion: raw.proyeccion === true,
    definicion: definicion.valor,
  };
  const regla = validarGrafica(grafica);
  if (regla) return { grafica: null, error: regla };
  return { grafica, error: null };
}

export function validarGrafica(grafica: GraficaMiles): string | null {
  const valores = grafica.serie.map((punto) => punto.valor);
  if (valores.some((valor) => valor != null && !Number.isFinite(valor))) return "La gráfica tiene un valor que no es un número";
  if (grafica.tipo === "linea" && valores.filter((valor) => valor != null).length < 2) return "Una línea necesita al menos dos observaciones";
  if ((grafica.tipo === "barras" || grafica.tipo === "apiladas" || grafica.tipo === "apiladas_100") && valores.some((valor) => valor != null && valor < 0)) {
    return "Esas barras miden magnitud y no aceptan negativos";
  }
  if (grafica.tipo === "dona") {
    if (grafica.serie.length < 2 || grafica.serie.length > 6) return "Una dona usa de dos a seis partes";
    if (valores.some((valor) => valor == null || valor < 0)) return "Una dona solo parte un total, sin negativos ni huecos";
  }
  if (grafica.tipo === "porcentaje") {
    if (grafica.numerador == null || grafica.denominador == null || !(grafica.denominador > 0)) return "Una barra de porcentaje necesita numerador y denominador";
    if (grafica.numerador < 0 || grafica.numerador > grafica.denominador) return "El numerador no puede pasar del denominador";
  }
  if (grafica.tipo === "histograma") {
    const intervalos = grafica.serie.map((punto) => ({ inicio: punto.inicio, fin: punto.fin }));
    if (intervalos.some((item) => item.inicio == null || item.fin == null || item.fin <= item.inicio)) return "Un histograma necesita intervalos inicio < fin";
    const ordenados = [...intervalos].sort((a, b) => (a.inicio ?? 0) - (b.inicio ?? 0));
    for (let i = 1; i < ordenados.length; i += 1) {
      if ((ordenados[i].inicio ?? 0) < (ordenados[i - 1].fin ?? 0)) return "Los intervalos del histograma no pueden solaparse";
    }
  }
  if (grafica.tipo === "cascada") {
    if (grafica.serie.length < 2) return "Una cascada necesita el cambio y sus contribuciones";
    const total = grafica.serie[grafica.serie.length - 1]?.valor;
    const partes = grafica.serie.slice(0, -1).reduce((suma, punto) => suma + (punto.valor ?? 0), 0);
    if (total == null || Math.abs(partes - total) > Math.max(0.05, Math.abs(total) * 0.001)) return "Las contribuciones de la cascada no cuadran con el cambio";
  }
  if (grafica.unidad === "pct" && /confianza|probabilidad/i.test(`${grafica.titulo} ${grafica.definicion ?? ""}`) && !grafica.definicion) {
    return "Un porcentaje de confianza necesita su definición";
  }
  return null;
}
