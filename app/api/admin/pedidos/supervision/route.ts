import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { loadPedidosSupervision } from "@/lib/admin-pedidos-supervision";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const data = await loadPedidosSupervision();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[admin] pedidos supervision", error);
    const message = error instanceof Error ? error.message : "No pudimos cargar la supervisión";
    return NextResponse.json({ error: message || "No pudimos cargar la supervisión" }, { status: 500 });
  }
}
