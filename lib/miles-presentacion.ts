import { STAFF_TIMEZONE, calendarDayKey, formatDayKey } from "@/lib/local-day";

export const VISUAL_TIPOS = ["tendencia", "comparacion", "horarios", "concentracion", "canasta", "calidad"] as const;
export type VisualTipo = (typeof VISUAL_TIPOS)[number];

export type PuntoVisual = { etiqueta: string; valor: number };

export type VisualMiles = {
  tipo: VisualTipo;
  metrica: { nombre: string; valor: number; unidad: "rd" | "numero" | "pct" } | null;
  comparacion: { valor: number; periodo: string; metodo: string } | null;
  serie: PuntoVisual[];
  categorias: PuntoVisual[];
  numerador: number | null;
  denominador: number | null;
  muestra: number | null;
  fuente: string | null;
  corte: string | null;
  explorar: { pantalla: "resumen" | "productos" | "horarios" | "canasta"; query: string } | null;
};

const PANTALLAS = ["resumen", "productos", "horarios", "canasta"] as const;
const UNIDADES = ["rd", "numero", "pct"] as const;

export function leerVisual(value: unknown): { visual: VisualMiles | null; error: string | null } {
  if (value == null) return { visual: null, error: null };
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { visual: null, error: "visual tiene que ser un objeto" };
  }
  const raw = value as Record<string, unknown>;
  if (contieneEjecutable(raw)) {
    return { visual: null, error: "visual no acepta HTML ni código" };
  }
  const tipo = raw.tipo;
  if (typeof tipo !== "string" || !VISUAL_TIPOS.includes(tipo as VisualTipo)) {
    return { visual: null, error: "visual.tipo no es válido" };
  }
  const metrica = leerMetrica(raw.metrica);
  if (metrica.error) return { visual: null, error: metrica.error };
  const comparacion = leerComparacion(raw.comparacion);
  if (comparacion.error) return { visual: null, error: comparacion.error };
  const serie = leerPuntos(raw.serie ?? raw.series, "serie", 24);
  if (serie.error) return { visual: null, error: serie.error };
  const categorias = leerPuntos(raw.categorias, "categorias", 14);
  if (categorias.error) return { visual: null, error: categorias.error };
  const numerador = leerNumeroOpcional(raw.numerador, "numerador");
  if (numerador.error) return { visual: null, error: numerador.error };
  const denominador = leerNumeroOpcional(raw.denominador, "denominador");
  if (denominador.error) return { visual: null, error: denominador.error };
  const muestra = leerNumeroOpcional(raw.muestra, "muestra");
  if (muestra.error) return { visual: null, error: muestra.error };
  const explorar = leerExplorar(raw.explorar);
  if (explorar.error) return { visual: null, error: explorar.error };
  const fuente = exigirTexto(raw.fuente, "visual.fuente", 120);
  if (fuente.error) return { visual: null, error: fuente.error };
  const corte = exigirTexto(raw.corte, "visual.corte", 40);
  if (corte.error) return { visual: null, error: corte.error };
  return {
    visual: {
      tipo: tipo as VisualTipo,
      metrica: metrica.valor,
      comparacion: comparacion.valor,
      serie: serie.puntos,
      categorias: categorias.puntos,
      numerador: numerador.valor,
      denominador: denominador.valor,
      muestra: muestra.valor,
      fuente: fuente.valor,
      corte: corte.valor,
      explorar: explorar.valor,
    },
    error: null,
  };
}

export function visualCoherente(visual: VisualMiles | null, metricas: Record<string, unknown>): { ok: boolean; motivo: string | null } {
  if (!visual?.metrica) return { ok: true, motivo: null };
  const clave = normalizar(visual.metrica.nombre);
  const guardado = Object.entries(metricas).find(([key]) => normalizar(key) === clave);
  if (!guardado || typeof guardado[1] !== "number" || !Number.isFinite(guardado[1])) {
    return { ok: true, motivo: null };
  }
  const delta = Math.abs(guardado[1] - visual.metrica.valor);
  const tolerancia = Math.max(0.05, Math.abs(guardado[1]) * 0.001);
  if (delta > tolerancia) {
    return { ok: false, motivo: "La cifra de la visualización no coincide con el snapshot publicado." };
  }
  return { ok: true, motivo: null };
}

