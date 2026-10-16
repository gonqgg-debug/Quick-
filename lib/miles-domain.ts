import { createHash } from "node:crypto";
import { isDayKey } from "@/lib/local-day";
import { leerVisual, type VisualMiles } from "@/lib/miles-presentacion";

export const MILES_ROL = "miles" as const;
export const MILES_NOMBRE = "Miles — Analista Comercial";
export const MILES_TIENDA = "quick";

export const MILES_TIPOS = ["oportunidad", "deterioro", "patron", "anomalia", "calidad"] as const;
export const MILES_PRIORIDADES = ["alta", "media", "baja"] as const;
export const MILES_ESTADOS_HALLAZGO = ["vigente", "descartado", "archivado"] as const;
export const MILES_ESTADOS_INVESTIGACION = ["pendiente", "en_analisis", "requiere_informacion", "completada", "cancelada"] as const;
export const MILES_ESTADOS_PRUEBA = ["propuesta", "aprobada", "en_curso", "pendiente_evaluacion", "finalizada", "cancelada"] as const;
export const MILES_ESTADOS_MILES_INVESTIGACION = ["en_analisis", "requiere_informacion", "completada"] as const;

export const PANTALLAS_EVIDENCIA = ["resumen", "productos", "horarios", "canasta"] as const;

const PROHIBIDOS = new Set(["agent_id", "agentId", "autor", "confianza", "confidence", "estado", "resolucion", "recomendacionEstado", "recomendacion_estado"]);

