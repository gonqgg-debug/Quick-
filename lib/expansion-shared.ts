import { isDayKey, todayDayKey } from "@/lib/local-day";

export const EXPANSION_ETAPAS = [
  { id: "contacto", label: "Contacto", orden: 1 },
  { id: "visita", label: "Visita", orden: 2 },
  { id: "propuesta", label: "Propuesta", orden: 3 },
  { id: "negociacion", label: "Negociación", orden: 4 },
  { id: "acuerdo", label: "Acuerdo", orden: 5 },
  { id: "apertura", label: "Apertura", orden: 6 },
  { id: "descartado", label: "Descartado", orden: 7 },
] as const;

export const EXPANSION_TRATOS = [
  { id: "alquiler", label: "Alquiler" },
  { id: "compra", label: "Compra" },
  { id: "alianza", label: "Alianza" },
] as const;

export const EXPANSION_TIPOS_CONTACTO = [
  { id: "broker", label: "Broker" },
  { id: "desarrollador", label: "Desarrollador" },
  { id: "administracion", label: "Administración" },
  { id: "propietario", label: "Propietario" },
  { id: "otro", label: "Otro" },
] as const;

export const EXPANSION_TIPOS_ACTIVIDAD = [
  { id: "nota", label: "Nota" },
  { id: "llamada", label: "Llamada" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "visita", label: "Visita" },
  { id: "propuesta", label: "Propuesta" },
] as const;

export const EXPANSION_META_IDS = ["conversaciones", "negociacion", "aperturas"] as const;

export type ExpansionEtapa = (typeof EXPANSION_ETAPAS)[number]["id"];
export type ExpansionTrato = (typeof EXPANSION_TRATOS)[number]["id"];
export type ExpansionTipoContacto = (typeof EXPANSION_TIPOS_CONTACTO)[number]["id"];
export type ExpansionTipoActividad = (typeof EXPANSION_TIPOS_ACTIVIDAD)[number]["id"];
export type ExpansionMetaId = (typeof EXPANSION_META_IDS)[number];

export type ExpansionContacto = {
  id: string;
  clave: string | null;
  nombre: string;
  empresa: string | null;
  telefono: string | null;
  email: string | null;
  tipo: ExpansionTipoContacto;
  tipoLabel: string;
  notas: string | null;
};

export type ExpansionActividad = {
  id: string;
  sitioId: string;
  contactoId: string | null;
  tipo: ExpansionTipoActividad;
  tipoLabel: string;
  texto: string;
  fecha: string;
};

export type ExpansionSitio = {
  id: string;
  clave: string | null;
  nombre: string;
  zona: string | null;
  trato: ExpansionTrato;
  tratoLabel: string;
  etapa: ExpansionEtapa;
  etapaLabel: string;
  etapaDesde: string;
  detalle: string | null;
  proximaAccion: string | null;
  proximaFecha: string | null;
  seguimientoVencido: boolean;
  contacto: ExpansionContacto | null;
};

export type ExpansionMeta = {
  id: ExpansionMetaId;
  etiqueta: string;
  ayuda: string;
  meta: number;
  actual: number;
  diferencia: number | null;
};

export type ExpansionPipeline = {
  etapas: Array<{ id: ExpansionEtapa; label: string; orden: number; sitios: number }>;
  metas: ExpansionMeta[];
  seguimientosVencidos: number;
  activos: number;
};

export const EXPANSION_AGENT_USO =
  "Crea el contacto, luego el sitio con contactoClave. Para mover el pipeline, POST una actividad con etapa y proximaAccion, o PATCH el sitio. Repetir un POST con la misma clave devuelve el registro que ya existe (creado: false) y no lo sobrescribe.";

export const EXPANSION_AGENT_ENDPOINTS = [
  {
    method: "GET",
    path: "/api/agent/expansion",
    describe: "Vocabulario del CRM y el resumen del pipeline: etapas, metas y seguimientos vencidos.",
  },
  { method: "GET", path: "/api/agent/expansion/contactos?q=", describe: "Directorio de brokers, desarrolladores y otros contactos." },
  {
    method: "POST",
    path: "/api/agent/expansion/contactos",
    describe:
      "Crea un contacto. clave es opcional y única. Si la clave ya existe, responde 200 con creado: false y no pisa el registro.",
  },
  { method: "GET", path: "/api/agent/expansion/contactos/{id-o-clave}", describe: "Un contacto por uuid o por clave." },
  { method: "PATCH", path: "/api/agent/expansion/contactos/{id-o-clave}", describe: "Actualiza solo los campos que envíes." },
  {
    method: "GET",
    path: "/api/agent/expansion/sitios?etapa=&q=&vencidos=true&clave=",
    describe: "Sitios del pipeline. vencidos=true deja solo seguimientos atrasados.",
  },
  {
    method: "POST",
    path: "/api/agent/expansion/sitios",
    describe: "Crea un sitio. Enlaza el contacto con contactoClave o contactoId. Misma regla de clave que los contactos.",
  },
  { method: "GET", path: "/api/agent/expansion/sitios/{id-o-clave}", describe: "El sitio y su historial de actividades." },
  {
    method: "PATCH",
    path: "/api/agent/expansion/sitios/{id-o-clave}",
    describe: "Cambia etapa, trato, próximo paso, contacto o datos del sitio. Cambiar etapa reinicia etapaDesde a hoy.",
  },
  {
    method: "GET",
    path: "/api/agent/expansion/sitios/{id-o-clave}/actividades",
    describe: "Historial del sitio, de la más reciente a la más antigua.",
  },
  {
    method: "POST",
    path: "/api/agent/expansion/sitios/{id-o-clave}/actividades",
    describe:
      "Anota una llamada, WhatsApp, visita, propuesta o nota. Si mandas etapa, proximaAccion o proximaFecha, también mueve el sitio. Repetir el mismo tipo, texto y fecha no duplica la nota y responde creado: false.",
  },
  {
    method: "GET",
    path: "/api/agent/expansion/metas",
    describe: "Las tres metas y cuánto hay ahora. diferencia es null cuando la meta es 0.",
  },
  {
    method: "PATCH",
    path: "/api/agent/expansion/metas",
    describe: "Ajusta conversaciones, negociacion y aperturas. Cada valor es un entero de 0 a 10000. 0 significa sin meta.",
  },
] as const;

