import { isDayKey } from "@/lib/local-day";
import { MilesError, hashPayload } from "@/lib/miles-domain";

export type InformeInput = {
  idempotencyKey: string;
  fecha: string;
  ejecucionId: string | null;
  estado: "publicado" | "parcial";
  conclusion: string;
  novedades: string | null;
  actualizaciones: string | null;
  bloqueos: string | null;
  datosHasta: string | null;
  casos: string[];
  trabajo: { areas: string[]; revalidados: string[]; pruebas: string[]; bloqueos: string[] };
};

export type AsociacionInput = {
  idempotencyKey: string;
  ejecucionId: string | null;
  codigoA: string;
  codigoB: string;
  nombreA: string | null;
  nombreB: string | null;
  periodoDesde: string;
  periodoHasta: string;
  n: number | null;
  nA: number | null;
  nB: number | null;
  nAB: number | null;
  observacion: string | null;
  cambio: string | null;
  solidez: string | null;
  limitaciones: string | null;
  oportunidad: string | null;
  proximoPaso: string | null;
  estado: "vigente" | "historica" | "insuficiente";
};

export type TareaInput = {
  area: string;
  estado: "ejecutada" | "sin_novedades" | "publicada" | "limitada" | "fallida" | "no_ejecutada";
  iniciadaEn: string | null;
  terminadaEn: string | null;
  datosRevisados: string | null;
  entregable: string | null;
  error: string | null;
  proximoPaso: string | null;
};

const AREAS = ["datos", "ventas", "productos", "horarios", "complementarios", "rentabilidad", "seguimiento", "informe"] as const;
const ESTADOS_TAREA = ["ejecutada", "sin_novedades", "publicada", "limitada", "fallida", "no_ejecutada"] as const;

function cuerpo(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new MilesError(400, "cuerpo tiene que ser un objeto");
  return body as Record<string, unknown>;
}

function texto(value: unknown, campo: string, max: number): string {
  if (typeof value !== "string" || value.trim() === "") throw new MilesError(400, `${campo} es obligatorio`);
  if (value.trim().length > max) throw new MilesError(400, `${campo} supera ${max} caracteres`);
  return value.trim();
}

function opcional(value: unknown, campo: string, max: number): string | null {
  if (value == null || value === "") return null;
  return texto(value, campo, max);
}

function fecha(value: unknown, campo: string): string {
  if (typeof value !== "string" || !isDayKey(value)) throw new MilesError(400, `${campo} tiene que ser YYYY-MM-DD`);
  return value;
}

function entero(value: unknown, campo: string): number | null {
  if (value == null || value === "") return null;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) throw new MilesError(400, `${campo} tiene que ser un entero`);
  return value;
}

export function parseInforme(body: unknown): InformeInput {
  const raw = cuerpo(body);
  if ("agent_id" in raw || "agentId" in raw || "autor" in raw) throw new MilesError(400, "Miles no acepta el campo autor");
  const estado = raw.estado == null ? "publicado" : raw.estado;
  if (estado !== "publicado" && estado !== "parcial") throw new MilesError(400, "estado del informe tiene que ser publicado o parcial");
  const casos = Array.isArray(raw.casos) ? raw.casos : [];
  if (casos.length > 30 || casos.some((item) => typeof item !== "string" || item.length > 80)) {
    throw new MilesError(400, "casos tiene que listar identificadores de hallazgos");
  }
  const trabajoRaw = raw.trabajo == null ? {} : cuerpo(raw.trabajo);
  const lista = (value: unknown, campo: string) => {
    if (value == null) return [];
    if (!Array.isArray(value) || value.length > 20 || value.some((item) => typeof item !== "string" || item.length > 160)) {
      throw new MilesError(400, `${campo} no es válido`);
    }
    return value.map(String);
  };
  const fechaInforme = fecha(raw.fecha, "fecha");
  const datosHasta = raw.datosHasta == null ? null : fecha(raw.datosHasta, "datosHasta");
  return {
    idempotencyKey: texto(raw.idempotencyKey, "idempotencyKey", 120),
    fecha: fechaInforme,
    ejecucionId: opcional(raw.ejecucionId, "ejecucionId", 80),
    estado,
    conclusion: texto(raw.conclusion, "conclusion", 500),
    novedades: opcional(raw.novedades, "novedades", 800),
    actualizaciones: opcional(raw.actualizaciones, "actualizaciones", 800),
    bloqueos: opcional(raw.bloqueos, "bloqueos", 800),
    datosHasta,
    casos: Array.from(new Set(casos.map(String))),
    trabajo: {
      areas: lista(trabajoRaw.areas, "trabajo.areas"),
      revalidados: lista(trabajoRaw.revalidados, "trabajo.revalidados"),
      pruebas: lista(trabajoRaw.pruebas, "trabajo.pruebas"),
      bloqueos: lista(trabajoRaw.bloqueos, "trabajo.bloqueos"),
    },
  };
}

