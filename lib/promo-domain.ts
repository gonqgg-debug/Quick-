import { isDayKey } from "@/lib/local-day";
import { MilesError } from "@/lib/miles-domain";
import { leerVisual, type VisualMiles } from "@/lib/miles-presentacion";
import { TIPOS_PROMO, type TipoPromo } from "@/lib/promo-calculo";

export const ESTADOS_PROPUESTA = ["borrador", "por_revisar", "requiere_ampliacion", "lista_para_probar", "descartada", "archivada"] as const;
export const ESTADOS_MILES_PROPUESTA = ["borrador", "por_revisar", "bloqueada"] as const;
export const FUNCIONES_PRODUCTO = ["principal", "complemento", "beneficio"] as const;
export const SOLIDEZ = ["alta", "media", "baja"] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ProductoPropuestaInput = {
  productId: string | null;
  codigoOdoo: string | null;
  cantidad: number;
  funcion: (typeof FUNCIONES_PRODUCTO)[number];
  precioHabitual: number | null;
  precioPromo: number | null;
  precioObservadoEn: string | null;
  presentacion: string | null;
};

export type ProbabilidadPromo = {
  valor: number;
  objetivo: string;
  horizonte: string;
  modelo: string;
  version: string;
  datos: string;
  supuestos: string;
  validacion: string;
  evaluadaEn: string;
  limitaciones: string;
  intervalo: { inferior: number; superior: number; representa: string } | null;
};

export type PropuestaInput = {
  idempotencyKey: string;
  ejecucionId: string | null;
  investigacionId: string | null;
  tienda: string;
  nombre: string;
  objetivo: string;
  comportamiento: string;
  tipo: TipoPromo;
  estado: (typeof ESTADOS_MILES_PROPUESTA)[number];
  periodoDesde: string;
  periodoHasta: string;
  productos: ProductoPropuestaInput[];
  mecanica: Record<string, unknown>;
  hallazgos: string[];
  metricas: Record<string, unknown>;
  corte: string | null;
  evidencia: { solidez: (typeof SOLIDEZ)[number]; fundamento: string; consultas: string[] };
  limitaciones: string | null;
  supuestos: Record<string, unknown>;
  escenarios: unknown[];
  costos: Record<string, unknown> | null;
  modelo: Record<string, unknown> | null;
  probabilidad: ProbabilidadPromo | null;
  visual: VisualMiles | null;
};

export function parseCorreccionPropuesta(body: unknown): { version: number; patch: Record<string, unknown> } {
  const raw = objeto(body);
  rechazarEjecutable(raw);
  const permitidos = ["version", "nombre", "objetivo", "comportamiento", "limitaciones", "mecanica", "metricas", "supuestos", "escenarios", "costos", "modelo", "probabilidad", "evidencia", "visual", "estado", "corte"];
  for (const key of Object.keys(raw)) {
    if (["agent_id", "agentId", "autor", "decision", "descarte", "descarteMotivo", "descarte_motivo"].includes(key)) {
      throw new MilesError(400, `Miles no acepta el campo ${key}`);
    }
    if (!permitidos.includes(key)) throw new MilesError(400, `Miles no puede cambiar ${key}`);
  }
  if (typeof raw.version !== "number") throw new MilesError(400, "version es obligatoria");
  const patch: Record<string, unknown> = {};
  if (raw.estado != null) {
    if (typeof raw.estado !== "string" || !ESTADOS_MILES_PROPUESTA.includes(raw.estado as (typeof ESTADOS_MILES_PROPUESTA)[number])) {
      throw new MilesError(403, "Miles no aprueba, no descarta y no marca una propuesta como lista para probar");
    }
    patch.estado = raw.estado;
  }
  if (raw.nombre != null) patch.nombre = texto(raw.nombre, 140);
  if (raw.objetivo != null) patch.objetivo = texto(raw.objetivo, 300);
  if (raw.comportamiento != null) patch.comportamiento = texto(raw.comportamiento, 400);
  if (raw.limitaciones != null) patch.limitaciones = raw.limitaciones === "" ? null : texto(raw.limitaciones, 2000);
  if (raw.corte != null) patch.corte = raw.corte === "" ? null : fecha(raw.corte);
  if (raw.mecanica != null) patch.mecanica = objeto(raw.mecanica);
  if (raw.metricas != null) patch.metricas = objeto(raw.metricas);
  if (raw.supuestos != null) patch.supuestos = objeto(raw.supuestos);
  if (raw.escenarios != null) {
    if (!Array.isArray(raw.escenarios) || raw.escenarios.length > 6) throw new MilesError(400, "escenarios no es válido");
    patch.escenarios = raw.escenarios;
  }
  if (raw.costos != null) patch.costos = objeto(raw.costos);
  if (raw.modelo != null) patch.modelo = objeto(raw.modelo);
  if ("probabilidad" in raw) patch.probabilidad = leerProbabilidad(raw.probabilidad);
  if (raw.evidencia != null) {
    const evidencia = objeto(raw.evidencia);
    const solidez = evidencia.solidez;
    if (typeof solidez !== "string" || !SOLIDEZ.includes(solidez as (typeof SOLIDEZ)[number])) {
      throw new MilesError(400, "evidencia.solidez tiene que ser alta, media o baja");
    }
    patch.evidencia = {
      solidez,
      fundamento: texto(evidencia.fundamento, 500),
      consultas: Array.isArray(evidencia.consultas) ? evidencia.consultas.filter((item) => typeof item === "string").slice(0, 12).map(String) : [],
    };
  }
  if ("visual" in raw) {
    const visual = leerVisual(raw.visual);
    if (visual.error) throw new MilesError(400, visual.error);
    patch.visual = visual.visual;
  }
  if (Object.keys(patch).length === 0) throw new MilesError(400, "Nada que actualizar");
  return { version: raw.version, patch };
}