const META_HELP: Record<ExpansionMetaId, { etiqueta: string; ayuda: string }> = {
  conversaciones: {
    etiqueta: "Conversaciones activas",
    ayuda: "Sitios que siguen en conversación: no están descartados ni en apertura.",
  },
  negociacion: {
    etiqueta: "En negociación",
    ayuda: "Sitios en la etapa Negociación.",
  },
  aperturas: {
    etiqueta: "Aperturas",
    ayuda: "Sitios que ya llegaron a Apertura.",
  },
};

export function expansionMetaCopy(id: ExpansionMetaId): { etiqueta: string; ayuda: string } {
  return META_HELP[id];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

export function labelOf<T extends { id: string; label: string }>(list: readonly T[], id: string): string {
  return list.find((item) => item.id === id)?.label ?? id;
}

export function parseClave(value: unknown): { ok: true; clave: string | null } | { ok: false; message: string } {
  if (value == null || value === "") {
    return { ok: true, clave: null };
  }
  if (typeof value !== "string") {
    return { ok: false, message: "La clave tiene que ser texto" };
  }
  const clave = value.trim();
  if (!clave) {
    return { ok: true, clave: null };
  }
  if (clave.length > 80 || !/^[A-Za-z0-9_.:-]+$/.test(clave)) {
    return { ok: false, message: "La clave solo puede tener letras, números, punto, guión y guión bajo" };
  }
  return { ok: true, clave };
}

export function parseEtapa(value: unknown): ExpansionEtapa | null {
  const id = typeof value === "string" ? value.trim() : "";
  return EXPANSION_ETAPAS.some((item) => item.id === id) ? (id as ExpansionEtapa) : null;
}

export function parseTrato(value: unknown): ExpansionTrato | null {
  const id = typeof value === "string" ? value.trim() : "";
  return EXPANSION_TRATOS.some((item) => item.id === id) ? (id as ExpansionTrato) : null;
}

export function parseTipoContacto(value: unknown): ExpansionTipoContacto | null {
  const id = typeof value === "string" ? value.trim() : "";
  return EXPANSION_TIPOS_CONTACTO.some((item) => item.id === id) ? (id as ExpansionTipoContacto) : null;
}

export function parseTipoActividad(value: unknown): ExpansionTipoActividad | null {
  const id = typeof value === "string" ? value.trim() : "";
  return EXPANSION_TIPOS_ACTIVIDAD.some((item) => item.id === id) ? (id as ExpansionTipoActividad) : null;
}

export function seguimientoVencido(sitio: Pick<ExpansionSitio, "etapa" | "proximaFecha">, today = todayDayKey()): boolean {
  if (!sitio.proximaFecha || !isDayKey(sitio.proximaFecha) || !isDayKey(today)) {
    return false;
  }
  if (sitio.etapa === "apertura" || sitio.etapa === "descartado") {
    return false;
  }
  return sitio.proximaFecha < today;
}

export function buildExpansionPipeline(
  sitios: Array<Pick<ExpansionSitio, "etapa" | "proximaFecha">>,
  metas: Array<{ id: ExpansionMetaId; meta: number }>,
  today = todayDayKey()
): ExpansionPipeline {
  const etapas = EXPANSION_ETAPAS.map((etapa) => ({
    ...etapa,
    sitios: sitios.filter((sitio) => sitio.etapa === etapa.id).length,
  }));
  const actual: Record<ExpansionMetaId, number> = {
    conversaciones: sitios.filter((sitio) => sitio.etapa !== "descartado" && sitio.etapa !== "apertura").length,
    negociacion: sitios.filter((sitio) => sitio.etapa === "negociacion").length,
    aperturas: sitios.filter((sitio) => sitio.etapa === "apertura").length,
  };
  return {
    etapas,
    metas: EXPANSION_META_IDS.map((id) => {
      const meta = metas.find((item) => item.id === id)?.meta ?? 0;
      const value = actual[id];
      return {
        id,
        etiqueta: expansionMetaCopy(id).etiqueta,
        ayuda: expansionMetaCopy(id).ayuda,
        meta,
        actual: value,
        diferencia: meta > 0 ? value - meta : null,
      };
    }),
    seguimientosVencidos: sitios.filter((sitio) => seguimientoVencido(sitio, today)).length,
    activos: actual.conversaciones,
  };
}
