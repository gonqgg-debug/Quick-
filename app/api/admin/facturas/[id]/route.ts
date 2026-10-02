import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { facturasError, handleAdminPatch, handleGetFactura } from "@/lib/contabilidad/facturas-http";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }
  try {
    return await handleGetFactura(params.id);
  } catch (error) {
    return facturasError(error, "No pudimos abrir la factura", "[admin] factura");
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }
  try {
    return await handleAdminPatch(params.id, request);
  } catch (error) {
    return facturasError(error, "No pudimos guardar la factura", "[admin] factura update");
  }
}
