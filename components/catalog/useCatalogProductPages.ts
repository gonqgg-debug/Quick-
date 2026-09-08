"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchCatalogProductsPage } from "@/lib/catalog-products-client";
import {
  categoryMatchesCollection,
  getCatalogCollection,
} from "@/lib/catalog-collections-shared";
import type { CatalogCategoryChip, CatalogProductSort } from "@/lib/catalog-products-shared";
import type { Product } from "@/lib/types";

function filterLocalCatalogProducts({
  products,
  categoria,
  collection,
  q,
  sort,
}: {
  products: Product[];
  categoria: string | null;
  collection?: string | null;
  q: string;
  sort?: CatalogProductSort | null;
}): Product[] {
  const needle = q.trim().toLowerCase();
  const def = getCatalogCollection(collection);
  let next = products.filter((product) => {
    if (categoria && product.categoria !== categoria) {
      return false;
    }
    if (!categoria && def?.match.kind === "categories" && !categoryMatchesCollection(product.categoria, def)) {
      return false;
    }
    if (!needle) {
      return true;
    }
    return (
      product.nombre.toLowerCase().includes(needle) ||
      (product.marca ?? "").toLowerCase().includes(needle) ||
      product.categoria.toLowerCase().includes(needle) ||
      (product.descripcion ?? "").toLowerCase().includes(needle)
    );
  });

  if (sort === "alpha" || needle) {
    next = [...next].sort(
      (left, right) =>
        left.categoria.localeCompare(right.categoria, "es") || left.nombre.localeCompare(right.nombre, "es")
    );
  } else if (sort === "recent") {
    next = [...next].reverse();
  }

  return next;
}

export function useCatalogProductPages({
  sessionId,
  categoria,
  collection,
  q,
  sort,
  localProducts,
  enabled,
  onProducts,
  onCategories,
}: {
  sessionId: string;
  categoria: string | null;
  collection?: string | null;
  q: string;
  sort?: CatalogProductSort | null;
  localProducts?: Product[];
  enabled: boolean;
  onProducts?: (products: Product[]) => void;
  onCategories?: (categories: CatalogCategoryChip[]) => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generationRef = useRef(0);
  const nextCursorRef = useRef<string | null>(null);
  const hasMoreRef = useRef(true);
  const loadingRef = useRef(false);
  const loadingMoreRef = useRef(false);

  nextCursorRef.current = nextCursor;
  hasMoreRef.current = hasMore;
  loadingRef.current = loading;
  loadingMoreRef.current = loadingMore;

  const onProductsRef = useRef(onProducts);
  const onCategoriesRef = useRef(onCategories);
  onProductsRef.current = onProducts;
  onCategoriesRef.current = onCategories;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (localProducts) {
      generationRef.current += 1;
      const page = filterLocalCatalogProducts({
        products: localProducts,
        categoria,
        collection,
        q,
        sort,
      });
      setProducts(page);
      setHasMore(false);
      setNextCursor(null);
      setLoading(false);
      setLoadingMore(false);
      setError(null);
      onProductsRef.current?.(page);
      return;
    }

    const generation = ++generationRef.current;
    const controller = new AbortController();
    setProducts([]);
    setNextCursor(null);
    setHasMore(true);
    setLoading(true);
    setLoadingMore(false);
    setError(null);
    loadingMoreRef.current = false;

    void (async () => {
      try {
        const page = await fetchCatalogProductsPage({
          sessionId,
          categoria,
          collection,
          q,
          sort,
          signal: controller.signal,
        });
        if (generation !== generationRef.current) {
          return;
        }
        setProducts(page.products);
        setHasMore(page.hasMore);
        setNextCursor(page.nextCursor);
        onProductsRef.current?.(page.products);
        if (page.categories?.length) {
          onCategoriesRef.current?.(page.categories);
        }
      } catch (caught) {
        if (generation !== generationRef.current || controller.signal.aborted) {
          return;
        }
        setError(caught instanceof Error ? caught.message : "No pudimos cargar los productos.");
        setHasMore(false);
      } finally {
        if (generation === generationRef.current) {
          setLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [sessionId, categoria, collection, q, sort, localProducts, enabled]);

  const loadMore = useCallback(() => {
    if (
      !enabled ||
      loadingRef.current ||
      loadingMoreRef.current ||
      !hasMoreRef.current ||
      !nextCursorRef.current
    ) {
      return;
    }

    const generation = generationRef.current;
    const cursor = nextCursorRef.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);

    void (async () => {
      try {
        const page = await fetchCatalogProductsPage({
          sessionId,
          cursor,
          categoria,
          collection,
          q,
          sort,
        });
        if (generation !== generationRef.current) {
          return;
        }
        setProducts((current) => {
          const seen = new Set(current.map((product) => product.id));
          return [...current, ...page.products.filter((product) => !seen.has(product.id))];
        });
        onProductsRef.current?.(page.products);
        setHasMore(page.hasMore);
        setNextCursor(page.nextCursor);
      } catch (caught) {
        if (generation !== generationRef.current) {
          return;
        }
        setError(caught instanceof Error ? caught.message : "No pudimos cargar más productos.");
      } finally {
        if (generation === generationRef.current) {
          loadingMoreRef.current = false;
          setLoadingMore(false);
        }
      }
    })();
  }, [sessionId, categoria, collection, q, sort, enabled]);

  return { products, hasMore, loading, loadingMore, error, loadMore };
}
