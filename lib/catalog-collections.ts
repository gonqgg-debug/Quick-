import {
  CATALOG_COLLECTION_RAIL_LIMIT,
  CATALOG_COLLECTION_RECENT_DAYS,
  CATALOG_COLLECTIONS,
  getCatalogCollection,
  productMatchesCollection,
  type CatalogCollectionRail,
} from "@/lib/catalog-collections-shared";
import { getSalesTotalsByOdooCode } from "@/lib/catalog-ranking";
import { toMoney } from "@/lib/money";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type { Product } from "@/lib/types";

export {
  CATALOG_COLLECTION_RAIL_LIMIT,
  CATALOG_COLLECTION_RECENT_DAYS,
  CATALOG_COLLECTIONS,
  categoryMatchesCollection,
  getCatalogCollection,
  productMatchesCollection,
  type CatalogCollectionDef,
  type CatalogCollectionMatch,
  type CatalogCollectionRail,
} from "@/lib/catalog-collections-shared";

const PRODUCT_SELECT = "id, nombre, marca, descripcion, precio, foto_url, categoria, codigo_odoo, created_at";

type ProductRow = {
  id: unknown;
  nombre: unknown;
  marca?: unknown;
  descripcion?: unknown;
  precio: unknown;
  foto_url?: unknown;
  categoria: unknown;
  codigo_odoo?: unknown;
  created_at?: unknown;
};

function mapProduct(row: ProductRow): Product {
  return {
    id: String(row.id),
    nombre: String(row.nombre ?? ""),
    marca: row.marca ? String(row.marca) : null,
    descripcion: row.descripcion ? String(row.descripcion) : null,
    precio: toMoney(row.precio),
    foto_url: row.foto_url ? String(row.foto_url) : null,
    categoria: String(row.categoria ?? ""),
  };
}

function sortByPopularity(rows: ProductRow[], sales: Map<string, number>): ProductRow[] {
  return [...rows].sort((left, right) => {
    const leftSold = sales.get(String(left.codigo_odoo ?? "").trim()) ?? 0;
    const rightSold = sales.get(String(right.codigo_odoo ?? "").trim()) ?? 0;
    if (rightSold !== leftSold) {
      return rightSold - leftSold;
    }
    return String(left.nombre ?? "").localeCompare(String(right.nombre ?? ""), "es");
  });
}

function uniqueCategories(rows: ProductRow[]): string[] {
  const names = new Set<string>();
  for (const row of rows) {
    const name = String(row.categoria ?? "").trim();
    if (name) {
      names.add(name);
    }
  }
  return Array.from(names);
}

function isRecentProduct(row: ProductRow, now = Date.now()): boolean {
  const created = new Date(String(row.created_at ?? "")).getTime();
  if (!Number.isFinite(created)) {
    return false;
  }
  return now - created <= CATALOG_COLLECTION_RECENT_DAYS * 24 * 60 * 60 * 1000;
}

export async function listCollectionCategoryNames(collectionId: string): Promise<string[]> {
  const def = getCatalogCollection(collectionId);
  if (!def || def.match.kind !== "keywords") {
    return [];
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("products")
    .select("nombre, marca, categoria, descripcion")
    .eq("activo", true);
  if (error || !data) {
    return [];
  }

  const names = new Set<string>();
  for (const row of data) {
    if (productMatchesCollection(row, def)) {
      const name = String(row.categoria ?? "").trim();
      if (name) {
        names.add(name);
      }
    }
  }
  return Array.from(names);
}

export async function getCatalogCollections(): Promise<CatalogCollectionRail[]> {
  const supabase = getSupabaseAdminClient();
  const [{ data, error }, sales] = await Promise.all([
    supabase.from("products").select(PRODUCT_SELECT).eq("activo", true).limit(1000),
    getSalesTotalsByOdooCode(),
  ]);

  if (error || !data?.length) {
    return [];
  }

  const now = Date.now();
  return CATALOG_COLLECTIONS.map((def) => {
    if (def.match.kind === "recency") {
      const recent = [...data]
        .filter((row) => isRecentProduct(row, now))
        .sort(
          (left, right) =>
            new Date(String(right.created_at ?? "")).getTime() -
            new Date(String(left.created_at ?? "")).getTime()
        );
      if (recent.length < 3) {
        return null;
      }
      return {
        ...def,
        products: recent.slice(0, CATALOG_COLLECTION_RAIL_LIMIT).map(mapProduct),
        categoryNames: [],
      } satisfies CatalogCollectionRail;
    }

    const matched = sortByPopularity(
      data.filter((row) => productMatchesCollection(row, def)),
      sales
    );
    if (matched.length === 0) {
      return null;
    }

    return {
      ...def,
      products: matched.slice(0, CATALOG_COLLECTION_RAIL_LIMIT).map(mapProduct),
      categoryNames: uniqueCategories(matched),
    } satisfies CatalogCollectionRail;
  }).filter((rail): rail is CatalogCollectionRail => Boolean(rail));
}
