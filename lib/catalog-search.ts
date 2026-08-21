import type { Product } from "@/lib/types";

export const SEARCH_SUGGESTION_MIN_CHARS = 2;
export const SEARCH_SUGGESTION_LIMIT = 6;
export const SEARCH_DEBOUNCE_MS = 250;

export function productAnchor(productId: string): string {
  return `product-${productId}`;
}

function suggestionRank(product: Product, query: string): number {
  const nombre = product.nombre.toLowerCase();
  const marca = (product.marca ?? "").toLowerCase();
  const categoria = product.categoria.toLowerCase();
  const descripcion = (product.descripcion ?? "").toLowerCase();

  if (nombre.startsWith(query)) {
    return 0;
  }
  if (nombre.includes(query)) {
    return 1;
  }
  if (marca.startsWith(query)) {
    return 2;
  }
  if (marca.includes(query)) {
    return 3;
  }
  if (categoria.includes(query)) {
    return 4;
  }
  if (descripcion.includes(query)) {
    return 5;
  }
  return Number.POSITIVE_INFINITY;
}

export function rankSearchSuggestions(
  products: Product[],
  rawQuery: string,
  limit = SEARCH_SUGGESTION_LIMIT
): Product[] {
  const query = rawQuery.trim().toLowerCase();
  if (query.length < SEARCH_SUGGESTION_MIN_CHARS) {
    return [];
  }

  return products
    .map((product) => ({ product, rank: suggestionRank(product, query) }))
    .filter((item) => Number.isFinite(item.rank))
    .sort((a, b) => a.rank - b.rank || a.product.nombre.localeCompare(b.product.nombre, "es"))
    .slice(0, limit)
    .map((item) => item.product);
}
