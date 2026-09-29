import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { listPosAdvertencias } from "@/lib/pos-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }
  try {
    const advertencias = await listPosAdvertencias();
    return NextResponse.json({ advertencias });
  } catch (error) {
    console.error("[admin] no se pudieron leer las advertencias de cobro", error);
    return NextResponse.json({ error: "No pudimos cargar las advertencias" }, { status: 500 });
  }
}
