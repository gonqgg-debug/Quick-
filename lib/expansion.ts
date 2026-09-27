import { isDayKey, todayDayKey } from "@/lib/local-day";
import { getSupabaseAdminClient } from "@/lib/supabase";
import {
  EXPANSION_ETAPAS,
  EXPANSION_META_IDS,
  EXPANSION_TIPOS_ACTIVIDAD,
  EXPANSION_TIPOS_CONTACTO,
  EXPANSION_TRATOS,
  buildExpansionPipeline,
  expansionMetaCopy,
  isUuid,
  labelOf,
  parseClave,
  parseEtapa,
  parseTipoActividad,
  parseTipoContacto,
  parseTrato,
  seguimientoVencido,
  type ExpansionActividad,
  type ExpansionContacto,
  type ExpansionEtapa,
  type ExpansionMeta,
  type ExpansionMetaId,
  type ExpansionPipeline,
  type ExpansionSitio,
  type ExpansionTipoActividad,
  type ExpansionTipoContacto,
  type ExpansionTrato,
} from "@/lib/expansion-shared";

const LIST_MAX = 1000;
const CONTACTO_SELECT = "id, clave, nombre, empresa, telefono, email, tipo, notas";
const SITIO_SELECT =
  "id, clave, nombre, zona, trato, etapa, etapa_desde, detalle, proxima_accion, proxima_fecha, contacto_id, expansion_contactos ( id, clave, nombre, empresa, telefono, email, tipo, notas )";

type ContactoRow = {
  id?: unknown;
  clave?: unknown;
  nombre?: unknown;
  empresa?: unknown;
  telefono?: unknown;
  email?: unknown;
  tipo?: unknown;
  notas?: unknown;
};

export class ExpansionDuplicadoError extends Error {
  contacto?: ExpansionContacto;
  sitio?: ExpansionSitio;

  constructor(message: string, record: { contacto?: ExpansionContacto; sitio?: ExpansionSitio }) {
    super(message);
    this.name = "ExpansionDuplicadoError";
    this.contacto = record.contacto;
    this.sitio = record.sitio;
  }
}

function textOrNull(value: unknown, max = 500): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const text = value.trim().slice(0, max);
  return text || null;
}

function requireNombre(value: unknown, label: string): string {
  const nombre = textOrNull(value, 160);
  if (!nombre) {
    throw new Error(`El ${label} es obligatorio`);
  }
  return nombre;
}

function mapContacto(row: ContactoRow | null | undefined): ExpansionContacto | null {
  if (!row) {
    return null;
  }
  const id = String(row.id ?? "");
  const nombre = String(row.nombre ?? "").trim();
  const tipo = parseTipoContacto(row.tipo) ?? "otro";
  if (!id || !nombre) {
    return null;
  }
  return {
    id,
    clave: textOrNull(row.clave, 80),
    nombre,
    empresa: textOrNull(row.empresa, 160),
    telefono: textOrNull(row.telefono, 40),
    email: textOrNull(row.email, 160),
    tipo,
    tipoLabel: labelOf(EXPANSION_TIPOS_CONTACTO, tipo),
    notas: textOrNull(row.notas, 2000),
  };
}

function embedContacto(value: unknown): ExpansionContacto | null {
  const row = Array.isArray(value) ? value[0] : value;
  return mapContacto(row as ContactoRow | null);
}

function mapSitio(row: Record<string, unknown>, today = todayDayKey()): ExpansionSitio | null {
  const id = String(row.id ?? "");
  const nombre = String(row.nombre ?? "").trim();
  const etapa = parseEtapa(row.etapa);
  const trato = parseTrato(row.trato);
  const etapaDesde = String(row.etapa_desde ?? "").slice(0, 10);
  if (!id || !nombre || !etapa || !trato || !isDayKey(etapaDesde)) {
    return null;
  }
  const proximaFecha = row.proxima_fecha ? String(row.proxima_fecha).slice(0, 10) : null;
  const sitio: ExpansionSitio = {
    id,
    clave: textOrNull(row.clave, 80),
    nombre,
    zona: textOrNull(row.zona, 160),
    trato,
    tratoLabel: labelOf(EXPANSION_TRATOS, trato),
    etapa,
    etapaLabel: labelOf(EXPANSION_ETAPAS, etapa),
    etapaDesde,
    detalle: textOrNull(row.detalle, 2000),
    proximaAccion: textOrNull(row.proxima_accion, 240),
    proximaFecha: proximaFecha && isDayKey(proximaFecha) ? proximaFecha : null,
    seguimientoVencido: false,
    contacto: embedContacto(row.expansion_contactos),
  };
  sitio.seguimientoVencido = seguimientoVencido(sitio, today);
  return sitio;
}

