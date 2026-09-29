import { publishAgentEvent } from "@/lib/agent-events";
import { parsePrice } from "@/lib/catalog-import";
import { removeCompraCaptura, storeCompraCaptura, type CompraCapturaFile } from "@/lib/contabilidad/compra-captura";
import { COMPRA_NCF_DUPLICADO, parseNcf, parseRnc } from "@/lib/contabilidad/compra-fiscal";
import { isDayKey, todayDayKey } from "@/lib/local-day";
import { toMoney } from "@/lib/money";
import { getSupabaseAdminClient } from "@/lib/supabase";
import {
  COMPRAS_PAGE_SIZE,
  dueDateFromCredit,
  sortProveedores,
  summarizePendientes,
  type Compra,
  type ComprasList,
  type Proveedor,
} from "@/lib/contabilidad/compras-shared";

export type { Compra, ComprasList, Proveedor } from "@/lib/contabilidad/compras-shared";

const NOMBRE_MAX = 120;
const NOTAS_MAX = 500;
const LIST_MAX = 1000;

const PROVEEDOR_SELECT = "id, nombre, tiene_credito, dias_credito, notas";
const COMPRA_SELECT =
  "id, proveedor_id, monto, fecha, due_date, pagado, pagado_en, rnc, ncf, captura_path, factura_id, proveedores ( id, nombre )";

type ProveedorRow = {
  id: unknown;
  nombre: unknown;
  tiene_credito: unknown;
  dias_credito: unknown;
  notas: unknown;
};

type ProveedorEmbed = { id?: unknown; nombre?: unknown } | { id?: unknown; nombre?: unknown }[] | null;

type CompraRow = {
  id: unknown;
  proveedor_id: unknown;
  monto: unknown;
  fecha: unknown;
  due_date: unknown;
  pagado: unknown;
  pagado_en: unknown;
  rnc: unknown;
  ncf: unknown;
  captura_path: unknown;
  factura_id?: unknown;
  proveedores?: ProveedorEmbed;
};

type CompraStored = Compra & { capturaPath: string | null };

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "23505");
}

function trimText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function parseDiasCredito(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 3650) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 3650) {
      return parsed;
    }
  }
  return null;
}

function mapProveedor(row: ProveedorRow): Proveedor | null {
  const id = String(row.id ?? "");
  const nombre = String(row.nombre ?? "").trim();
  if (!id || !nombre) {
    return null;
  }
  const dias = Number(row.dias_credito);
  return {
    id,
    nombre,
    tieneCredito: Boolean(row.tiene_credito),
    diasCredito: Number.isFinite(dias) && dias > 0 ? Math.trunc(dias) : 0,
    notas: trimText(row.notas, NOTAS_MAX) || null,
  };
}

function proveedorNombre(embed: ProveedorEmbed | undefined, fallbackId: string): string {
  const row = Array.isArray(embed) ? embed[0] : embed;
  const nombre = String(row?.nombre ?? "").trim();
  return nombre || fallbackId;
}

function fiscalText(value: unknown): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
}

function mapCompra(row: CompraRow): CompraStored | null {
  const id = String(row.id ?? "");
  const proveedorId = String(row.proveedor_id ?? "");
  const fecha = String(row.fecha ?? "");
  const dueDate = String(row.due_date ?? "");
  if (!id || !proveedorId || !isDayKey(fecha) || !isDayKey(dueDate)) {
    return null;
  }
  const pagadoEn = row.pagado_en ? String(row.pagado_en) : null;
  const capturaPath = fiscalText(row.captura_path);
  return {
    id,
    proveedorId,
    proveedorNombre: proveedorNombre(row.proveedores, proveedorId),
    monto: toMoney(row.monto),
    fecha,
    dueDate,
    pagado: Boolean(row.pagado),
    pagadoEn: pagadoEn && isDayKey(pagadoEn) ? pagadoEn : null,
    rnc: fiscalText(row.rnc),
    ncf: fiscalText(row.ncf),
    tieneCaptura: Boolean(capturaPath),
    facturaId: typeof row.factura_id === "string" ? row.factura_id : null,
    capturaPath,
  };
}

