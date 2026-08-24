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
    const message =
      error && typeof error === "object" && "message" in error && typeof error.message === "string" && error.message
        ? error.message
        : error instanceof Error
          ? error.message
          : "No pudimos cargar la supervisión";
    console.error("[admin] pedidos supervision", error);
    return NextResponse.json({ error: message || "No pudimos cargar la supervisión" }, { status: 500 });
  }
}
