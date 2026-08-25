import { NextRequest, NextResponse } from "next/server";
import {
  CatalogCursorError,
  getActiveOrderSession,
  getActiveProductsByIds,
  listActiveCatalogCategories,
  listActiveProductsPage,
  listCatalogSearchSuggestions,
} from "@/lib/catalog";
import {
  CATALOG_PRODUCT_IDS_MAX,
  CATALOG_PRODUCT_PAGE_SIZE,
} from "@/lib/catalog-products-shared";
import { jsonError } from "@/lib/order-request";

export const dynamic = "force-dynamic";

function parseLimit(raw: string | null): number {
  if (!raw) {
    return CATALOG_PRODUCT_PAGE_SIZE;
  }
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value <= 0) {
    return CATALOG_PRODUCT_PAGE_SIZE;
  }
  return value;
}

function parseIds(raw: string | null): string[] {
  if (!raw) {
    return [];
  }
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id.length > 0 && id.length < 80)
    )
  ).slice(0, CATALOG_PRODUCT_IDS_MAX);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const sessionId = params.get("sessionId")?.trim() ?? "";
  if (!sessionId) {
    return jsonError("Falta la sesión.", 400);
  }

  try {
    const session = await getActiveOrderSession(sessionId);
    if (!session) {
      return jsonError("La sesión no es válida. Solicita un enlace nuevo por WhatsApp.", 401);
    }

    const ids = parseIds(params.get("ids"));
    if (ids.length > 0) {
      const products = await getActiveProductsByIds(ids);
      return NextResponse.json({ products });
    }

    const q = params.get("q")?.trim() ?? "";
    if (params.get("suggestions") === "1") {
      const products = await listCatalogSearchSuggestions(q);
      return NextResponse.json({ products });
    }

    const cursor = params.get("cursor");
    const categoria = params.get("categoria");
    const includeCategories = !cursor && !categoria && !q;
    const [page, categories] = await Promise.all([
      listActiveProductsPage({
        cursor,
        limit: parseLimit(params.get("limit")),
        categoria,
        q,
      }),
      includeCategories ? listActiveCatalogCategories() : Promise.resolve(undefined),
    ]);

    return NextResponse.json({
      products: page.products,
      hasMore: page.hasMore,
      nextCursor: page.nextCursor,
      ...(categories ? { categories } : {}),
    });
  } catch (error) {
    if (error instanceof CatalogCursorError) {
      return jsonError(error.message, 400);
    }
    console.error("[catalog] products page", error);
    return jsonError("No pudimos cargar los productos.", 500);
  }
}