function mapActividad(row: Record<string, unknown>): ExpansionActividad | null {
  const id = String(row.id ?? "");
  const sitioId = String(row.sitio_id ?? "");
  const tipo = parseTipoActividad(row.tipo);
  const texto = textOrNull(row.texto, 2000);
  const fecha = String(row.fecha ?? "").slice(0, 10);
  if (!id || !sitioId || !tipo || !texto || !isDayKey(fecha)) {
    return null;
  }
  return {
    id,
    sitioId,
    contactoId: row.contacto_id ? String(row.contacto_id) : null,
    tipo,
    tipoLabel: labelOf(EXPANSION_TIPOS_ACTIVIDAD, tipo),
    texto,
    fecha,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "23505");
}

function hasOwn(input: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(input, key);
}

export async function listExpansionContactos(query?: string | null): Promise<ExpansionContacto[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("expansion_contactos").select(CONTACTO_SELECT).order("nombre", { ascending: true }).limit(LIST_MAX);
  if (error) {
    throw error;
  }
  const needle = query?.trim().toLowerCase() ?? "";
  return (data ?? [])
    .map((row) => mapContacto(row as ContactoRow))
    .filter((row): row is ExpansionContacto => Boolean(row))
    .filter((row) => {
      if (!needle) {
        return true;
      }
      return [row.nombre, row.empresa, row.telefono, row.email, row.clave].some((value) => value?.toLowerCase().includes(needle));
    });
}

async function findContacto(column: "id" | "clave", value: string): Promise<ExpansionContacto | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("expansion_contactos").select(CONTACTO_SELECT).eq(column, value).maybeSingle();
  if (error) {
    throw error;
  }
  return mapContacto(data as ContactoRow | null);
}

export async function getExpansionContacto(idOrClave: string): Promise<ExpansionContacto | null> {
  if (isUuid(idOrClave)) {
    const byId = await findContacto("id", idOrClave);
    if (byId) {
      return byId;
    }
  }
  return findContacto("clave", idOrClave);
}

export async function createExpansionContacto(input: {
  clave?: unknown;
  nombre?: unknown;
  empresa?: unknown;
  telefono?: unknown;
  email?: unknown;
  tipo?: unknown;
  notas?: unknown;
}): Promise<{ creado: boolean; contacto: ExpansionContacto }> {
  const clave = parseClave(input.clave);
  if (!clave.ok) {
    throw new Error(clave.message);
  }
  if (clave.clave) {
    const existing = await getExpansionContacto(clave.clave);
    if (existing) {
      return { creado: false, contacto: existing };
    }
  }
  const tipo = input.tipo == null || input.tipo === "" ? "otro" : parseTipoContacto(input.tipo);
  if (!tipo) {
    throw new Error("El tipo de contacto no es válido. Usa broker, desarrollador, administracion, propietario u otro");
  }
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("expansion_contactos")
    .insert({
      clave: clave.clave,
      nombre: requireNombre(input.nombre, "nombre"),
      empresa: textOrNull(input.empresa, 160),
      telefono: textOrNull(input.telefono, 40),
      email: textOrNull(input.email, 160),
      tipo,
      notas: textOrNull(input.notas, 2000),
    })
    .select(CONTACTO_SELECT)
    .single();
  if (error) {
    if (isUniqueViolation(error) && clave.clave) {
      const existing = await getExpansionContacto(clave.clave);
      if (existing) {
        return { creado: false, contacto: existing };
      }
    }
    throw error;
  }
  const contacto = mapContacto(data as ContactoRow);
  if (!contacto) {
    throw new Error("No pudimos guardar el contacto");
  }
  return { creado: true, contacto };
}