export function graficoAlcanza(visual: VisualMiles | null): boolean {
  if (!visual) return false;
  if (visual.tipo === "tendencia") return visual.serie.length >= 2;
  if (visual.tipo === "comparacion") return visual.serie.length >= 2 || (visual.metrica != null && visual.comparacion != null);
  if (visual.tipo === "horarios") return visual.categorias.length >= 4 || visual.serie.length >= 4;
  if (visual.tipo === "concentracion" || visual.tipo === "calidad") return visual.numerador != null && visual.denominador != null && visual.denominador > 0;
  if (visual.tipo === "canasta") return visual.muestra != null && visual.numerador != null;
  return false;
}

type FilaEstado = {
  estado?: unknown;
  tipo?: unknown;
  resolucion?: unknown;
  recomendacion_estado?: unknown;
  limitaciones?: unknown;
  recomendacion?: unknown;
};

/** Clasificación de pantalla. No escribe el estado del hallazgo. */
export function clasificarHallazgo(row: FilaEstado): "requiere_revision" | "resuelto" | "vigente" | "descartado" | "archivado" {
  const estado = String(row.estado ?? "");
  if (estado === "descartado" || estado === "archivado") return estado;
  if (row.resolucion === "resuelta" || row.recomendacion_estado === "obsoleta") return "resuelto";
  if (row.resolucion === "pendiente") return "requiere_revision";
  if (estado === "vigente" && resolucionSoloEnProsa(row)) return "requiere_revision";
  return "vigente";
}

export function esResuelto(row: FilaEstado): boolean {
  const clase = clasificarHallazgo(row);
  return clase === "resuelto" || clase === "descartado" || clase === "archivado";
}

export function esPorRevisar(row: FilaEstado): boolean {
  return clasificarHallazgo(row) === "requiere_revision";
}

export function recomendacionActual(row: FilaEstado): string | null {
  if (row.recomendacion_estado === "obsoleta" || row.resolucion === "resuelta") return null;
  if (clasificarHallazgo(row) === "requiere_revision") return null;
  const texto = typeof row.recomendacion === "string" ? row.recomendacion.trim() : "";
  return texto || null;
}

export function recomendacionAnterior(row: FilaEstado): string | null {
  if (recomendacionActual(row)) return null;
  const texto = typeof row.recomendacion === "string" ? row.recomendacion.trim() : "";
  return texto || null;
}

export function formatoInstante(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return espacioNormal(new Intl.DateTimeFormat("es-DO", {
    timeZone: STAFF_TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date));
}

export function formatoDiaComercial(value: unknown): string {
  const key = calendarDayKey(value);
  return key ? espacioNormal(formatDayKey(key)) : "—";
}

function espacioNormal(value: string): string {
  return value.replace(/[\u00a0\u202f]/g, " ");
}

function resolucionSoloEnProsa(row: FilaEstado): boolean {
  if (row.resolucion != null || row.recomendacion_estado != null) return false;
  const limitaciones = typeof row.limitaciones === "string" ? row.limitaciones : "";
  const recomendacion = typeof row.recomendacion === "string" ? row.recomendacion.trim() : "";
  return /\bRESUELTO\b/.test(limitaciones) && recomendacion.length > 0;
}

function contieneEjecutable(value: unknown): boolean {
  if (typeof value === "string") {
    const texto = value.toLowerCase();
    return texto.includes("<") || texto.includes("javascript:") || texto.includes("://") || texto.includes("onerror=") || texto.includes("onload=");
  }
  if (Array.isArray(value)) return value.some((item) => contieneEjecutable(item));
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).some(([key, item]) => {
      const nombre = key.toLowerCase();
      if (["html", "script", "style", "component", "javascript", "srcdoc"].includes(nombre)) return true;
      return contieneEjecutable(item);
    });
  }
  return false;
}

