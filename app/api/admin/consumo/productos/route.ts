import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { consultarProductos } from "@/lib/pos-consumo";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await requireAdminApi();
  if (admin instanceof NextResponse) return admin;
  try {
    const data = await consultarProductos(request.nextUrl.searchParams);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos cargar los productos";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
