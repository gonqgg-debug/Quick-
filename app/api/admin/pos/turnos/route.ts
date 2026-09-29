import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { listPosTurnos } from "@/lib/pos-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }
  try {
    const turnos = await listPosTurnos();
    return NextResponse.json({ turnos });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos cargar los turnos";
    console.error("[admin] pos turnos", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
