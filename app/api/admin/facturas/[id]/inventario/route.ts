import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { facturasError, handleAplicarInventario } from "@/lib/contabilidad/facturas-http";

export const dynamic = "force-dynamic";

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }
  try {
    return await handleAplicarInventario(params.id, "admin");
  } catch (error) {
    return facturasError(error, "No pudimos aplicar la factura al inventario", "[admin] factura inventario");
  }
}
