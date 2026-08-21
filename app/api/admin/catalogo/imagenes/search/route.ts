import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { searchCatalogImageCandidates } from "@/lib/product-images";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const body = (await request.json()) as { query?: unknown };
    const query = typeof body.query === "string" ? body.query : "";
    const images = await searchCatalogImageCandidates(query);
    return NextResponse.json({ images });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos buscar imágenes";
    console.error("[admin] catalog images search", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
