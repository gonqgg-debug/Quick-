import type { Product } from "@/lib/types";

export type CatalogCollectionRail = {
  id: string;
  title: string;
  subtitle: string;
  products: Product[];
};

export function getCatalogCollection(
  id: string | null | undefined,
  collections: readonly CatalogCollectionRail[]
): CatalogCollectionRail | null {
  if (!id) {
    return null;
  }
  return collections.find((collection) => collection.id === id) ?? null;
}

export function filterCollectionProducts(
  products: Product[],
  q: string
): Product[] {
  const needle = q.trim().toLowerCase();
  if (!needle) {
    return products;
  }
  return products.filter(
    (product) =>
      product.nombre.toLowerCase().includes(needle) ||
      (product.marca ?? "").toLowerCase().includes(needle) ||
      product.categoria.toLowerCase().includes(needle) ||
      (product.descripcion ?? "").toLowerCase().includes(needle)
  );
}