function publicCompra(compra: CompraStored): Compra {
  return {
    id: compra.id,
    proveedorId: compra.proveedorId,
    proveedorNombre: compra.proveedorNombre,
    monto: compra.monto,
    fecha: compra.fecha,
    dueDate: compra.dueDate,
    pagado: compra.pagado,
    pagadoEn: compra.pagadoEn,
    rnc: compra.rnc,
    ncf: compra.ncf,
    tieneCaptura: compra.tieneCaptura,
    facturaId: compra.facturaId,
  };
}

export function parseProveedorInput(body: {
  nombre?: unknown;
  tieneCredito?: unknown;
  diasCredito?: unknown;
  notas?: unknown;
}): { ok: true; data: Omit<Proveedor, "id"> } | { ok: false; message: string } {
  const nombre = trimText(body.nombre, NOMBRE_MAX);
  if (!nombre) {
    return { ok: false, message: "El nombre es obligatorio" };
  }
  const tieneCredito = Boolean(body.tieneCredito);
  const diasCredito = tieneCredito ? parseDiasCredito(body.diasCredito) : 0;
  if (diasCredito == null) {
    return { ok: false, message: "Los días de crédito no son válidos" };
  }
  return {
    ok: true,
    data: {
      nombre,
      tieneCredito,
      diasCredito,
      notas: trimText(body.notas, NOTAS_MAX) || null,
    },
  };
}

export async function listProveedores(): Promise<Proveedor[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("proveedores").select(PROVEEDOR_SELECT).limit(LIST_MAX);
  if (error) {
    throw error;
  }
  const proveedores = (data ?? []).map((row) => mapProveedor(row as ProveedorRow)).filter((row): row is Proveedor => Boolean(row));
  return sortProveedores(proveedores);
}

export async function createProveedor(input: Omit<Proveedor, "id">): Promise<Proveedor> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("proveedores")
    .insert({
      nombre: input.nombre,
      tiene_credito: input.tieneCredito,
      dias_credito: input.diasCredito,
      notas: input.notas,
    })
    .select(PROVEEDOR_SELECT)
    .single();
  if (error) {
    if (isUniqueViolation(error)) {
      throw new Error("Ya existe un proveedor con ese nombre");
    }
    throw error;
  }
  const mapped = mapProveedor(data as ProveedorRow);
  if (!mapped) {
    throw new Error("No pudimos guardar el proveedor");
  }
  await publishAgentEvent("proveedor.creado", { ...mapped });
  return mapped;
}