export function parsePropuesta(body: unknown): PropuestaInput {
  const raw = objeto(body);
  rechazarEjecutable(raw);
  for (const key of Object.keys(raw)) {
    if (["agent_id", "agentId", "autor", "decision", "descarte", "descarteMotivo"].includes(key)) {
      throw new MilesError(400, `Miles no acepta el campo ${key}`);
    }
  }
  const periodo = objeto(raw.periodo);
  const evidencia = objeto(raw.evidencia);
  const solidez = evidencia.solidez;
  if (typeof solidez !== "string" || !SOLIDEZ.includes(solidez as (typeof SOLIDEZ)[number])) {
    throw new MilesError(400, "evidencia.solidez tiene que ser alta, media o baja");
  }
  const tipo = raw.tipo;
  if (typeof tipo !== "string" || !TIPOS_PROMO.includes(tipo as TipoPromo)) {
    throw new MilesError(400, "tipo de promoción no es válido");
  }
  const estado = raw.estado == null ? "por_revisar" : raw.estado;
  if (typeof estado !== "string" || !ESTADOS_MILES_PROPUESTA.includes(estado as (typeof ESTADOS_MILES_PROPUESTA)[number])) {
    throw new MilesError(403, "Miles no aprueba, no descarta y no marca una propuesta como lista para probar");
  }
  const tienda = raw.tienda == null ? "quick" : texto(raw.tienda, 40);
  if (tienda !== "quick") throw new MilesError(403, "Miles no tiene esa tienda");
  const desde = fecha(periodo.desde);
  const hasta = fecha(periodo.hasta);
  if (desde > hasta) throw new MilesError(400, "El periodo está invertido");
  const productos = leerProductos(raw.productos);
  const hallazgos = leerIds(raw.hallazgos, "hallazgos", 20);
  const probabilidad = leerProbabilidad(raw.probabilidad);
  const visual = leerVisual(raw.visual);
  if (visual.error) throw new MilesError(400, visual.error);
  return {
    idempotencyKey: texto(raw.idempotencyKey, 120),
    ejecucionId: raw.ejecucionId == null ? null : uuid(raw.ejecucionId, "ejecucionId"),
    investigacionId: raw.investigacionId == null ? null : uuid(raw.investigacionId, "investigacionId"),
    tienda,
    nombre: texto(raw.nombre, 140),
    objetivo: texto(raw.objetivo, 300),
    comportamiento: texto(raw.comportamiento, 400),
    tipo: tipo as TipoPromo,
    estado: estado as PropuestaInput["estado"],
    periodoDesde: desde,
    periodoHasta: hasta,
    productos,
    mecanica: objeto(raw.mecanica ?? {}),
    hallazgos,
    metricas: objeto(raw.metricas ?? {}),
    corte: raw.corte == null || raw.corte === "" ? null : fecha(raw.corte),
    evidencia: {
      solidez: solidez as PropuestaInput["evidencia"]["solidez"],
      fundamento: texto(evidencia.fundamento, 500),
      consultas: Array.isArray(evidencia.consultas) ? evidencia.consultas.filter((item) => typeof item === "string").slice(0, 12).map(String) : [],
    },
    limitaciones: raw.limitaciones == null || raw.limitaciones === "" ? null : texto(raw.limitaciones, 2000),
    supuestos: objeto(raw.supuestos ?? {}),
    escenarios: Array.isArray(raw.escenarios) ? raw.escenarios.slice(0, 6) : [],
    costos: raw.costos == null ? null : objeto(raw.costos),
    modelo: raw.modelo == null ? null : objeto(raw.modelo),
    probabilidad,
    visual: visual.visual,
  };
}

