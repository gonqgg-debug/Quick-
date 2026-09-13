import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { updateCompra, type CompraInput } from "@/lib/admin-compras";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  let body: CompraInput;
  try {
    body = (await request.json()) as CompraInput;
  } catch {
    return NextResponse.json({ error: "El cuerpo no es un JSON válido." }, { status: 400 });
  }

  try {
    const compra = await updateCompra(params.id, body);
    return NextResponse.json({ compra });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos guardar la compra";
    console.error("[admin] compras update", error);
    const status = message.includes("No encontramos") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
