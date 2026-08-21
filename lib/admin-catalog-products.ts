import { getSupabaseAdminClient } from "@/lib/supabase";
import { toMoney } from "@/lib/money";
import { parsePrice } from "@/lib/catalog-import";
import type {
  AdminCatalogProduct,
  AdminCatalogProductFilters,
  AdminCatalogProductList,
} from "@/lib/admin-catalog-products-shared";
import { CATALOG_PRODUCTS_PAGE_SIZE, isUncategorized } from "@/lib/admin-catalog-products-shared";

export { CATALOG_PRODUCTS_PAGE_SIZE } from "@/lib/admin-catalog-products-shared";
export type {
  AdminCatalogProduct,
  AdminCatalogProductFilters,
  AdminCatalogProductList,
} from "@/lib/admin-catalog-products-shared";

const SELECT_FIELDS = "id, nombre, marca, categoria, precio, codigo_odoo, codigo_barras, foto_url, activo";
const EXPORT_MAX = 5000;
const BATCH_MAX = 400;

function sanitizeSearch(raw: string): string {
  return raw
    .trim()
    .replace(/[%_,()]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

function mapRow(row: {
  id: string;
  nombre: string;
  marca: string | null;
  categoria: string;
  precio: number | string;
  codigo_odoo: string | null;
  codigo_barras: string | null;
  foto_url: string | null;
  activo: boolean;
}): AdminCatalogProduct {
  return {
    id: String(row.id),
    nombre: String(row.nombre),
    marca: row.marca ? String(row.marca) : null,
    categoria: String(row.categoria ?? ""),
    precio: toMoney(row.precio),
    codigoOdoo: row.codigo_odoo ? String(row.codigo_odoo) : null,
    codigoBarras: row.codigo_barras ? String(row.codigo_barras) : null,
    fotoUrl: row.foto_url ? String(row.foto_url) : null,
    activo: Boolean(row.activo),
  };
}

export function parseCatalogProductFilters(params: URLSearchParams): AdminCatalogProductFilters {
  const estadoRaw = params.get("estado");
  const pageRaw = Number(params.get("page") || "1");
  return {
    q: params.get("q")?.trim() ?? "",
    categoria: params.get("categoria")?.trim() ?? "",
    estado: estadoRaw === "activo" || estadoRaw === "inactivo" ? estadoRaw : "todos",
    page: Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1,
  };
}

function applyListFilters<T extends { or: (value: string) => T; eq: (column: string, value: unknown) => T }>(
  query: T,
  filters: AdminCatalogProductFilters
): T {
  const q = sanitizeSearch(filters.q);
  let next = query;
  if (q) {
    next = next.or(
      `nombre.ilike.%${q}%,marca.ilike.%${q}%,codigo_odoo.ilike.%${q}%,codigo_barras.ilike.%${q}%`
    ) as T;
  }
  if (filters.categoria) {
    next = next.eq("categoria", filters.categoria) as T;
  }
  if (filters.estado === "activo") {
    next = next.eq("activo", true) as T;
  } else if (filters.estado === "inactivo") {
    next = next.eq("activo", false) as T;
  }
  return next;
}

export async function listAdminCatalogProducts(
  filters: AdminCatalogProductFilters
): Promise<AdminCatalogProductList> {
  const supabase = getSupabaseAdminClient();
  const pageSize = CATALOG_PRODUCTS_PAGE_SIZE;
  const from = (filters.page - 1) * pageSize;
  const to = from + pageSize - 1;

  const listQuery = applyListFilters(
    supabase
      .from("products")
      .select(SELECT_FIELDS, { count: "exact" })
      .order("nombre", { ascending: true })
      .range(from, to),
    filters
  );

  const [{ data, error, count }, { data: categoryRows, error: categoryError }] = await Promise.all([
    listQuery,
    supabase.from("products").select("categoria").order("categoria", { ascending: true }),
  ]);
  if (error) {
    throw error;
  }
  if (categoryError) {
    throw categoryError;
  }

  const categories = Array.from(
    new Set((categoryRows ?? []).map((row) => String(row.categoria ?? "").trim()).filter(Boolean))
  ).sort((left, right) => left.localeCompare(right, "es"));

  return {
    products: (data ?? []).map((row) => mapRow(row as Parameters<typeof mapRow>[0])),
    total: count ?? 0,
    page: filters.page,
    pageSize,
    categories,
  };
}

export async function fetchAdminCatalogProductsForExport(
  filters: AdminCatalogProductFilters,
  ids?: string[]
): Promise<AdminCatalogProduct[]> {
  const supabase = getSupabaseAdminClient();
  const products: AdminCatalogProduct[] = [];

  if (ids && ids.length > 0) {
    const unique = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean))).slice(0, EXPORT_MAX);
    for (let i = 0; i < unique.length; i += 100) {
      const chunk = unique.slice(i, i + 100);
      const { data, error } = await supabase.from("products").select(SELECT_FIELDS).in("id", chunk);
      if (error) {
        throw error;
      }
      products.push(...(data ?? []).map((row) => mapRow(row as Parameters<typeof mapRow>[0])));
    }
    return products.sort((left, right) => left.nombre.localeCompare(right.nombre, "es"));
  }

  for (let from = 0; from < EXPORT_MAX; from += 1000) {
    const { data, error } = await applyListFilters(
      supabase.from("products").select(SELECT_FIELDS).order("nombre", { ascending: true }).range(from, from + 999),
      filters
    );
    if (error) {
      throw error;
    }
    const batch = (data ?? []).map((row) => mapRow(row as Parameters<typeof mapRow>[0]));
    products.push(...batch);
    if (batch.length < 1000) {
      break;
    }
  }
  return products;
}