export async function updateProveedor(id: string, patch: Partial<Omit<Proveedor, "id">>): Promise<Proveedor> {
  if (!id) {
    throw new Error("Falta el proveedor");
  }
  const payload: Record<string, unknown> = {};
  if (patch.nombre !== undefined) {
    payload.nombre = patch.nombre;
  }
  if (patch.tieneCredito !== undefined) {
    payload.tiene_credito = patch.tieneCredito;
  }
  if (patch.diasCredito !== undefined) {
    payload.dias_credito = patch.diasCredito;
  }
  if (patch.notas !== undefined) {
    payload.notas = patch.notas;
  }
  if (Object.keys(payload).length === 0) {
    throw new Error("No hay cambios");
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("proveedores")
    .update(payload)
    .eq("id", id)
    .select(PROVEEDOR_SELECT)
    .maybeSingle();
  if (error) {
    if (isUniqueViolation(error)) {
      throw new Error("Ya existe un proveedor con ese nombre");
    }
    throw error;
  }
  const mapped = data ? mapProveedor(data as ProveedorRow) : null;
  if (!mapped) {
    throw new Error("No encontramos ese proveedor");
  }
  await publishAgentEvent("proveedor.actualizado", { ...mapped });
  return mapped;
}

async function findProveedorByNombre(nombre: string): Promise<Proveedor | null> {
  const needle = nombre.trim().toLowerCase();
  if (!needle) {
    return null;
  }
  const proveedores = await listProveedores();
  return proveedores.find((item) => item.nombre.trim().toLowerCase() === needle) ?? null;
}

export async function findOrCreateProveedor(nombre: string): Promise<Proveedor> {
  const existing = await findProveedorByNombre(nombre);
  if (existing) {
    return existing;
  }
  try {
    return await createProveedor({
      nombre: nombre.trim(),
      tieneCredito: false,
      diasCredito: 0,
      notas: null,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Ya existe")) {
      const again = await findProveedorByNombre(nombre);
      if (again) {
        return again;
      }
    }
    throw error;
  }
}

export type ListComprasFilters = {
  pagado?: boolean | null;
  proveedorId?: string | null;
  from?: string | null;
  to?: string | null;
  page?: number;
};

export async function listCompras(filters: ListComprasFilters = {}): Promise<ComprasList> {
  const supabase = getSupabaseAdminClient();
  const pendingOnly = filters.pagado === false;
  const page = Math.max(1, filters.page ?? 1);
  let query = supabase.from("compras").select(COMPRA_SELECT, { count: "exact" });

  if (filters.pagado === true) {
    query = query.eq("pagado", true);
  } else if (pendingOnly) {
    query = query.eq("pagado", false);
  }
  if (filters.proveedorId) {
    query = query.eq("proveedor_id", filters.proveedorId);
  }
  if (filters.from && isDayKey(filters.from)) {
    query = query.gte("fecha", filters.from);
  }
  if (filters.to && isDayKey(filters.to)) {
    query = query.lte("fecha", filters.to);
  }

  if (pendingOnly) {
    query = query.order("due_date", { ascending: true }).order("fecha", { ascending: true }).limit(LIST_MAX);
  } else {
    const from = (page - 1) * COMPRAS_PAGE_SIZE;
    query = query
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, from + COMPRAS_PAGE_SIZE - 1);
  }

  const [{ data, error, count }, summary] = await Promise.all([query, loadComprasSummary()]);
  if (error) {
    throw error;
  }
  const compras = (data ?? [])
    .map((row) => mapCompra(row as CompraRow))
    .filter((row): row is CompraStored => Boolean(row))
    .map(publicCompra);
  return { compras, summary, total: count ?? compras.length };
}

async function loadComprasSummary() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("compras")
    .select("monto, due_date, pagado")
    .eq("pagado", false)
    .limit(LIST_MAX);
  if (error) {
    throw error;
  }
  const rows = (data ?? [])
    .map((row) => {
      const dueDate = String(row.due_date ?? "");
      if (!isDayKey(dueDate)) {
        return null;
      }
      return { pagado: false as const, monto: toMoney(row.monto), dueDate };
    })
    .filter((row): row is { pagado: false; monto: number; dueDate: string } => Boolean(row));
  return summarizePendientes(rows, todayDayKey());
}

async function getProveedorById(id: string): Promise<Proveedor | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("proveedores").select(PROVEEDOR_SELECT).eq("id", id).maybeSingle();
  if (error) {
    throw error;
  }
  return data ? mapProveedor(data as ProveedorRow) : null;
}

function parseDayField(value: unknown, message: string): string {
  const day = typeof value === "string" ? value.trim() : "";
  if (!isDayKey(day)) {
    throw new Error(message);
  }
  return day;
}

function parseOptionalDayField(value: unknown, message: string): string | null {
  if (value == null) {
    return null;
  }
  if (typeof value === "string" && value.trim() === "") {
    return null;
  }
  return parseDayField(value, message);
}

function parseMontoInput(value: unknown): number {
  const montoRaw =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? parsePrice(value)
        : null;
  const monto = montoRaw == null ? null : toMoney(montoRaw);
  if (monto == null || !(monto > 0)) {
    throw new Error("El monto tiene que ser mayor que 0");
  }
  return monto;
}

function hasOwn(input: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(input, key);
}

async function resolveProveedor(input: { proveedorId?: unknown; proveedorNombre?: unknown }): Promise<Proveedor> {
  const proveedorIdRaw = typeof input.proveedorId === "string" ? input.proveedorId.trim() : "";
  const proveedorNombre = trimText(input.proveedorNombre, NOMBRE_MAX);
  if (proveedorIdRaw) {
    const proveedor = await getProveedorById(proveedorIdRaw);
    if (!proveedor) {
      throw new Error("No encontramos ese proveedor");
    }
    return proveedor;
  }
  if (proveedorNombre) {
    return findOrCreateProveedor(proveedorNombre);
  }
  throw new Error("Elige o escribe un proveedor");
}

