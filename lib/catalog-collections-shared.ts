import { normalizeCategoryKey } from "@/lib/theme";
import type { Product } from "@/lib/types";

export const CATALOG_COLLECTION_RAIL_LIMIT = 10;

export type CatalogCollectionMatch =
  | { kind: "categories"; categoryKeys: string[] }
  | { kind: "recency" };

export type CatalogCollectionDef = {
  id: string;
  title: string;
  subtitle: string;
  match: CatalogCollectionMatch;
};

export type CatalogCollectionRail = CatalogCollectionDef & {
  products: Product[];
  categoryNames: string[];
};

export const CATALOG_COLLECTIONS: CatalogCollectionDef[] = [
  {
    id: "desayuno",
    title: "Para el desayuno",
    subtitle: "Lácteos, cereales y lo esencial para arrancar",
    match: {
      kind: "categories",
      categoryKeys: ["lacteos", "lacteos y derivados", "cereales y desayunos", "desayuno"],
    },
  },
  {
    id: "picar",
    title: "Para picar",
    subtitle: "Snacks y antojos del residencial",
    match: {
      kind: "categories",
      categoryKeys: ["snacks y dulces", "snacks", "dulces"],
    },
  },
  {
    id: "nuevos",
    title: "Recién llegados",
    subtitle: "Lo último que sumamos al minimarket",
    match: { kind: "recency" },
  },
];

export function getCatalogCollection(id: string | null | undefined): CatalogCollectionDef | null {
  if (!id) {
    return null;
  }
  return CATALOG_COLLECTIONS.find((collection) => collection.id === id) ?? null;
}

export function categoryMatchesCollection(categoria: string, def: CatalogCollectionDef): boolean {
  if (def.match.kind !== "categories") {
    return false;
  }
  const normalized = normalizeCategoryKey(categoria);
  if (!normalized) {
    return false;
  }
  return def.match.categoryKeys.some((key) => normalized === key || normalized.includes(key));
}
