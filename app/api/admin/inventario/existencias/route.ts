import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { inventarioError } from "@/lib/inventario/http";
import { guardarPuntoReorden, listarExistencias } from "@/lib/inventario/movimientos";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }
  try {
    const params = request.nextUrl.searchParams;
    const page = await listarExistencias({
      tienda: params.get("tienda") ?? "quick",
      q: params.get("q") ?? "",
      bajoMinimo: params.get("bajoMinimo") === "true",
      cursor: params.get("cursor") ?? "",
    });
    return NextResponse.json(page);
  } catch (error) {
    return inventarioError(error, "No pudimos leer las existencias", "[admin] existencias");
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }
  try {
    const body = (await request.json()) as { productoId?: unknown; tienda?: unknown; puntoReorden?: unknown };
    if (typeof body.productoId !== "string" || !body.productoId) {
      return NextResponse.json({ error: "Falta el producto" }, { status: 400 });
    }
    const punto = typeof body.puntoReorden === "number" ? body.puntoReorden : Number(body.puntoReorden);
    const existencia = await guardarPuntoReorden(body.productoId, body.tienda, punto);
    return NextResponse.json({ existencia });
  } catch (error) {
    return inventarioError(error, "No pudimos guardar el punto de reorden", "[admin] existencias");
  }
}
