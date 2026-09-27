import { isDayKey, todayDayKey } from "@/lib/local-day";

export const EXPANSION_ETAPAS = [
  { id: "identificado", label: "Identificado", orden: 1 },
  { id: "contacto_encontrado", label: "Contacto encontrado", orden: 2 },
  { id: "contactado", label: "Contactado", orden: 3 },
  { id: "presentacion_enviada", label: "Presentación enviada", orden: 4 },
  { id: "respondio", label: "Respondió", orden: 5 },
  { id: "conversacion", label: "Conversación activa", orden: 6 },
  { id: "oportunidad", label: "Oportunidad", orden: 7 },
  { id: "negociacion", label: "Escalamiento / negociación", orden: 8 },
  { id: "pausa", label: "En pausa", orden: 9 },
  { id: "descartado", label: "Descartado", orden: 10 },
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
  { id: "investigacion", label: "Investigación" },
  { id: "llamada", label: "Llamada" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "email", label: "Email" },
  { id: "visita", label: "Visita" },
  { id: "presentacion", label: "Presentación" },
] as const;

export const EXPANSION_FUENTES = [
  { id: "google", label: "Google" },
  { id: "maps", label: "Google Maps" },
  { id: "instagram", label: "Instagram" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "hunter", label: "Hunter" },
  { id: "website", label: "Website oficial" },
  { id: "portal", label: "Portal inmobiliario" },
  { id: "prensa", label: "Prensa" },
  { id: "gmail", label: "Gmail" },
  { id: "otro", label: "Otra" },
] as const;

export const EXPANSION_CARGOS_SUGERIDOS = [
  "Director Comercial",
  "Gerente Comercial",
  "Leasing Manager",
  "Commercial Manager",
  "Business Development",
  "Director de Desarrollo",
  "Project Director",
  "Director de Proyectos",
  "Propietario",
  "Socio",
  "Dirección general",
] as const;

export const EXPANSION_META_IDS = ["conversaciones", "negociacion", "oportunidades"] as const;

export type ExpansionEtapa = (typeof EXPANSION_ETAPAS)[number]["id"];
export type ExpansionTrato = (typeof EXPANSION_TRATOS)[number]["id"];
export type ExpansionTipoContacto = (typeof EXPANSION_TIPOS_CONTACTO)[number]["id"];
export type ExpansionTipoActividad = (typeof EXPANSION_TIPOS_ACTIVIDAD)[number]["id"];
export type ExpansionFuente = (typeof EXPANSION_FUENTES)[number]["id"];
export type ExpansionMetaId = (typeof EXPANSION_META_IDS)[number];

export type ExpansionContacto = {
  id: string;
  clave: string | null;
  nombre: string;
  empresa: string | null;
  telefono: string | null;
  email: string | null;
  whatsapp: string | null;
  cargo: string | null;
  zona: string | null;
  especialidad: string | null;
  web: string | null;
  instagram: string | null;
  linkedin: string | null;
  fuente: ExpansionFuente | null;
  fuenteLabel: string | null;
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
  lat: number | null;
  lng: number | null;
  enMapa: boolean;
  direccion: string | null;
  desarrollador: string | null;
  unidades: number | null;
  entrega: string | null;
  porQue: string | null;
  web: string | null;
  fuente: ExpansionFuente | null;
  fuenteLabel: string | null;
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
  "Sube cada hallazgo al pipeline. POST el contacto (nombre, tipo, empresa, cargo, telefono, whatsapp, email, zona, fuente, clave) y el sitio (nombre, zona, lat, lng, desarrollador, unidades, entrega, porQue, fuente, trato, contactoClave). La etapa inicial es identificado. Para avanzar, POST una actividad con etapa, proximaAccion y proximaFecha. Si un dato no está confirmado, dilo en el texto. Repetir un POST con la misma clave devuelve creado: false y no pisa el registro: usa PATCH para corregir.";

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
      "Crea un contacto. Puedes mandar cargo, telefono, whatsapp, email, zona, especialidad, web, instagram, linkedin y fuente. clave es opcional y única. Si ya existe, responde 200 con creado: false y no pisa el registro.",
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
    describe:
      "Crea una oportunidad. Manda lat y lng para verla en el mapa, más zona, direccion, desarrollador, unidades, entrega, porQue, web y fuente. Enlaza el contacto con contactoClave o contactoId.",
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
      "Anota investigación, llamada, WhatsApp, email, visita, presentación o nota. Si mandas etapa, proximaAccion o proximaFecha, también mueve el sitio. Repetir el mismo tipo, texto y fecha no duplica la nota y responde creado: false.",
  },
  {
    method: "GET",
    path: "/api/agent/expansion/metas",
    describe: "Las tres metas y cuánto hay ahora. diferencia es null cuando la meta es 0.",
  },
  {
    method: "PATCH",
    path: "/api/agent/expansion/metas",
    describe: "Ajusta conversaciones, negociacion y oportunidades. Cada valor es un entero de 0 a 10000. 0 significa sin meta.",
  },
] as const;

