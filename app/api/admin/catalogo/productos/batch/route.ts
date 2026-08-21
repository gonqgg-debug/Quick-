import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { batchUpdateAdminCatalogProducts } from "@/lib/admin-catalog-products";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const body = (await request.json()) as { ids?: unknown; activo?: unknown; categoria?: unknown };
    const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === "string" && Boolean(id)) : [];
    const result = await batchUpdateAdminCatalogProducts({
      ids,
      activo: body.activo,
      categoria: body.categoria,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos actualizar";
    console.error("[admin] catalog products batch", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
