import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import {
  listAdminCatalogProductIds,
  listAdminCatalogProducts,
  parseCatalogProductFilters,
  updateAdminCatalogProduct,
} from "@/lib/admin-catalog-products";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const filters = parseCatalogProductFilters(request.nextUrl.searchParams);
    if (request.nextUrl.searchParams.get("ids") === "1") {
      const ids = await listAdminCatalogProductIds(filters);
      return NextResponse.json({ ids, total: ids.length });
    }
    const result = await listAdminCatalogProducts(filters);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[admin] catalog products list", error);
    return NextResponse.json({ error: "No pudimos cargar los productos" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const body = (await request.json()) as {
      id?: unknown;
      nombre?: unknown;
      marca?: unknown;
      categoria?: unknown;
      precio?: unknown;
      activo?: unknown;
    };
    if (typeof body.id !== "string" || !body.id) {
      return NextResponse.json({ error: "Falta el producto" }, { status: 400 });
    }
    const product = await updateAdminCatalogProduct({
      id: body.id,
      nombre: body.nombre,
      marca: body.marca,
      categoria: body.categoria,
      precio: body.precio,
      activo: body.activo,
    });
    return NextResponse.json({ product });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos guardar";
    console.error("[admin] catalog product update", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
