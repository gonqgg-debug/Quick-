import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { markCompraPagada } from "@/lib/admin-compras";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  let body: { pagado?: unknown };
  try {
    body = (await request.json()) as { pagado?: unknown };
  } catch {
    return NextResponse.json({ error: "El cuerpo no es un JSON válido." }, { status: 400 });
  }

  if (body.pagado !== true) {
    return NextResponse.json({ error: "Solo se puede marcar como pagada" }, { status: 400 });
  }

  try {
    const compra = await markCompraPagada(params.id);
    return NextResponse.json({ compra });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos marcar la compra";
    console.error("[admin] compras mark paid", error);
    const status = message.includes("No encontramos") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
