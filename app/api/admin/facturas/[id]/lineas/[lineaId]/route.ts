import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { facturasError, handleAsignarProducto } from "@/lib/contabilidad/facturas-http";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: { id: string; lineaId: string } }) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }
  try {
    return await handleAsignarProducto(params.id, params.lineaId, request);
  } catch (error) {
    return facturasError(error, "No pudimos enlazar el producto", "[admin] factura linea");
  }
}