export class MilesError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function hashPayload(value: unknown): string {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

export function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonical(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function rechazarSuplantacion(body: Record<string, unknown>) {
  for (const key of Object.keys(body)) {
    if (PROHIBIDOS.has(key)) {
      throw new MilesError(400, `Miles no acepta el campo ${key}`);
    }
  }
}

function texto(value: unknown, campo: string, max: number): string {
  if (typeof value !== "string" || value.trim() === "" || value.length > max) {
    throw new MilesError(400, `${campo} es obligatorio`);
  }
  return value.trim();
}

function opcional(value: unknown, campo: string, max: number): string | null {
  if (value == null || value === "") {
    return null;
  }
  return texto(value, campo, max);
}

function fecha(value: unknown, campo: string): string {
  if (typeof value !== "string" || !isDayKey(value)) {
    throw new MilesError(400, `${campo} tiene que ser YYYY-MM-DD`);
  }
  return value;
}

function objeto(value: unknown, campo: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new MilesError(400, `${campo} tiene que ser un objeto`);
  }
  return value as Record<string, unknown>;
}

export type EvidenciaMiles = {
  consultas: string[];
  filtros: Record<string, unknown>;
  enlaces: Array<{ pantalla: (typeof PANTALLAS_EVIDENCIA)[number]; query: string }>;
};

export function parseEvidencia(value: unknown): EvidenciaMiles {
  const raw = objeto(value, "evidencia");
  if (!Array.isArray(raw.consultas) || raw.consultas.length === 0 || raw.consultas.some((item) => typeof item !== "string" || item.length > 80)) {
    throw new MilesError(400, "evidencia.consultas tiene que listar las consultas usadas");
  }
  const filtros = objeto(raw.filtros ?? {}, "evidencia.filtros");
  const enlaces: EvidenciaMiles["enlaces"] = [];
  if (raw.enlaces != null) {
    if (!Array.isArray(raw.enlaces) || raw.enlaces.length > 8) {
      throw new MilesError(400, "evidencia.enlaces no es válido");
    }
    for (const enlace of raw.enlaces) {
      const item = objeto(enlace, "enlace");
      const pantalla = item.pantalla;
      if (typeof pantalla !== "string" || !PANTALLAS_EVIDENCIA.includes(pantalla as (typeof PANTALLAS_EVIDENCIA)[number])) {
        throw new MilesError(400, "El enlace de evidencia solo puede ir a Resumen, Productos, Horarios o Canasta");
      }
      const query = typeof item.query === "string" ? item.query : "";
      if (query.length > 500 || query.includes("://") || query.includes("javascript:") || query.startsWith("/")) {
        throw new MilesError(400, "La query de evidencia solo puede llevar filtros del dashboard");
      }
      enlaces.push({ pantalla: pantalla as EvidenciaMiles["enlaces"][number]["pantalla"], query });
    }
  }
  return { consultas: raw.consultas.map(String), filtros, enlaces };
}

export function hrefEvidencia(pantalla: EvidenciaMiles["enlaces"][number]["pantalla"], query: string): string {
  const base =
    pantalla === "resumen"
      ? "/admin/consumo"
      : pantalla === "productos"
        ? "/admin/consumo/productos"
        : pantalla === "horarios"
          ? "/admin/consumo/horarios"
          : "/admin/consumo/canasta";
  return query ? `${base}?${query}` : base;
}

export type HallazgoInput = {
  idempotencyKey: string;
  ejecucionId: string | null;
  patronClave: string | null;
  tipo: (typeof MILES_TIPOS)[number];
  titulo: string;
  resumen: string;
  observacion: string;
  interpretacion: string | null;
  recomendacion: string | null;
  prioridad: (typeof MILES_PRIORIDADES)[number];
  prioridadJustificacion: string;
  tienda: string;
  alcance: Record<string, unknown>;
  periodoDesde: string;
  periodoHasta: string;
  comparacionDesde: string | null;
  comparacionHasta: string | null;
  comparacionModo: string | null;
  metricas: Record<string, unknown>;
  muestras: Record<string, unknown>;
  limitaciones: string | null;
  evidencia: EvidenciaMiles;
  corte: string | null;
  visual: VisualMiles | null;
};

export function parseHallazgo(body: unknown): HallazgoInput {
  const raw = objeto(body, "cuerpo");
  rechazarSuplantacion(raw);
  const tipo = raw.tipo;
  if (typeof tipo !== "string" || !MILES_TIPOS.includes(tipo as (typeof MILES_TIPOS)[number])) {
    throw new MilesError(400, "tipo no es válido");
  }
  const prioridad = raw.prioridad;
  if (typeof prioridad !== "string" || !MILES_PRIORIDADES.includes(prioridad as (typeof MILES_PRIORIDADES)[number])) {
    throw new MilesError(400, "prioridad no es válida");
  }
  const periodo = objeto(raw.periodo, "periodo");
  const comparacion = raw.comparacion == null ? null : objeto(raw.comparacion, "comparacion");
  const tienda = raw.tienda == null ? MILES_TIENDA : texto(raw.tienda, "tienda", 40);
  if (tienda !== MILES_TIENDA) {
    throw new MilesError(403, "Miles no tiene esa tienda");
  }
  const visual = leerVisual(raw.visual);
  if (visual.error) throw new MilesError(400, visual.error);
  const periodoDesde = fecha(periodo.desde, "periodo.desde");
  const periodoHasta = fecha(periodo.hasta, "periodo.hasta");
  if (periodoDesde > periodoHasta) {
    throw new MilesError(400, "El periodo está invertido");
  }
  return {
    idempotencyKey: texto(raw.idempotencyKey, "idempotencyKey", 120),
    ejecucionId: opcional(raw.ejecucionId, "ejecucionId", 80),
    patronClave: opcional(raw.patronClave, "patronClave", 120),
    tipo: tipo as HallazgoInput["tipo"],
    titulo: texto(raw.titulo, "titulo", 160),
    resumen: texto(raw.resumen, "resumen", 400),
    observacion: texto(raw.observacion, "observacion", 2000),
    interpretacion: opcional(raw.interpretacion, "interpretacion", 2000),
    recomendacion: opcional(raw.recomendacion, "recomendacion", 2000),
    prioridad: prioridad as HallazgoInput["prioridad"],
    prioridadJustificacion: texto(raw.prioridadJustificacion, "prioridadJustificacion", 500),
    tienda,
    alcance: raw.alcance == null ? {} : objeto(raw.alcance, "alcance"),
    periodoDesde,
    periodoHasta,
    comparacionDesde: comparacion ? fecha(comparacion.desde, "comparacion.desde") : null,
    comparacionHasta: comparacion ? fecha(comparacion.hasta, "comparacion.hasta") : null,
    comparacionModo: comparacion ? opcional(comparacion.modo, "comparacion.modo", 40) : null,
    metricas: objeto(raw.metricas, "metricas"),
    muestras: raw.muestras == null ? {} : objeto(raw.muestras, "muestras"),
    limitaciones: opcional(raw.limitaciones, "limitaciones", 2000),
    evidencia: parseEvidencia(raw.evidencia),
    corte: opcional(raw.corte, "corte", 120),
    visual: visual.visual,
  };
}

export function parseRun(body: unknown): { idempotencyKey: string; datosHasta: string | null; corte: string | null } {
  const raw = objeto(body, "cuerpo");
  rechazarSuplantacion(raw);
  return {
    idempotencyKey: texto(raw.idempotencyKey, "idempotencyKey", 120),
    datosHasta: raw.datosHasta == null ? null : fecha(raw.datosHasta, "datosHasta"),
    corte: opcional(raw.corte, "corte", 120),
  };
}

export function parseCierreRun(body: unknown): { version: number; estado: "completada" | "fallida"; error: string | null; datosHasta: string | null; corte: string | null } {
  const raw = objeto(body, "cuerpo");
  rechazarSuplantacion(raw);
  const version = raw.version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    throw new MilesError(400, "version es obligatoria");
  }
  if (raw.estado !== "completada" && raw.estado !== "fallida") {
    throw new MilesError(400, "estado tiene que ser completada o fallida");
  }
  return {
    version,
    estado: raw.estado,
    error: opcional(raw.error, "error", 500),
    datosHasta: raw.datosHasta == null ? null : fecha(raw.datosHasta, "datosHasta"),
    corte: opcional(raw.corte, "corte", 120),
  };
}

