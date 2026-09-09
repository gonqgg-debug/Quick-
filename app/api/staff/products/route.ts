import { NextRequest, NextResponse } from "next/server";
import { listActiveProductsPage, listCatalogSearchSuggestions } from "@/lib/catalog";
import { isStaffAuthorized, unauthorized } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isStaffAuthorized()) {
    return unauthorized();
  }

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  try {
    if (q.length >= 2) {
      const products = await listCatalogSearchSuggestions(q);
      return NextResponse.json({ products });
    }
    const page = await listActiveProductsPage({ limit: 20, sort: "popular" });
    return NextResponse.json({ products: page.products });
  } catch (error) {
    console.error("[staff] no se pudieron buscar productos", error);
    return NextResponse.json({ error: "No pudimos buscar productos" }, { status: 500 });
  }
}