async function getCompraById(id: string): Promise<CompraStored | null> {
  if (!id) {
    return null;
  }
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("compras").select(COMPRA_SELECT).eq("id", id).maybeSingle();
  if (error) {
    throw error;
  }
  return data ? mapCompra(data as CompraRow) : null;
}

async function findCompraByRncNcf(rnc: string, ncf: string): Promise<CompraStored | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("compras").select(COMPRA_SELECT).eq("rnc", rnc).eq("ncf", ncf).maybeSingle();
  if (error) {
    throw error;
  }
  return data ? mapCompra(data as CompraRow) : null;
}

export class CompraDuplicadaError extends Error {
  compra: Compra;

  constructor(compra: Compra) {
    super(COMPRA_NCF_DUPLICADO);
    this.name = "CompraDuplicadaError";
    this.compra = compra;
  }
}

function requireFiscal(input: { rnc?: unknown; ncf?: unknown }): { rnc: string; ncf: string } {
  const rnc = parseRnc(input.rnc);
  if (!rnc.ok) {
    throw new Error(rnc.message);
  }
  const ncf = parseNcf(input.ncf);
  if (!ncf.ok) {
    throw new Error(ncf.message);
  }
  return { rnc: rnc.rnc, ncf: ncf.ncf };
}

async function throwIfDuplicateNcf(error: unknown, rnc: string, ncf: string): Promise<never> {
  if (!isUniqueViolation(error)) {
    throw error;
  }
  const existing = await findCompraByRncNcf(rnc, ncf);
  if (existing) {
    throw new CompraDuplicadaError(publicCompra(existing));
  }
  throw new Error(COMPRA_NCF_DUPLICADO);
}

export type CompraInput = {
  proveedorId?: unknown;
  proveedorNombre?: unknown;
  monto?: unknown;
  fecha?: unknown;
  dueDate?: unknown;
  pagado?: unknown;
  pagadoEn?: unknown;
  rnc?: unknown;
  ncf?: unknown;
  captura?: CompraCapturaFile;
};

export async function createCompra(input: CompraInput): Promise<Compra> {
  const fecha = parseDayField(input.fecha, "La fecha de compra no es válida");
  const monto = parseMontoInput(input.monto);
  const proveedor = await resolveProveedor(input);
  const dueDate =
    parseOptionalDayField(input.dueDate, "La fecha de vencimiento no es válida") ??
    dueDateFromCredit(fecha, proveedor);
  const pagado = input.pagado === true;
  const pagadoEn = pagado
    ? parseOptionalDayField(input.pagadoEn, "La fecha de pago no es válida") ?? fecha
    : null;
  const fiscal = requireFiscal(input);
  if (!input.captura) {
    throw new Error("La captura de la factura es obligatoria");
  }
  const capturaPath = await storeCompraCaptura(input.captura);

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("compras")
    .insert({
      proveedor_id: proveedor.id,
      monto,
      fecha,
      due_date: dueDate,
      pagado,
      pagado_en: pagadoEn,
      rnc: fiscal.rnc,
      ncf: fiscal.ncf,
      captura_path: capturaPath,
    })
    .select(COMPRA_SELECT)
    .single();
  if (error) {
    await removeCompraCaptura(capturaPath);
    await throwIfDuplicateNcf(error, fiscal.rnc, fiscal.ncf);
  }
  const mapped = data ? mapCompra(data as CompraRow) : null;
  if (!mapped) {
    await removeCompraCaptura(capturaPath);
    throw new Error("No pudimos guardar la compra");
  }
  const compra = publicCompra(mapped);
  await publishAgentEvent("compra.creada", { ...compra });
  return compra;
}

