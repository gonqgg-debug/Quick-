import { getSupabaseAdminClient } from "@/lib/supabase";
import { toMoney } from "@/lib/money";
import { parsePrice } from "@/lib/catalog-import";
import type {
  AdminCatalogProduct,
  AdminCatalogProductFilters,
  AdminCatalogProductList,
} from "@/lib/admin-catalog-products-shared";
import { CATALOG_PRODUCTS_PAGE_SIZE } from "@/lib/admin-catalog-products-shared";

export { CATALOG_PRODUCTS_PAGE_SIZE } from "@/lib/admin-catalog-products-shared";
export type {
  AdminCatalogProduct,
  AdminCatalogProductFilters,
  AdminCatalogProductList,
} from "@/lib/admin-catalog-products-shared";

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

export async function listAdminCatalogProducts(
  filters: AdminCatalogProductFilters
): Promise<AdminCatalogProductList> {
  const supabase = getSupabaseAdminClient();
  const pageSize = CATALOG_PRODUCTS_PAGE_SIZE;
  const from = (filters.page - 1) * pageSize;
  const to = from + pageSize - 1;
  const q = sanitizeSearch(filters.q);

  let query = supabase
    .from("products")
    .select("id, nombre, marca, categoria, precio, codigo_odoo, codigo_barras, foto_url, activo", {
      count: "exact",
    })
    .order("nombre", { ascending: true })
    .range(from, to);

  if (q) {
    query = query.or(
      `nombre.ilike.%${q}%,marca.ilike.%${q}%,codigo_odoo.ilike.%${q}%,codigo_barras.ilike.%${q}%`
    );
  }
  if (filters.categoria) {
    query = query.eq("categoria", filters.categoria);
  }
  if (filters.estado === "activo") {
    query = query.eq("activo", true);
  } else if (filters.estado === "inactivo") {
    query = query.eq("activo", false);
  }

  const [{ data, error, count }, { data: categoryRows, error: categoryError }] = await Promise.all([
    query,
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

export async function updateAdminCatalogProduct(input: {
  id: string;
  precio?: unknown;
  activo?: unknown;
}): Promise<AdminCatalogProduct> {
  if (!input.id) {
    throw new Error("Falta el producto");
  }
  const patch: { precio?: number; activo?: boolean } = {};
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
    .select("id, nombre, marca, categoria, precio, codigo_odoo, codigo_barras, foto_url, activo")
    .maybeSingle();
  if (error || !data) {
    throw error ?? new Error("No pudimos guardar el producto");
  }
  return mapRow(data as Parameters<typeof mapRow>[0]);
}
