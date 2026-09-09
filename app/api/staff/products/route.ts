import { NextRequest, NextResponse } from "next/server";
import { listCatalogSearchSuggestions } from "@/lib/catalog";
import { SEARCH_SUGGESTION_MIN_CHARS } from "@/lib/catalog-search";
import { isStaffAuthorized, unauthorized } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isStaffAuthorized()) {
    return unauthorized();
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  try {
    if (q.length < SEARCH_SUGGESTION_MIN_CHARS) {
      return NextResponse.json({ products: [] });
    }
    const products = await listCatalogSearchSuggestions(q);
    return NextResponse.json({ products });
  } catch (error) {
    console.error("[staff] no se pudieron buscar productos", error);
    return NextResponse.json({ error: "No pudimos buscar productos" }, { status: 500 });
  }
}
