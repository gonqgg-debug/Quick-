import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { consultarProducto } from "@/lib/pos-consumo";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await requireAdminApi();
  if (admin instanceof NextResponse) return admin;
  const codigo = (request.nextUrl.searchParams.get("codigo") ?? "").trim();
  if (!codigo) return NextResponse.json({ error: "Falta el producto" }, { status: 400 });
  try {
    return NextResponse.json(await consultarProducto(codigo, request.nextUrl.searchParams));
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos cargar el producto";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
