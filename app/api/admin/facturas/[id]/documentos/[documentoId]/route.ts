import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { facturasError, handleGetDocumento } from "@/lib/contabilidad/facturas-http";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: { id: string; documentoId: string } }) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }
  try {
    return await handleGetDocumento(params.id, params.documentoId);
  } catch (error) {
    return facturasError(error, "No pudimos abrir la foto", "[admin] factura documento");
  }
}