export async function updateExpansionContacto(idOrClave: string, input: Record<string, unknown>): Promise<ExpansionContacto> {
  const current = await getExpansionContacto(idOrClave);
  if (!current) {
    throw new Error("No encontramos ese contacto");
  }
  const next: Record<string, unknown> = {};
  if (hasOwn(input, "nombre")) {
    next.nombre = requireNombre(input.nombre, "nombre");
  }
  if (hasOwn(input, "empresa")) {
    next.empresa = textOrNull(input.empresa, 160);
  }
  if (hasOwn(input, "telefono")) {
    next.telefono = textOrNull(input.telefono, 40);
  }
  if (hasOwn(input, "email")) {
    next.email = textOrNull(input.email, 160);
  }
  if (hasOwn(input, "notas")) {
    next.notas = textOrNull(input.notas, 2000);
  }
  if (hasOwn(input, "tipo")) {
    const tipo = parseTipoContacto(input.tipo);
    if (!tipo) {
      throw new Error("El tipo de contacto no es válido. Usa broker, desarrollador, administracion, propietario u otro");
    }
    next.tipo = tipo;
  }
  if (hasOwn(input, "clave")) {
    const clave = parseClave(input.clave);
    if (!clave.ok) {
      throw new Error(clave.message);
    }
    next.clave = clave.clave;
  }
  if (Object.keys(next).length === 0) {
    return current;
  }
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("expansion_contactos").update(next).eq("id", current.id).select(CONTACTO_SELECT).maybeSingle();
  if (error) {
    if (isUniqueViolation(error)) {
      throw new Error("Esa clave ya pertenece a otro contacto");
    }
    throw error;
  }
  const contacto = data ? mapContacto(data as ContactoRow) : null;
  if (!contacto) {
    throw new Error("No encontramos ese contacto");
  }
  return contacto;
}

async function resolveContactoId(input: { contactoId?: unknown; contactoClave?: unknown }): Promise<string | null | undefined> {
  const hasId = hasOwn(input, "contactoId");
  const hasClave = hasOwn(input, "contactoClave");
  if (!hasId && !hasClave) {
    return undefined;
  }
  if (input.contactoId == null && input.contactoClave == null) {
    return null;
  }
  const raw = typeof input.contactoId === "string" && input.contactoId.trim() ? input.contactoId.trim() : typeof input.contactoClave === "string" ? input.contactoClave.trim() : "";
  if (!raw) {
    return null;
  }
  const contacto = await getExpansionContacto(raw);
  if (!contacto) {
    throw new Error("No encontramos ese contacto");
  }
  return contacto.id;
}

export async function listExpansionSitios(filter?: { etapa?: string | null; q?: string | null; vencidos?: boolean }): Promise<ExpansionSitio[]> {
  const supabase = getSupabaseAdminClient();
  let query = supabase.from("expansion_sitios").select(SITIO_SELECT).order("proxima_fecha", { ascending: true, nullsFirst: false }).limit(LIST_MAX);
  if (filter?.etapa) {
    const etapa = parseEtapa(filter.etapa);
    if (!etapa) {
      throw new Error("La etapa no es válida");
    }
    query = query.eq("etapa", etapa);
  }
  const { data, error } = await query;
  if (error) {
    throw error;
  }
  const today = todayDayKey();
  const needle = filter?.q?.trim().toLowerCase() ?? "";
  return (data ?? [])
    .map((row) => mapSitio(row as Record<string, unknown>, today))
    .filter((row): row is ExpansionSitio => Boolean(row))
    .filter((sitio) => {
      if (filter?.vencidos && !sitio.seguimientoVencido) {
        return false;
      }
      if (!needle) {
        return true;
      }
      return [sitio.nombre, sitio.zona, sitio.clave, sitio.contacto?.nombre, sitio.proximaAccion].some((value) => value?.toLowerCase().includes(needle));
    });
}

async function findSitio(column: "id" | "clave", value: string): Promise<ExpansionSitio | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("expansion_sitios").select(SITIO_SELECT).eq(column, value).maybeSingle();
  if (error) {
    throw error;
  }
  return data ? mapSitio(data as Record<string, unknown>) : null;
}

export async function getExpansionSitio(idOrClave: string): Promise<ExpansionSitio | null> {
  if (isUuid(idOrClave)) {
    const byId = await findSitio("id", idOrClave);
    if (byId) {
      return byId;
    }
  }
  return findSitio("clave", idOrClave);
}