export function parseAvanceInvestigacion(body: unknown): { version: number; estado: (typeof MILES_ESTADOS_MILES_INVESTIGACION)[number]; respuesta: string | null } {
  const raw = objeto(body, "cuerpo");
  rechazarSuplantacion(raw);
  const version = raw.version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    throw new MilesError(400, "version es obligatoria");
  }
  const estado = raw.estado;
  if (typeof estado !== "string" || !MILES_ESTADOS_MILES_INVESTIGACION.includes(estado as (typeof MILES_ESTADOS_MILES_INVESTIGACION)[number])) {
    throw new MilesError(400, "Miles solo puede marcar en análisis, requiere información o completada");
  }
  return {
    version,
    estado: estado as (typeof MILES_ESTADOS_MILES_INVESTIGACION)[number],
    respuesta: opcional(raw.respuesta, "respuesta", 4000),
  };
}

export function parseEvaluacion(body: unknown): {
  idempotencyKey: string;
  observacion: string;
  atribucion: string | null;
  metricas: Record<string, unknown>;
  limitaciones: string | null;
  ejecucionId: string | null;
} {
  const raw = objeto(body, "cuerpo");
  rechazarSuplantacion(raw);
  if ("estado" in raw || "decision" in raw) {
    throw new MilesError(403, "Una evaluación no cambia el estado ni la decisión de la prueba");
  }
  return {
    idempotencyKey: texto(raw.idempotencyKey, "idempotencyKey", 120),
    observacion: texto(raw.observacion, "observacion", 4000),
    atribucion: opcional(raw.atribucion, "atribucion", 2000),
    metricas: raw.metricas == null ? {} : objeto(raw.metricas, "metricas"),
    limitaciones: opcional(raw.limitaciones, "limitaciones", 2000),
    ejecucionId: opcional(raw.ejecucionId, "ejecucionId", 80),
  };
}

export const TRANSICIONES_PRUEBA: Record<string, string[]> = {
  propuesta: ["aprobada", "cancelada"],
  aprobada: ["en_curso", "cancelada"],
  en_curso: ["pendiente_evaluacion", "cancelada"],
  pendiente_evaluacion: ["finalizada", "cancelada"],
  finalizada: [],
  cancelada: [],
};

export function puedeTransicionarPrueba(desde: string, hacia: string): boolean {
  return (TRANSICIONES_PRUEBA[desde] ?? []).includes(hacia);
}

export function mismoContenido(hashGuardado: string, hashNuevo: string): boolean {
  return hashGuardado === hashNuevo;
}