export function catalogExportRows(products: AdminCatalogProduct[]): Array<Array<string | number>> {
  return products.map((product) => [
    product.fotoUrl || "",
    product.nombre,
    product.marca || "",
    isUncategorized(product.categoria) ? "Sin categoría" : product.categoria,
    product.precio,
    product.codigoOdoo || "",
    product.codigoBarras || "",
    product.activo ? "Activo" : "Inactivo",
  ]);
}

export async function updateAdminCatalogProduct(input: {
  id: string;
  nombre?: unknown;
  marca?: unknown;
  categoria?: unknown;
  precio?: unknown;
  activo?: unknown;
}): Promise<AdminCatalogProduct> {
  if (!input.id) {
    throw new Error("Falta el producto");
  }
  const patch: {
    nombre?: string;
    marca?: string | null;
    categoria?: string;
    precio?: number;
    activo?: boolean;
  } = {};
  if (input.nombre !== undefined) {
    const nombre = String(input.nombre ?? "").trim();
    if (!nombre) {
      throw new Error("El nombre no puede quedar vacío");
    }
    patch.nombre = nombre;
  }
  if (input.marca !== undefined) {
    const marca = input.marca == null ? "" : String(input.marca).trim();
    patch.marca = marca || null;
  }
  if (input.categoria !== undefined) {
    const categoria = String(input.categoria ?? "").trim();
    if (!categoria) {
      throw new Error("La categoría no puede quedar vacía");
    }
    patch.categoria = categoria;
  }
  if (input.precio !== undefined) {
    const parsed = typeof input.precio === "number" ? input.precio : parsePrice(String(input.precio ?? ""));
    if (parsed == null || parsed < 0) {
      throw new Error("Precio inválido");
    }
    patch.precio = Math.round(parsed * 100) / 100;
  }
  if (input.activo !== undefined) {
    if (typeof input.activo !== "boolean") {
      throw new Error("Estado inválido");
    }
    patch.activo = input.activo;
  }
  if (Object.keys(patch).length === 0) {
    throw new Error("Nada que actualizar");
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("products")
    .update(patch)
    .eq("id", input.id)
    .select(SELECT_FIELDS)
    .maybeSingle();
  if (error || !data) {
    throw error ?? new Error("No pudimos guardar el producto");
  }
  return mapRow(data as Parameters<typeof mapRow>[0]);
}

export async function batchUpdateAdminCatalogProducts(input: {
  ids: string[];
  activo?: unknown;
  categoria?: unknown;
}): Promise<{ updated: number }> {
  const ids = Array.from(new Set(input.ids.map((id) => id.trim()).filter(Boolean))).slice(0, BATCH_MAX);
  if (ids.length === 0) {
    throw new Error("No hay productos seleccionados");
  }
  const patch: { activo?: boolean; categoria?: string } = {};
  if (input.activo !== undefined) {
    if (typeof input.activo !== "boolean") {
      throw new Error("Estado inválido");
    }
    patch.activo = input.activo;
  }
  if (input.categoria !== undefined) {
    const categoria = String(input.categoria ?? "").trim();
    if (!categoria) {
      throw new Error("La categoría no puede quedar vacía");
    }
    patch.categoria = categoria;
  }
  if (Object.keys(patch).length === 0) {
    throw new Error("Nada que actualizar");
  }

  const supabase = getSupabaseAdminClient();
  let updated = 0;
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const { error, count } = await supabase
      .from("products")
      .update(patch, { count: "exact" })
      .in("id", chunk);
    if (error) {
      throw error;
    }
    updated += count ?? chunk.length;
  }
  return { updated };
}
