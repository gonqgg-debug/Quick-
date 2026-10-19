export type ConteosAsociacion = { elegibles: number; conA: number; conB: number; conAmbos: number };

export type MetricaAsociacion = {
  soporte: number | null;
  dadoA: number | null;
  dadoB: number | null;
  afinidad: number | null;
  esperados: number | null;
  muestraPequena: boolean;
  limitacion: string | null;
};

export function metricaAsociacion(input: ConteosAsociacion, umbralElegibles = 50, umbralAmbos = 20): { metrica: MetricaAsociacion | null; error: string | null } {
  const { elegibles, conA, conB, conAmbos } = input;
  const enteros = [elegibles, conA, conB, conAmbos];
  if (enteros.some((valor) => !Number.isInteger(valor) || valor < 0)) {
    return { metrica: null, error: "Los conteos de la asociación tienen que ser enteros de cero en adelante" };
  }
  if (conAmbos > conA || conAmbos > conB || conA > elegibles || conB > elegibles) {
    return { metrica: null, error: "Los tickets compartidos no pueden superar los tickets de cada producto ni el total" };
  }
  const soporte = elegibles > 0 ? conAmbos / elegibles : null;
  const dadoA = conA > 0 ? conAmbos / conA : null;
  const dadoB = conB > 0 ? conAmbos / conB : null;
  const esperadoTasa = elegibles > 0 ? (conA / elegibles) * (conB / elegibles) : null;
  const afinidad = soporte != null && esperadoTasa != null && esperadoTasa > 0 ? soporte / esperadoTasa : null;
  const esperados = esperadoTasa == null ? null : esperadoTasa * elegibles;
  const muestraPequena = elegibles < umbralElegibles || conAmbos < umbralAmbos;
  return {
    metrica: {
      soporte,
      dadoA,
      dadoB,
      afinidad,
      esperados,
      muestraPequena,
      limitacion: muestraPequena
        ? `Muestra bajo el umbral: menos de ${umbralElegibles} tickets elegibles o menos de ${umbralAmbos} con ambos. No es una conclusión.`
        : null,
    },
    error: null,
  };
}

export type EstadoPortada = "publicado" | "parcial" | "en_curso" | "fallida" | "sin_informe" | "anterior";

export function clasificarPortada(input: {
  hoy: string;
  informeFecha: string | null;
  informeEstado: "publicado" | "parcial" | null;
  ejecucionEstado: string | null;
}): { estado: EstadoPortada; informeEsDeHoy: boolean } {
  const deHoy = input.informeFecha === input.hoy;
  if (deHoy && input.informeEstado === "publicado") return { estado: "publicado", informeEsDeHoy: true };
  if (deHoy && input.informeEstado === "parcial") return { estado: "parcial", informeEsDeHoy: true };
  if (input.informeFecha && input.informeFecha < input.hoy) {
    if (input.ejecucionEstado === "en_curso") return { estado: "en_curso", informeEsDeHoy: false };
    if (input.ejecucionEstado === "fallida") return { estado: "fallida", informeEsDeHoy: false };
    if (input.ejecucionEstado === "parcial") return { estado: "parcial", informeEsDeHoy: false };
    return { estado: "anterior", informeEsDeHoy: false };
  }
  if (input.ejecucionEstado === "en_curso") return { estado: "en_curso", informeEsDeHoy: false };
  if (input.ejecucionEstado === "fallida") return { estado: "fallida", informeEsDeHoy: false };
  if (input.ejecucionEstado === "parcial") return { estado: "parcial", informeEsDeHoy: false };
  return { estado: "sin_informe", informeEsDeHoy: false };
}

export const ETIQUETA_PORTADA: Record<EstadoPortada, string> = {
  publicado: "Informe publicado",
  parcial: "Ejecución parcial",
  en_curso: "Ejecución en curso",
  fallida: "Ejecución fallida",
  sin_informe: "Sin informe para hoy",
  anterior: "Informe anterior",
};

export const ETIQUETA_TIPO: Record<string, string> = {
  cambio: "Cambio",
  deterioro: "Cambio",
  anomalia: "Cambio",
  patron: "Patrón",
  oportunidad: "Oportunidad",
  calidad: "Calidad de datos",
};

export const ETIQUETA_PROPUESTA: Record<string, string> = {
  borrador: "En evaluación",
  por_revisar: "En evaluación",
  requiere_ampliacion: "Bloqueada",
  bloqueada: "Bloqueada",
  lista_para_probar: "Lista para decisión",
  aprobada: "Aprobada para implementar",
  implementada: "Implementada, en prueba",
  evaluada: "Evaluada",
  descartada: "Descartada",
  archivada: "Archivada",
};

export const ETIQUETA_TAREA: Record<string, string> = {
  ejecutada: "Ejecutada",
  sin_novedades: "Revisión sin novedades",
  publicada: "Resultado publicado",
  limitada: "Análisis limitado",
  fallida: "Tarea fallida",
  no_ejecutada: "No ejecutada",
};

export function ordenarCasos<T extends { prioridad?: unknown; publicado_en?: unknown; actualizado_en?: unknown }>(filas: T[]): T[] {
  const peso = (valor: unknown) => (valor === "alta" ? 0 : valor === "media" ? 1 : 2);
  return [...filas].sort((a, b) => {
    const prioridad = peso(a.prioridad) - peso(b.prioridad);
    if (prioridad !== 0) return prioridad;
    return String(b.actualizado_en ?? b.publicado_en ?? "").localeCompare(String(a.actualizado_en ?? a.publicado_en ?? ""));
  });
}
