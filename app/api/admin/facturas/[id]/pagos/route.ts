import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { handleLigarPago, operacionError } from "@/lib/operacion-http";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }
  try {
    return await handleLigarPago(params.id, request, "admin");
  } catch (error) {
    return operacionError(error, "No pudimos ligar el pago", "[admin] pagos");
  }
}