function sitioFields(input: Record<string, unknown>, { requireAll }: { requireAll: boolean }): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  if (requireAll || hasOwn(input, "nombre")) {
    next.nombre = requireNombre(input.nombre, "nombre del sitio");
  }
  if (requireAll || hasOwn(input, "zona")) {
    next.zona = textOrNull(input.zona, 160);
  }
  if (requireAll || hasOwn(input, "detalle")) {
    next.detalle = textOrNull(input.detalle, 2000);
  }
  if (requireAll || hasOwn(input, "proximaAccion")) {
    next.proxima_accion = textOrNull(input.proximaAccion, 240);
  }
  if (requireAll || hasOwn(input, "trato")) {
    const trato = input.trato == null || input.trato === "" ? "alquiler" : parseTrato(input.trato);
    if (!trato) {
      throw new Error("El trato no es válido. Usa alquiler, compra o alianza");
    }
    next.trato = trato;
  }
  if (hasOwn(input, "proximaFecha") || requireAll) {
    if (input.proximaFecha == null || input.proximaFecha === "") {
      next.proxima_fecha = null;
    } else if (typeof input.proximaFecha === "string" && isDayKey(input.proximaFecha)) {
      next.proxima_fecha = input.proximaFecha;
    } else if (requireAll && (input.proximaFecha == null || input.proximaFecha === "")) {
      next.proxima_fecha = null;
    } else if (hasOwn(input, "proximaFecha") || input.proximaFecha) {
      throw new Error("La fecha del próximo paso no es válida");
    }
  }
  return next;
}

export async function createExpansionSitio(input: Record<string, unknown>): Promise<{ creado: boolean; sitio: ExpansionSitio }> {
  const clave = parseClave(input.clave);
  if (!clave.ok) {
    throw new Error(clave.message);
  }
  if (clave.clave) {
    const existing = await getExpansionSitio(clave.clave);
    if (existing) {
      return { creado: false, sitio: existing };
    }
  }
  const etapa = input.etapa == null || input.etapa === "" ? "contacto" : parseEtapa(input.etapa);
  if (!etapa) {
    throw new Error("La etapa no es válida. Usa contacto, visita, propuesta, negociacion, acuerdo, apertura o descartado");
  }
  const contactoId = await resolveContactoId(input);
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("expansion_sitios")
    .insert({
      ...sitioFields(input, { requireAll: true }),
      clave: clave.clave,
      etapa,
      etapa_desde: todayDayKey(),
      contacto_id: contactoId ?? null,
    })
    .select(SITIO_SELECT)
    .single();
  if (error) {
    if (isUniqueViolation(error) && clave.clave) {
      const existing = await getExpansionSitio(clave.clave);
      if (existing) {
        return { creado: false, sitio: existing };
      }
    }
    throw error;
  }
  const sitio = data ? mapSitio(data as Record<string, unknown>) : null;
  if (!sitio) {
    throw new Error("No pudimos guardar el sitio");
  }
  return { creado: true, sitio };
}

export async function updateExpansionSitio(idOrClave: string, input: Record<string, unknown>): Promise<ExpansionSitio> {
  const current = await getExpansionSitio(idOrClave);
  if (!current) {
    throw new Error("No encontramos ese sitio");
  }
  const next = sitioFields(input, { requireAll: false });
  if (hasOwn(input, "etapa")) {
    const etapa = parseEtapa(input.etapa);
    if (!etapa) {
      throw new Error("La etapa no es válida. Usa contacto, visita, propuesta, negociacion, acuerdo, apertura o descartado");
    }
    if (etapa !== current.etapa) {
      next.etapa = etapa;
      next.etapa_desde = todayDayKey();
    }
  }
  if (hasOwn(input, "clave")) {
    const clave = parseClave(input.clave);
    if (!clave.ok) {
      throw new Error(clave.message);
    }
    next.clave = clave.clave;
  }
  const contactoId = await resolveContactoId(input);
  if (contactoId !== undefined) {
    next.contacto_id = contactoId;
  }
  if (Object.keys(next).length === 0) {
    return current;
  }
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("expansion_sitios").update(next).eq("id", current.id).select(SITIO_SELECT).maybeSingle();
  if (error) {
    if (isUniqueViolation(error)) {
      throw new Error("Esa clave ya pertenece a otro sitio");
    }
    throw error;
  }
  const sitio = data ? mapSitio(data as Record<string, unknown>) : null;
  if (!sitio) {
    throw new Error("No encontramos ese sitio");
  }
  return sitio;
}

export async function listExpansionActividades(sitioId: string): Promise<ExpansionActividad[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("expansion_actividades")
    .select("id, sitio_id, contacto_id, tipo, texto, fecha")
    .eq("sitio_id", sitioId)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    throw error;
  }
  return (data ?? []).map((row) => mapActividad(row as Record<string, unknown>)).filter((row): row is ExpansionActividad => Boolean(row));
}

