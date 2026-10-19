import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { consultarHorarios } from "@/lib/pos-consumo";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await requireAdminApi();
  if (admin instanceof NextResponse) return admin;
  try {
    return NextResponse.json(await consultarHorarios(request.nextUrl.searchParams));
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos cargar los horarios";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