export function leerProbabilidad(value: unknown): ProbabilidadPromo | null {
  if (value == null) return null;
  const raw = objeto(value);
  const campos = ["objetivo", "horizonte", "modelo", "version", "datos", "supuestos", "validacion", "limitaciones"] as const;
  for (const campo of campos) {
    if (typeof raw[campo] !== "string" || raw[campo].trim() === "") {
      throw new MilesError(400, "Una probabilidad exige objetivo, horizonte, modelo, versión, datos, supuestos, validación fuera de muestra y limitaciones");
    }
  }
  if (typeof raw.evaluadaEn !== "string" || !isDayKey(raw.evaluadaEn)) {
    throw new MilesError(400, "La probabilidad necesita la fecha de evaluación");
  }
  if (typeof raw.valor !== "number" || raw.valor < 0 || raw.valor > 1) {
    throw new MilesError(400, "La probabilidad va de 0 a 1");
  }
  let intervalo: ProbabilidadPromo["intervalo"] = null;
  if (raw.intervalo != null) {
    const rango = objeto(raw.intervalo);
    if (typeof rango.inferior !== "number" || typeof rango.superior !== "number" || typeof rango.representa !== "string" || rango.representa.trim() === "") {
      throw new MilesError(400, "Un intervalo tiene que decir qué representa");
    }
    intervalo = { inferior: rango.inferior, superior: rango.superior, representa: rango.representa.trim().slice(0, 160) };
  }
  return {
    valor: raw.valor,
    objetivo: String(raw.objetivo).trim(),
    horizonte: String(raw.horizonte).trim(),
    modelo: String(raw.modelo).trim(),
    version: String(raw.version).trim(),
    datos: String(raw.datos).trim(),
    supuestos: String(raw.supuestos).trim(),
    validacion: String(raw.validacion).trim(),
    evaluadaEn: raw.evaluadaEn,
    limitaciones: String(raw.limitaciones).trim(),
    intervalo,
  };
}

function leerProductos(value: unknown): ProductoPropuestaInput[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 12) {
    throw new MilesError(400, "La propuesta necesita entre 1 y 12 productos");
  }
  return value.map((item) => {
    const raw = objeto(item);
    const cantidad = raw.cantidad;
    if (typeof cantidad !== "number" || !Number.isFinite(cantidad) || cantidad <= 0) {
      throw new MilesError(400, "La cantidad del producto tiene que ser mayor que cero");
    }
    const funcion = raw.funcion;
    if (typeof funcion !== "string" || !FUNCIONES_PRODUCTO.includes(funcion as (typeof FUNCIONES_PRODUCTO)[number])) {
      throw new MilesError(400, "La función del producto tiene que ser principal, complemento o beneficio");
    }
    const productId = raw.productId == null || raw.productId === "" ? null : uuid(raw.productId, "productId");
    const codigo = raw.codigoOdoo == null || raw.codigoOdoo === "" ? null : texto(raw.codigoOdoo, 80);
    if (!productId && !codigo) throw new MilesError(400, "Cada producto necesita productId o codigoOdoo");
    return {
      productId,
      codigoOdoo: codigo,
      cantidad,
      funcion: funcion as ProductoPropuestaInput["funcion"],
      precioHabitual: numeroOpcional(raw.precioHabitual),
      precioPromo: numeroOpcional(raw.precioPromo),
      precioObservadoEn: raw.precioObservadoEn == null || raw.precioObservadoEn === "" ? null : fecha(raw.precioObservadoEn),
      presentacion: raw.presentacion == null || raw.presentacion === "" ? null : texto(raw.presentacion, 40),
    };
  });
}

function leerIds(value: unknown, campo: string, max: number): string[] {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > max) throw new MilesError(400, `${campo} no es válido`);
  return value.map((item) => uuid(item, campo));
}

function numeroOpcional(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new MilesError(400, "Un precio tiene que ser un número");
  }
  return value;
}

function objeto(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new MilesError(400, "El cuerpo tiene que ser un objeto");
  return value as Record<string, unknown>;
}

function texto(value: unknown, max: number): string {
  if (typeof value !== "string" || value.trim() === "" || value.trim().length > max) throw new MilesError(400, "Hay un texto vacío o demasiado largo");
  return value.trim();
}

function fecha(value: unknown): string {
  if (typeof value !== "string" || !isDayKey(value)) throw new MilesError(400, "La fecha tiene que ser YYYY-MM-DD");
  return value;
}

function uuid(value: unknown, campo: string): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new MilesError(400, `${campo} tiene que ser un id`);
  return value;
}

function rechazarEjecutable(value: unknown): void {
  if (typeof value === "string") {
    const textoPlano = value.toLowerCase();
    if (textoPlano.includes("<") || textoPlano.includes("javascript:") || textoPlano.includes("://")) {
      throw new MilesError(400, "La propuesta no acepta HTML ni código");
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach(rechazarEjecutable);
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (["html", "script", "style", "component", "javascript", "srcdoc"].includes(key.toLowerCase())) {
        throw new MilesError(400, "La propuesta no acepta HTML ni código");
      }
      rechazarEjecutable(item);
    }
  }
}
