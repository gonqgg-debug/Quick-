import { parsePrice } from "@/lib/catalog-import";
import { isDayKey, todayDayKey } from "@/lib/local-day";
import { toMoney } from "@/lib/money";
import { getSupabaseAdminClient } from "@/lib/supabase";
import {
  COMPRAS_PAGE_SIZE,
  sortProveedores,
  summarizePendientes,
  type Compra,
  type ComprasList,
  type Proveedor,
} from "@/lib/admin-compras-shared";

export type { Compra, ComprasList, Proveedor } from "@/lib/admin-compras-shared";

const NOMBRE_MAX = 120;
const NOTAS_MAX = 500;
const LIST_MAX = 1000;

const PROVEEDOR_SELECT = "id, nombre, tiene_credito, dias_credito, notas";
const COMPRA_SELECT =
  "id, proveedor_id, monto, fecha, due_date, pagado, pagado_en, proveedores ( id, nombre )";

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
  proveedores?: ProveedorEmbed;
};

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

function proveedorNombre(embed: ProveedorEmbed, fallbackId: string): string {
  const row = Array.isArray(embed) ? embed[0] : embed;
  const nombre = String(row?.nombre ?? "").trim();
  return nombre || fallbackId;
}

function mapCompra(row: CompraRow): Compra | null {
  const id = String(row.id ?? "");
  const proveedorId = String(row.proveedor_id ?? "");
  const fecha = String(row.fecha ?? "");
  const dueDate = String(row.due_date ?? "");
  if (!id || !proveedorId || !isDayKey(fecha) || !isDayKey(dueDate)) {
    return null;
  }
  const pagadoEn = row.pagado_en ? String(row.pagado_en) : null;
  return {
    id,
    proveedorId,
    proveedorNombre: proveedorNombre(row.proveedores, proveedorId),
    monto: toMoney(row.monto),
    fecha,
    dueDate,
    pagado: Boolean(row.pagado),
    pagadoEn: pagadoEn && isDayKey(pagadoEn) ? pagadoEn : null,
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
  const compras = (data ?? []).map((row) => mapCompra(row as CompraRow)).filter((row): row is Compra => Boolean(row));
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

export async function createCompra(input: {
  proveedorId?: unknown;
  proveedorNombre?: unknown;
  monto?: unknown;
  fecha?: unknown;
  dueDate?: unknown;
}): Promise<Compra> {
  const fecha = typeof input.fecha === "string" ? input.fecha.trim() : "";
  const dueDate = typeof input.dueDate === "string" ? input.dueDate.trim() : "";
  if (!isDayKey(fecha)) {
    throw new Error("La fecha de compra no es válida");
  }
  if (!isDayKey(dueDate)) {
    throw new Error("La fecha de vencimiento no es válida");
  }

  const montoRaw =
    typeof input.monto === "number"
      ? input.monto
      : typeof input.monto === "string"
        ? parsePrice(input.monto)
        : null;
  const monto = montoRaw == null ? null : toMoney(montoRaw);
  if (monto == null || !(monto > 0)) {
    throw new Error("El monto tiene que ser mayor que 0");
  }

  const proveedorIdRaw = typeof input.proveedorId === "string" ? input.proveedorId.trim() : "";
  const proveedorNombre = trimText(input.proveedorNombre, NOMBRE_MAX);
  let proveedor: Proveedor | null = null;
  if (proveedorIdRaw) {
    proveedor = await getProveedorById(proveedorIdRaw);
    if (!proveedor) {
      throw new Error("No encontramos ese proveedor");
    }
  } else if (proveedorNombre) {
    proveedor = await findOrCreateProveedor(proveedorNombre);
  }
  if (!proveedor) {
    throw new Error("Elige o escribe un proveedor");
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("compras")
    .insert({
      proveedor_id: proveedor.id,
      monto,
      fecha,
      due_date: dueDate,
      pagado: false,
      pagado_en: null,
    })
    .select(COMPRA_SELECT)
    .single();
  if (error) {
    throw error;
  }
  const mapped = mapCompra(data as CompraRow);
  if (!mapped) {
    throw new Error("No pudimos guardar la compra");
  }
  return mapped;
}

export async function markCompraPagada(id: string): Promise<Compra> {
  if (!id) {
    throw new Error("Falta la compra");
  }
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("compras")
    .update({ pagado: true, pagado_en: todayDayKey() })
    .eq("id", id)
    .select(COMPRA_SELECT)
    .maybeSingle();
  if (error) {
    throw error;
  }
  const mapped = data ? mapCompra(data as CompraRow) : null;
  if (!mapped) {
    throw new Error("No encontramos esa compra");
  }
  return mapped;
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