function leerMetrica(value: unknown): { valor: VisualMiles["metrica"]; error: string | null } {
  if (value == null) return { valor: null, error: null };
  if (!value || typeof value !== "object" || Array.isArray(value)) return { valor: null, error: "visual.metrica no es válida" };
  const raw = value as Record<string, unknown>;
  const nombre = exigirTexto(raw.nombre, "visual.metrica.nombre", 80);
  if (nombre.error) return { valor: null, error: nombre.error };
  const unidad = raw.unidad;
  if (!nombre.valor || typeof raw.valor !== "number" || !Number.isFinite(raw.valor) || typeof unidad !== "string" || !UNIDADES.includes(unidad as (typeof UNIDADES)[number])) {
    return { valor: null, error: "visual.metrica necesita nombre, valor y unidad" };
  }
  return { valor: { nombre: nombre.valor, valor: raw.valor, unidad: unidad as "rd" | "numero" | "pct" }, error: null };
}

function leerComparacion(value: unknown): { valor: VisualMiles["comparacion"]; error: string | null } {
  if (value == null) return { valor: null, error: null };
  if (!value || typeof value !== "object" || Array.isArray(value)) return { valor: null, error: "visual.comparacion no es válida" };
  const raw = value as Record<string, unknown>;
  const periodo = exigirTexto(raw.periodo, "visual.comparacion.periodo", 80);
  if (periodo.error) return { valor: null, error: periodo.error };
  const metodo = exigirTexto(raw.metodo, "visual.comparacion.metodo", 80);
  if (metodo.error) return { valor: null, error: metodo.error };
  if (!periodo.valor || !metodo.valor || typeof raw.valor !== "number" || !Number.isFinite(raw.valor)) {
    return { valor: null, error: "visual.comparacion necesita valor, periodo y metodo" };
  }
  return { valor: { valor: raw.valor, periodo: periodo.valor, metodo: metodo.valor }, error: null };
}

function leerPuntos(value: unknown, campo: string, max: number): { puntos: PuntoVisual[]; error: string | null } {
  if (value == null) return { puntos: [], error: null };
  if (!Array.isArray(value) || value.length > max) return { puntos: [], error: `visual.${campo} no es válido` };
  const puntos: PuntoVisual[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return { puntos: [], error: `visual.${campo} no es válido` };
    const raw = item as Record<string, unknown>;
    const etiqueta = exigirTexto(raw.etiqueta, `visual.${campo}.etiqueta`, 40);
    if (etiqueta.error) return { puntos: [], error: etiqueta.error };
    if (!etiqueta.valor || typeof raw.valor !== "number" || !Number.isFinite(raw.valor)) {
      return { puntos: [], error: `visual.${campo} necesita etiqueta y valor` };
    }
    puntos.push({ etiqueta: etiqueta.valor, valor: raw.valor });
  }
  return { puntos, error: null };
}

function leerNumeroOpcional(value: unknown, campo: string): { valor: number | null; error: string | null } {
  if (value == null) return { valor: null, error: null };
  if (typeof value !== "number" || !Number.isFinite(value)) return { valor: null, error: `visual.${campo} tiene que ser un número` };
  return { valor: value, error: null };
}

function leerExplorar(value: unknown): { valor: VisualMiles["explorar"]; error: string | null } {
  if (value == null) return { valor: null, error: null };
  if (!value || typeof value !== "object" || Array.isArray(value)) return { valor: null, error: "visual.explorar no es válido" };
  const raw = value as Record<string, unknown>;
  const pantalla = raw.pantalla;
  const query = typeof raw.query === "string" ? raw.query : "";
  if (typeof pantalla !== "string" || !PANTALLAS.includes(pantalla as (typeof PANTALLAS)[number])) {
    return { valor: null, error: "visual.explorar solo abre Resumen, Productos, Horarios o Canasta" };
  }
  if (query.length > 500 || query.includes("://") || query.includes("javascript:") || query.startsWith("/") || query.includes("<")) {
    return { valor: null, error: "visual.explorar solo lleva filtros del dashboard" };
  }
  return { valor: { pantalla: pantalla as NonNullable<VisualMiles["explorar"]>["pantalla"], query }, error: null };
}

function exigirTexto(value: unknown, campo: string, max: number): { valor: string | null; error: string | null } {
  if (value == null || value === "") return { valor: null, error: null };
  if (typeof value !== "string" || value.trim() === "" || value.trim().length > max) {
    return { valor: null, error: `${campo} no es válido` };
  }
  return { valor: value.trim(), error: null };
}

function normalizar(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
