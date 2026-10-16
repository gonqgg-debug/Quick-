import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import {
  listAdminCatalogProductIds,
  listAdminCatalogProductMeta,
  listAdminCatalogProducts,
  parseCatalogProductFilters,
  resumenComercialProductos,
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
    const params = request.nextUrl.searchParams;
    if (params.get("ids") === "1") {
      const ids = await listAdminCatalogProductIds(filters);
      return NextResponse.json({ ids, total: ids.length });
    }
    const parte = params.get("parte");
    if (parte === "meta") {
      return NextResponse.json(await listAdminCatalogProductMeta(filters));
    }
    if (parte === "comercial") {
      const ids = (params.get("ids") ?? "").split(",").map((id) => id.trim()).filter(Boolean);
      return NextResponse.json({ productos: await resumenComercialProductos(ids) });
    }
    const result = await listAdminCatalogProducts(filters, parte === "lista" ? { comercial: false, meta: false } : {});
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
      descripcion?: unknown;
      marca?: unknown;
      categoria?: unknown;
      precio?: unknown;
      costo?: unknown;
      tasaItbis?: unknown;
      activo?: unknown;
    };
    if (typeof body.id !== "string" || !body.id) {
      return NextResponse.json({ error: "Falta el producto" }, { status: 400 });
    }
    const product = await updateAdminCatalogProduct({
      id: body.id,
      nombre: body.nombre,
      descripcion: body.descripcion,
      marca: body.marca,
      categoria: body.categoria,
      precio: body.precio,
      costo: body.costo,
      tasaItbis: body.tasaItbis,
      activo: body.activo,
    });
    return NextResponse.json({ product });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos guardar";
    console.error("[admin] catalog product update", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
