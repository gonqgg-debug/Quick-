import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { countPendingProductRequests, listProductRequests } from "@/lib/product-requests";
import { isProductRequestEstado } from "@/lib/product-requests-shared";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const countOnly = request.nextUrl.searchParams.get("countOnly") === "1";
  const estadoRaw = request.nextUrl.searchParams.get("estado")?.trim() ?? "pendiente";
  const estado = estadoRaw === "todos" || isProductRequestEstado(estadoRaw) ? estadoRaw : "pendiente";

  try {
    const pendingCount = await countPendingProductRequests();
    if (countOnly) {
      return NextResponse.json({ pendingCount });
    }
    const requests = await listProductRequests(estado);
    return NextResponse.json({ requests, pendingCount });
  } catch (error) {
    console.error("[admin] product requests list", error);
    return NextResponse.json({ error: "No pudimos cargar las solicitudes" }, { status: 500 });
  }
}
