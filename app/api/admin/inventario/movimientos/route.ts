import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { inventarioError } from "@/lib/inventario/http";
import { listarMovimientos } from "@/lib/inventario/movimientos";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }
  try {
    const params = request.nextUrl.searchParams;
    const page = await listarMovimientos({
      tienda: params.get("tienda") ?? "quick",
      productoId: params.get("productoId") ?? "",
      tipo: params.get("tipo") ?? "",
      desde: params.get("desde") ?? "",
      hasta: params.get("hasta") ?? "",
      cursor: params.get("cursor") ?? "",
    });
    return NextResponse.json(page);
  } catch (error) {
    return inventarioError(error, "No pudimos leer los movimientos", "[admin] movimientos");
  }
}