export function parseAsociacion(body: unknown): AsociacionInput {
  const raw = cuerpo(body);
  if ("agent_id" in raw || "autor" in raw) throw new MilesError(400, "Miles no acepta el campo autor");
  const codigoA = texto(raw.codigoA, "codigoA", 80);
  const codigoB = texto(raw.codigoB, "codigoB", 80);
  if (codigoA === codigoB) throw new MilesError(400, "Una asociación necesita dos productos distintos");
  const [primero, segundo] = codigoA < codigoB ? [codigoA, codigoB] : [codigoB, codigoA];
  const [nombrePrimero, nombreSegundo] = codigoA < codigoB ? [raw.nombreA, raw.nombreB] : [raw.nombreB, raw.nombreA];
  const desde = fecha(raw.periodoDesde ?? (raw.periodo as { desde?: unknown } | undefined)?.desde, "periodoDesde");
  const hasta = fecha(raw.periodoHasta ?? (raw.periodo as { hasta?: unknown } | undefined)?.hasta, "periodoHasta");
  if (desde > hasta) throw new MilesError(400, "El periodo está invertido");
  const estado = raw.estado == null ? "vigente" : raw.estado;
  if (estado !== "vigente" && estado !== "historica" && estado !== "insuficiente") throw new MilesError(400, "estado de la asociación no es válido");
  const n = entero(raw.n, "n");
  const nA = entero(raw.nA, "nA");
  const nB = entero(raw.nB, "nB");
  const nAB = entero(raw.nAB, "nAB");
  if (n != null && nA != null && nB != null && nAB != null && (nAB > nA || nAB > nB || nA > n || nB > n)) {
    throw new MilesError(400, "Los conteos de la asociación no cuadran");
  }
  return {
    idempotencyKey: texto(raw.idempotencyKey, "idempotencyKey", 120),
    ejecucionId: opcional(raw.ejecucionId, "ejecucionId", 80),
    codigoA: primero,
    codigoB: segundo,
    nombreA: opcional(nombrePrimero, "nombreA", 160),
    nombreB: opcional(nombreSegundo, "nombreB", 160),
    periodoDesde: desde,
    periodoHasta: hasta,
    n,
    nA,
    nB,
    nAB,
    observacion: opcional(raw.observacion, "observacion", 800),
    cambio: opcional(raw.cambio, "cambio", 800),
    solidez: opcional(raw.solidez, "solidez", 40),
    limitaciones: opcional(raw.limitaciones, "limitaciones", 800),
    oportunidad: opcional(raw.oportunidad, "oportunidad", 800),
    proximoPaso: opcional(raw.proximoPaso, "proximoPaso", 500),
    estado,
  };
}

export function parseTareas(body: unknown): TareaInput[] {
  const raw = cuerpo(body);
  if (!Array.isArray(raw.tareas) || raw.tareas.length === 0 || raw.tareas.length > 12) {
    throw new MilesError(400, "tareas tiene que listar las áreas revisadas");
  }
  const vistas = new Set<string>();
  return raw.tareas.map((item) => {
    const tarea = cuerpo(item);
    if (typeof tarea.area !== "string" || !AREAS.includes(tarea.area as (typeof AREAS)[number])) {
      throw new MilesError(400, `area no es válida. Válidas: ${AREAS.join(", ")}`);
    }
    if (vistas.has(tarea.area)) throw new MilesError(400, `area ${tarea.area} está repetida`);
    vistas.add(tarea.area);
    if (typeof tarea.estado !== "string" || !ESTADOS_TAREA.includes(tarea.estado as (typeof ESTADOS_TAREA)[number])) {
      throw new MilesError(400, "estado de la tarea no es válido");
    }
    return {
      area: tarea.area,
      estado: tarea.estado as TareaInput["estado"],
      iniciadaEn: instante(tarea.iniciadaEn, "iniciadaEn"),
      terminadaEn: instante(tarea.terminadaEn, "terminadaEn"),
      datosRevisados: opcional(tarea.datosRevisados, "datosRevisados", 400),
      entregable: opcional(tarea.entregable, "entregable", 200),
      error: opcional(tarea.error, "error", 400),
      proximoPaso: opcional(tarea.proximoPaso, "proximoPaso", 400),
    };
  });
}

function instante(value: unknown, campo: string): string | null {
  const textoFecha = opcional(value, campo, 40);
  if (textoFecha == null) return null;
  if (Number.isNaN(Date.parse(textoFecha))) throw new MilesError(400, `${campo} tiene que ser una fecha`);
  return textoFecha;
}

export function hashInforme(input: InformeInput): string {
  return hashPayload(input);
}

export function hashAsociacion(input: AsociacionInput): string {
  return hashPayload(input);
}
