import { normalizeCategoryKey } from "@/lib/theme";
import type { Product } from "@/lib/types";

export const CATALOG_COLLECTION_RAIL_LIMIT = 10;
export const CATALOG_COLLECTION_RECENT_DAYS = 30;

export type CatalogCollectionMatch =
  | { kind: "keywords"; keys: string[] }
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

export type CatalogCollectionProduct = {
  nombre?: string | null;
  marca?: string | null;
  categoria?: string | null;
  descripcion?: string | null;
};

export const CATALOG_COLLECTIONS: CatalogCollectionDef[] = [
  {
    id: "desayuno",
    title: "Para el desayuno",
    subtitle: "Café, leche, pan y lo que se pide a primera hora",
    match: {
      kind: "keywords",
      keys: [
        "desayuno",
        "cereal",
        "avena",
        "granola",
        "leche",
        "yogurt",
        "yogur",
        "cafe",
        "azucar",
        "mantequilla",
        "mermelada",
        "pan de",
        "panader",
        "huevo",
        "jugo",
        "queso crema",
        "cocoa",
        "chocolate en polvo",
        "galleta maria",
        "soda cracker",
      ],
    },
  },
  {
    id: "picar",
    title: "Para picar",
    subtitle: "Snacks, chips y antojos del residencial",
    match: {
      kind: "keywords",
      keys: [
        "snack",
        "pasaboca",
        "chips",
        "cheeto",
        "dorito",
        "ruffle",
        "pringles",
        "galleta",
        "chocolate",
        "dulce",
        "caramelo",
        "chicle",
        "mani",
        "nacho",
        "oreo",
        "gomita",
        "palomita",
      ],
    },
  },
  {
    id: "cocinar",
    title: "Para cocinar",
    subtitle: "Aceites, granos y lo básico de la cocina",
    match: {
      kind: "keywords",
      keys: [
        "aceite",
        "grasa",
        "arroz",
        "pasta",
        "fideo",
        "spaghetti",
        "habichuela",
        "frijol",
        "lenteja",
        "atun",
        "enlatad",
        "salsa de tomate",
        "condimento",
        "sal",
        "azucar",
      ],
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

function collectionHaystack(product: CatalogCollectionProduct): string {
  return normalizeCategoryKey(
    [product.nombre, product.marca, product.categoria, product.descripcion].filter(Boolean).join(" ")
  );
}

function haystackHasKey(haystack: string, key: string): boolean {
  const normalizedKey = normalizeCategoryKey(key);
  if (!normalizedKey) {
    return false;
  }
  if (normalizedKey.length >= 4) {
    return haystack.includes(normalizedKey);
  }
  return haystack.split(/\s+/).includes(normalizedKey);
}

export function categoryMatchesCollection(categoria: string, def: CatalogCollectionDef): boolean {
  if (def.match.kind !== "keywords") {
    return false;
  }
  const normalized = normalizeCategoryKey(categoria);
  if (!normalized) {
    return false;
  }
  return def.match.keys.some((key) => haystackHasKey(normalized, key));
}

export function productMatchesCollection(
  product: CatalogCollectionProduct,
  def: CatalogCollectionDef
): boolean {
  if (def.match.kind !== "keywords") {
    return false;
  }
  const haystack = collectionHaystack(product);
  if (!haystack) {
    return false;
  }
  return def.match.keys.some((key) => haystackHasKey(haystack, key));
}
