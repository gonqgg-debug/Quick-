import {
  CATALOG_COLLECTION_RAIL_LIMIT,
  CATALOG_COLLECTIONS,
  categoryMatchesCollection,
  getCatalogCollection,
  type CatalogCollectionRail,
} from "@/lib/catalog-collections-shared";
import { getSalesTotalsByOdooCode } from "@/lib/catalog-ranking";
import { toMoney } from "@/lib/money";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type { Product } from "@/lib/types";

export {
  CATALOG_COLLECTION_RAIL_LIMIT,
  CATALOG_COLLECTIONS,
  categoryMatchesCollection,
  getCatalogCollection,
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

export async function listCollectionCategoryNames(collectionId: string): Promise<string[]> {
  const def = getCatalogCollection(collectionId);
  if (!def || def.match.kind !== "categories") {
    return [];
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("products").select("categoria").eq("activo", true);
  if (error || !data) {
    return [];
  }

  const names = new Set<string>();
  for (const row of data) {
    const name = String(row.categoria ?? "").trim();
    if (name && categoryMatchesCollection(name, def)) {
      names.add(name);
    }
  }
  return Array.from(names);
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

export async function getCatalogCollections(): Promise<CatalogCollectionRail[]> {
  const supabase = getSupabaseAdminClient();
  const [sales, categoryNamesById] = await Promise.all([
    getSalesTotalsByOdooCode(),
    Promise.all(
      CATALOG_COLLECTIONS.filter((collection) => collection.match.kind === "categories").map(
        async (collection) => [collection.id, await listCollectionCategoryNames(collection.id)] as const
      )
    ),
  ]);
  const categoryMap = new Map(categoryNamesById);

  const rails = await Promise.all(
    CATALOG_COLLECTIONS.map(async (def) => {
      if (def.match.kind === "recency") {
        const { data, error } = await supabase
          .from("products")
          .select(PRODUCT_SELECT)
          .eq("activo", true)
          .order("created_at", { ascending: false })
          .order("id", { ascending: true })
          .limit(CATALOG_COLLECTION_RAIL_LIMIT);
        if (error || !data?.length) {
          return null;
        }
        return {
          ...def,
          products: data.map(mapProduct),
          categoryNames: [],
        } satisfies CatalogCollectionRail;
      }

      const categoryNames = categoryMap.get(def.id) ?? [];
      if (categoryNames.length === 0) {
        return null;
      }

      const { data, error } = await supabase
        .from("products")
        .select(PRODUCT_SELECT)
        .eq("activo", true)
        .in("categoria", categoryNames)
        .limit(80);
      if (error || !data?.length) {
        return null;
      }

      return {
        ...def,
        products: sortByPopularity(data, sales).slice(0, CATALOG_COLLECTION_RAIL_LIMIT).map(mapProduct),
        categoryNames,
      } satisfies CatalogCollectionRail;
    })
  );

  return rails.filter((rail): rail is CatalogCollectionRail => Boolean(rail));
}
