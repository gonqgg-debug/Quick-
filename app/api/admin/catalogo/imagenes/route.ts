import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { getCatalogImageStats, listCatalogImageQueue } from "@/lib/product-images";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const [stats, queue] = await Promise.all([getCatalogImageStats(), listCatalogImageQueue(60)]);
    return NextResponse.json({ stats, queue });
  } catch (error) {
    console.error("[admin] catalog images list", error);
    return NextResponse.json({ error: "No pudimos cargar las imágenes" }, { status: 500 });
  }
}
