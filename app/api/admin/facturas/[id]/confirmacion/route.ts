import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { handleConfirmacion, operacionError } from "@/lib/operacion-http";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }
  try {
    return await handleConfirmacion(params.id, request, "admin");
  } catch (error) {
    return operacionError(error, "No pudimos guardar la respuesta de la tienda", "[admin] confirmacion");
  }
}