const META_HELP: Record<ExpansionMetaId, { etiqueta: string; ayuda: string }> = {
  conversaciones: {
    etiqueta: "Conversaciones activas",
    ayuda: "Oportunidades en la etapa Conversación activa.",
  },
  negociacion: {
    etiqueta: "En negociación",
    ayuda: "Oportunidades en Escalamiento / negociación.",
  },
  oportunidades: {
    etiqueta: "Oportunidades",
    ayuda: "Oportunidades que ya llegaron a la etapa Oportunidad.",
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

export function normalizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

const ETAPA_ALIAS: Record<string, ExpansionEtapa> = {
  conversacion_activa: "conversacion",
  escalamiento: "negociacion",
  escalamiento_negociacion: "negociacion",
  en_pausa: "pausa",
};

const ACTIVIDAD_ALIAS: Record<string, ExpansionTipoActividad> = {
  investigacion: "investigacion",
  presentacion: "presentacion",
  correo: "email",
  mail: "email",
  propuesta: "presentacion",
};

const FUENTE_ALIAS: Record<string, ExpansionFuente> = {
  google_search: "google",
  google_maps: "maps",
  maps: "maps",
  sitio_web: "website",
  website_oficial: "website",
  pagina_oficial: "website",
  portal_inmobiliario: "portal",
  portales: "portal",
  noticias: "prensa",
  prensa_noticias: "prensa",
};

function matchId<T extends string>(list: readonly { id: T }[], token: string, alias: Record<string, T>): T | null {
  const id = alias[token] ?? token;
  return list.some((item) => item.id === id) ? (id as T) : null;
}

export function parseEtapa(value: unknown): ExpansionEtapa | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  return matchId(EXPANSION_ETAPAS, normalizeToken(value), ETAPA_ALIAS);
}

export function parseTrato(value: unknown): ExpansionTrato | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  return matchId(EXPANSION_TRATOS, normalizeToken(value), {});
}

export function parseTipoContacto(value: unknown): ExpansionTipoContacto | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  return matchId(EXPANSION_TIPOS_CONTACTO, normalizeToken(value), { desarrolladora: "desarrollador", inmobiliaria: "broker" });
}

export function parseTipoActividad(value: unknown): ExpansionTipoActividad | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  return matchId(EXPANSION_TIPOS_ACTIVIDAD, normalizeToken(value), ACTIVIDAD_ALIAS);
}

export function parseFuente(value: unknown): ExpansionFuente | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  return matchId(EXPANSION_FUENTES, normalizeToken(value), FUENTE_ALIAS);
}

export function parseCoord(value: unknown, kind: "lat" | "lng"): { ok: true; value: number | null } | { ok: false; message: string } {
  if (value == null || value === "") {
    return { ok: true, value: null };
  }
  const number = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value.trim()) : Number.NaN;
  if (!Number.isFinite(number)) {
    return { ok: false, message: kind === "lat" ? "La latitud no es válida" : "La longitud no es válida" };
  }
  if (kind === "lat" && (number < -90 || number > 90)) {
    return { ok: false, message: "La latitud tiene que estar entre -90 y 90" };
  }
  if (kind === "lng" && (number < -180 || number > 180)) {
    return { ok: false, message: "La longitud tiene que estar entre -180 y 180" };
  }
  return { ok: true, value: Math.round(number * 1e6) / 1e6 };
}

export function mensajeEtapaInvalida(): string {
  return `La etapa no es válida. Usa ${EXPANSION_ETAPAS.map((item) => item.id).join(", ")}`;
}

export function seguimientoVencido(sitio: Pick<ExpansionSitio, "etapa" | "proximaFecha">, today = todayDayKey()): boolean {
  if (!sitio.proximaFecha || !isDayKey(sitio.proximaFecha) || !isDayKey(today)) {
    return false;
  }
  if (sitio.etapa === "pausa" || sitio.etapa === "descartado") {
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
    conversaciones: sitios.filter((sitio) => sitio.etapa === "conversacion").length,
    negociacion: sitios.filter((sitio) => sitio.etapa === "negociacion").length,
    oportunidades: sitios.filter((sitio) => sitio.etapa === "oportunidad").length,
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
    activos: sitios.filter((sitio) => sitio.etapa !== "descartado" && sitio.etapa !== "pausa").length,
  };
}