export async function createExpansionActividad(
  idOrClave: string,
  input: Record<string, unknown>
): Promise<{ creado: boolean; actividad: ExpansionActividad; sitio: ExpansionSitio }> {
  const sitio = await getExpansionSitio(idOrClave);
  if (!sitio) {
    throw new Error("No encontramos ese sitio");
  }
  const tipo = input.tipo == null || input.tipo === "" ? "nota" : parseTipoActividad(input.tipo);
  if (!tipo) {
    throw new Error("El tipo de actividad no es válido. Usa nota, llamada, whatsapp, visita o propuesta");
  }
  const texto = textOrNull(input.texto, 2000);
  if (!texto) {
    throw new Error("El texto de la actividad es obligatorio");
  }
  let fecha = todayDayKey();
  if (input.fecha != null && input.fecha !== "") {
    if (typeof input.fecha !== "string" || !isDayKey(input.fecha)) {
      throw new Error("La fecha de la actividad no es válida");
    }
    fecha = input.fecha;
  }
  const contactoId = (await resolveContactoId(input)) ?? sitio.contacto?.id ?? null;
  const supabase = getSupabaseAdminClient();
  const { data: duplicateRows, error: duplicateError } = await supabase
    .from("expansion_actividades")
    .select("id, sitio_id, contacto_id, tipo, texto, fecha")
    .eq("sitio_id", sitio.id)
    .eq("tipo", tipo)
    .eq("texto", texto)
    .eq("fecha", fecha)
    .order("created_at", { ascending: false })
    .limit(1);
  if (duplicateError) {
    throw duplicateError;
  }
  const duplicate = duplicateRows?.[0] ? mapActividad(duplicateRows[0] as Record<string, unknown>) : null;
  if (duplicate) {
    const repeated = await applyActividadPatch(sitio, input);
    return { creado: false, actividad: duplicate, sitio: repeated };
  }
  const { data, error } = await supabase
    .from("expansion_actividades")
    .insert({
      sitio_id: sitio.id,
      contacto_id: contactoId,
      tipo,
      texto,
      fecha,
    })
    .select("id, sitio_id, contacto_id, tipo, texto, fecha")
    .single();
  if (error) {
    throw error;
  }
  const actividad = data ? mapActividad(data as Record<string, unknown>) : null;
  if (!actividad) {
    throw new Error("No pudimos guardar la actividad");
  }
  const updated = await applyActividadPatch(sitio, input);
  return { creado: true, actividad, sitio: updated };
}

async function applyActividadPatch(sitio: ExpansionSitio, input: Record<string, unknown>): Promise<ExpansionSitio> {
  const patch: Record<string, unknown> = {};
  if (hasOwn(input, "etapa")) {
    patch.etapa = input.etapa;
  }
  if (hasOwn(input, "proximaAccion")) {
    patch.proximaAccion = input.proximaAccion;
  }
  if (hasOwn(input, "proximaFecha")) {
    patch.proximaFecha = input.proximaFecha;
  }
  return Object.keys(patch).length > 0 ? updateExpansionSitio(sitio.id, patch) : sitio;
}

export async function listExpansionMetas(): Promise<Array<{ id: ExpansionMetaId; meta: number }>> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("expansion_metas").select("id, meta");
  if (error) {
    throw error;
  }
  return EXPANSION_META_IDS.map((id) => {
    const row = (data ?? []).find((item) => item.id === id);
    const meta = Number(row?.meta ?? 0);
    return { id, meta: Number.isFinite(meta) && meta > 0 ? Math.trunc(meta) : 0 };
  });
}

export async function updateExpansionMetas(input: Record<string, unknown>): Promise<ExpansionMeta[]> {
  const supabase = getSupabaseAdminClient();
  for (const id of EXPANSION_META_IDS) {
    if (!hasOwn(input, id)) {
      continue;
    }
    const raw = input[id];
    const meta = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : null;
    if (meta == null || !Number.isInteger(meta) || meta < 0 || meta > 10000) {
      throw new Error("La meta tiene que ser un número entero de 0 a 10000");
    }
    const copy = expansionMetaCopy(id);
    const { error } = await supabase.from("expansion_metas").upsert({ id, etiqueta: copy.etiqueta, meta });
    if (error) {
      throw error;
    }
  }
  return loadExpansionPipeline().then((pipeline) => pipeline.metas);
}

export async function loadExpansionPipeline(): Promise<ExpansionPipeline> {
  const [sitios, metas] = await Promise.all([listExpansionSitios(), listExpansionMetas()]);
  return buildExpansionPipeline(sitios, metas);
}

export type { ExpansionContacto, ExpansionSitio, ExpansionActividad, ExpansionPipeline, ExpansionEtapa, ExpansionTrato, ExpansionTipoContacto, ExpansionTipoActividad };
