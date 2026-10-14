import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { handleQuitarPago, operacionError } from "@/lib/operacion-http";

export const dynamic = "force-dynamic";

export async function DELETE(_request: NextRequest, { params }: { params: { id: string; pagoId: string } }) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }
  try {
    return await handleQuitarPago(params.id, params.pagoId, "admin");
  } catch (error) {
    return operacionError(error, "No pudimos quitar el pago", "[admin] pagos");
  }
}
