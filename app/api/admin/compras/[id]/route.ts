import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { compraFailure, updateCompra } from "@/lib/admin-compras";
import { readCompraBody } from "@/lib/compra-request";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const compra = await updateCompra(params.id, await readCompraBody(request));
    return NextResponse.json({ compra });
  } catch (error) {
    console.error("[admin] compras update", error);
    const failure = compraFailure(error, "No pudimos guardar la compra");
    return NextResponse.json({ error: failure.error, compra: failure.compra }, { status: failure.status });
  }
}
