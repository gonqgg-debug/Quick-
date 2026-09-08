import type { Product } from "@/lib/types";

export const CATALOG_PRODUCT_PAGE_SIZE = 40;
export const CATALOG_PRODUCT_PAGE_MAX = 80;
export const CATALOG_PRODUCT_IDS_MAX = 80;

export const CATALOG_PRODUCT_SORTS = ["alpha", "popular", "recent"] as const;
export type CatalogProductSort = (typeof CATALOG_PRODUCT_SORTS)[number];

export function parseCatalogProductSort(raw: string | null | undefined): CatalogProductSort | null {
  if (raw === "alpha" || raw === "popular" || raw === "recent") {
    return raw;
  }
  return null;
}

export type CatalogCategoryChip = {
  name: string;
  count: number;
};

export type CatalogProductsPage = {
  products: Product[];
  hasMore: boolean;
  nextCursor: string | null;
  categories?: CatalogCategoryChip[];
};