export async function updateCompra(id: string, input: CompraInput): Promise<Compra> {
  if (!id) {
    throw new Error("Falta la compra");
  }
  const current = await getCompraById(id);
  if (!current) {
    throw new Error("No encontramos esa compra");
  }

  const next: {
    proveedor_id?: string;
    monto?: number;
    fecha?: string;
    due_date?: string;
    pagado?: boolean;
    pagado_en?: string | null;
    rnc?: string;
    ncf?: string;
    captura_path?: string;
  } = {};
  let uploadedPath: string | null = null;
  let fiscal: { rnc: string; ncf: string } | null = null;

  if (hasOwn(input, "proveedorId") || hasOwn(input, "proveedorNombre")) {
    const proveedor = await resolveProveedor(input);
    if (proveedor.id !== current.proveedorId) {
      next.proveedor_id = proveedor.id;
    }
  }
  if (hasOwn(input, "monto")) {
    next.monto = parseMontoInput(input.monto);
  }
  if (hasOwn(input, "fecha")) {
    next.fecha = parseDayField(input.fecha, "La fecha de compra no es válida");
  }
  if (hasOwn(input, "dueDate")) {
    next.due_date = parseDayField(input.dueDate, "La fecha de vencimiento no es válida");
  }

  const nextPagado = hasOwn(input, "pagado")
    ? input.pagado === true
      ? true
      : input.pagado === false
        ? false
        : null
    : current.pagado;
  if (nextPagado == null) {
    throw new Error("El estado de pago no es válido");
  }

  if (hasOwn(input, "pagado") && nextPagado !== current.pagado) {
    next.pagado = nextPagado;
  }

  if (nextPagado) {
    if (hasOwn(input, "pagadoEn")) {
      if (input.pagadoEn == null || input.pagadoEn === "") {
        next.pagado_en = todayDayKey();
      } else {
        next.pagado_en = parseDayField(input.pagadoEn, "La fecha de pago no es válida");
      }
    } else if (!current.pagado) {
      next.pagado_en = todayDayKey();
    }
  } else if (current.pagado || current.pagadoEn) {
    next.pagado = false;
    next.pagado_en = null;
  }

  if (hasOwn(input, "rnc") || hasOwn(input, "ncf")) {
    fiscal = requireFiscal({
      rnc: hasOwn(input, "rnc") ? input.rnc : current.rnc,
      ncf: hasOwn(input, "ncf") ? input.ncf : current.ncf,
    });
    if (fiscal.rnc !== current.rnc) {
      next.rnc = fiscal.rnc;
    }
    if (fiscal.ncf !== current.ncf) {
      next.ncf = fiscal.ncf;
    }
  }
  if (!current.tieneCaptura && !input.captura && (hasOwn(input, "rnc") || hasOwn(input, "ncf"))) {
    throw new Error("La captura de la factura es obligatoria");
  }
  if (input.captura) {
    uploadedPath = await storeCompraCaptura(input.captura);
    next.captura_path = uploadedPath;
  }

  if (Object.keys(next).length === 0) {
    return publicCompra(current);
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("compras")
    .update(next)
    .eq("id", id)
    .select(COMPRA_SELECT)
    .maybeSingle();
  if (error) {
    await removeCompraCaptura(uploadedPath);
    if (fiscal) {
      await throwIfDuplicateNcf(error, fiscal.rnc, fiscal.ncf);
    }
    throw error;
  }
  const mapped = data ? mapCompra(data as CompraRow) : null;
  if (!mapped) {
    await removeCompraCaptura(uploadedPath);
    throw new Error("No encontramos esa compra");
  }
  if (uploadedPath && current.capturaPath && current.capturaPath !== uploadedPath) {
    await removeCompraCaptura(current.capturaPath);
  }
  const compra = publicCompra(mapped);
  await publishAgentEvent("compra.actualizada", { ...compra });
  return compra;
}

export async function markCompraPagada(id: string): Promise<Compra> {
  return updateCompra(id, { pagado: true });
}

export function compraFailure(error: unknown, fallback: string): { status: number; error: string; compra?: Compra } {
  if (error instanceof CompraDuplicadaError) {
    return { status: 409, error: error.message, compra: error.compra };
  }
  const message = error instanceof Error ? error.message : fallback;
  return { status: message.includes("No encontramos") ? 404 : 400, error: message };
}

export function parsePagadoParam(raw: string | null): boolean | null {
  if (raw === "true") {
    return true;
  }
  if (raw === "false") {
    return false;
  }
  return null;
}
