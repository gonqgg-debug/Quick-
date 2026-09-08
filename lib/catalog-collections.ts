import {
  filterCollectionProducts,
  type CatalogCollectionRail,
} from "@/lib/catalog-collections-shared";
import { toMoney } from "@/lib/money";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type { Product } from "@/lib/types";

export {
  filterCollectionProducts,
  getCatalogCollection,
  type CatalogCollectionRail,
} from "@/lib/catalog-collections-shared";

const PRODUCT_SELECT = "id, nombre, marca, descripcion, precio, foto_url, categoria";

type ProductRow = {
  id: unknown;
  nombre: unknown;
  marca?: unknown;
  descripcion?: unknown;
  precio: unknown;
  foto_url?: unknown;
  categoria: unknown;
  activo?: unknown;
};

type CollectionRow = {
  id: unknown;
  slug: unknown;
  nombre: unknown;
  descripcion: unknown;
  orden: unknown;
  home_coleccion_productos?: CollectionProductRow[] | null;
};

type CollectionProductRow = {
  orden: unknown;
  product_id?: unknown;
  products?: ProductRow | ProductRow[] | null;
};

function mapProduct(row: ProductRow): Product | null {
  const id = String(row.id ?? "").trim();
  if (!id) {
    return null;
  }
  if (row.activo === false) {
    return null;
  }
  return {
    id,
    nombre: String(row.nombre ?? ""),
    marca: row.marca ? String(row.marca) : null,
    descripcion: row.descripcion ? String(row.descripcion) : null,
    precio: toMoney(row.precio),
    foto_url: row.foto_url ? String(row.foto_url) : null,
    categoria: String(row.categoria ?? ""),
  };
}

function unwrapProduct(value: ProductRow | ProductRow[] | null | undefined): ProductRow | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

function sortMembership<T extends { orden: unknown }>(rows: T[]): T[] {
  return [...rows].sort((left, right) => Number(left.orden ?? 0) - Number(right.orden ?? 0));
}

function mapCollection(row: CollectionRow, products: Product[]): CatalogCollectionRail {
  return {
    id: String(row.slug ?? ""),
    title: String(row.nombre ?? ""),
    subtitle: String(row.descripcion ?? ""),
    products,
  };
}

async function listCollectionsFallback(): Promise<CatalogCollectionRail[]> {
  const supabase = getSupabaseAdminClient();
  const { data: colecciones, error } = await supabase
    .from("home_colecciones")
    .select("id, slug, nombre, descripcion, orden")
    .eq("activa", true)
    .order("orden", { ascending: true });

  if (error || !colecciones?.length) {
    if (error) {
      console.error("[catalog] home_colecciones", error);
    }
    return [];
  }

  const collectionIds = colecciones.map((row) => String(row.id));
  const { data: links, error: linksError } = await supabase
    .from("home_coleccion_productos")
    .select("coleccion_id, product_id, orden")
    .in("coleccion_id", collectionIds)
    .order("orden", { ascending: true });

  if (linksError) {
    console.error("[catalog] home_coleccion_productos", linksError);
    return colecciones.map((row) => mapCollection(row, []));
  }

  const productIds = Array.from(
    new Set((links ?? []).map((link) => String(link.product_id ?? "")).filter(Boolean))
  );
  const productsById = new Map<string, Product>();
  if (productIds.length > 0) {
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select(PRODUCT_SELECT)
      .eq("activo", true)
      .in("id", productIds);
    if (productsError) {
      console.error("[catalog] home collection products", productsError);
    } else {
      for (const row of products ?? []) {
        const product = mapProduct(row);
        if (product) {
          productsById.set(product.id, product);
        }
      }
    }
  }

  const linksByCollection = new Map<string, { product_id: string; orden: number }[]>();
  for (const link of links ?? []) {
    const collectionId = String(link.coleccion_id ?? "");
    const productId = String(link.product_id ?? "");
    if (!collectionId || !productId) {
      continue;
    }
    const current = linksByCollection.get(collectionId) ?? [];
    current.push({ product_id: productId, orden: Number(link.orden ?? 0) });
    linksByCollection.set(collectionId, current);
  }

  return colecciones.map((row) => {
    const membership = sortMembership(linksByCollection.get(String(row.id)) ?? []);
    const products = membership
      .map((item) => productsById.get(item.product_id))
      .filter((product): product is Product => Boolean(product));
    return mapCollection(row, products);
  });
}

export async function getCatalogCollections(): Promise<CatalogCollectionRail[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("home_colecciones")
    .select(
      `
      id, slug, nombre, descripcion, orden,
      home_coleccion_productos (
        orden,
        products ( id, nombre, marca, descripcion, precio, foto_url, categoria, activo )
      )
    `
    )
    .eq("activa", true)
    .order("orden", { ascending: true })
    .order("orden", { referencedTable: "home_coleccion_productos", ascending: true });

  if (error || !data) {
    if (error) {
      console.error("[catalog] home_colecciones nested", error);
    }
    return listCollectionsFallback();
  }

  return (data as CollectionRow[]).map((row) => {
    const products = sortMembership(row.home_coleccion_productos ?? [])
      .map((item) => {
        const productRow = unwrapProduct(item.products);
        return productRow ? mapProduct(productRow) : null;
      })
      .filter((product): product is Product => Boolean(product));
    return mapCollection(row, products);
  });
}

export async function listHomeCollectionProducts(options: {
  slug: string;
  q?: string;
}): Promise<Product[]> {
  const supabase = getSupabaseAdminClient();
  const { data: collection, error } = await supabase
    .from("home_colecciones")
    .select("id")
    .eq("slug", options.slug)
    .eq("activa", true)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!collection) {
    return [];
  }

  const { data: links, error: linksError } = await supabase
    .from("home_coleccion_productos")
    .select("product_id, orden")
    .eq("coleccion_id", collection.id)
    .order("orden", { ascending: true });

  if (linksError) {
    throw linksError;
  }

  const productIds = (links ?? [])
    .map((link) => String(link.product_id ?? ""))
    .filter(Boolean);
  if (productIds.length === 0) {
    return [];
  }

  const { data: rows, error: productsError } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("activo", true)
    .in("id", productIds);

  if (productsError) {
    throw productsError;
  }

  const byId = new Map<string, Product>();
  for (const row of rows ?? []) {
    const product = mapProduct(row);
    if (product) {
      byId.set(product.id, product);
    }
  }

  return filterCollectionProducts(
    productIds.map((id) => byId.get(id)).filter((product): product is Product => Boolean(product)),
    options.q ?? ""
  );
}
