import type { CatalogCategoryChip, CatalogProductsPage } from "@/lib/catalog-products-shared";
import { CATALOG_PRODUCT_PAGE_SIZE } from "@/lib/catalog-products-shared";
import type { Product } from "@/lib/types";

export async function fetchCatalogProductsPage(options: {
  sessionId: string;
  cursor?: string | null;
  categoria?: string | null;
  q?: string | null;
  limit?: number;
  signal?: AbortSignal;
}): Promise<CatalogProductsPage> {
  const params = new URLSearchParams({ sessionId: options.sessionId });
  params.set("limit", String(options.limit ?? CATALOG_PRODUCT_PAGE_SIZE));
  if (options.cursor) {
    params.set("cursor", options.cursor);
  }
  if (options.categoria) {
    params.set("categoria", options.categoria);
  }
  const q = options.q?.trim() ?? "";
  if (q) {
    params.set("q", q);
  }

  const response = await fetch(`/api/catalog/products?${params.toString()}`, {
    signal: options.signal,
  });
  const body = (await response.json().catch(() => ({}))) as Partial<CatalogProductsPage> & {
    error?: string;
  };
  if (!response.ok || !Array.isArray(body.products)) {
    throw new Error(body.error ?? "No pudimos cargar los productos.");
  }

  return {
    products: body.products,
    hasMore: Boolean(body.hasMore),
    nextCursor: body.nextCursor ?? null,
    categories: body.categories,
  };
}

export async function fetchCatalogProductsByIds(options: {
  sessionId: string;
  ids: string[];
  signal?: AbortSignal;
}): Promise<Product[]> {
  const unique = Array.from(new Set(options.ids.filter(Boolean)));
  if (unique.length === 0) {
    return [];
  }
  const params = new URLSearchParams({ sessionId: options.sessionId, ids: unique.join(",") });
  const response = await fetch(`/api/catalog/products?${params.toString()}`, {
    signal: options.signal,
  });
  const body = (await response.json().catch(() => ({}))) as { products?: Product[]; error?: string };
  if (!response.ok || !Array.isArray(body.products)) {
    throw new Error(body.error ?? "No pudimos cargar los productos.");
  }
  return body.products;
}

export async function fetchCatalogSearchSuggestions(options: {
  sessionId: string;
  q: string;
  signal?: AbortSignal;
}): Promise<Product[]> {
  const params = new URLSearchParams({
    sessionId: options.sessionId,
    q: options.q,
    suggestions: "1",
  });
  const response = await fetch(`/api/catalog/products?${params.toString()}`, {
    signal: options.signal,
  });
  const body = (await response.json().catch(() => ({}))) as { products?: Product[]; error?: string };
  if (!response.ok || !Array.isArray(body.products)) {
    return [];
  }
  return body.products;
}

export type { CatalogCategoryChip };
