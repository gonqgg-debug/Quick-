"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchCatalogProductsPage } from "@/lib/catalog-products-client";
import type { CatalogCategoryChip } from "@/lib/catalog-products-shared";
import type { Product } from "@/lib/types";

export function useCatalogProductPages({
  sessionId,
  categoria,
  q,
  enabled,
  onProducts,
  onCategories,
}: {
  sessionId: string;
  categoria: string | null;
  q: string;
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
          q,
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
  }, [sessionId, categoria, q, enabled]);

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
          q,
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
  }, [sessionId, categoria, q, enabled]);

  return { products, hasMore, loading, loadingMore, error, loadMore };
}
