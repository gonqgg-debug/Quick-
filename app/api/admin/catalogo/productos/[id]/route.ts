import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { getAdminCatalogProduct } from "@/lib/admin-catalog-products";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const detalle = await getAdminCatalogProduct(params.id);
    if (!detalle) {
      return NextResponse.json({ error: "No encontramos el producto" }, { status: 404 });
    }
    return NextResponse.json(detalle);
  } catch (error) {
    console.error("[admin] catalog product", error);
    return NextResponse.json({ error: "No pudimos abrir el producto" }, { status: 500 });
  }
}
