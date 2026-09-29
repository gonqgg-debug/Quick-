import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { facturasError, handleAdminFacturas } from "@/lib/contabilidad/facturas-http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }
  try {
    return await handleAdminFacturas(request);
  } catch (error) {
    return facturasError(error, "No pudimos cargar las facturas", "[admin] facturas");
  }
}
