import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { facturasError, handleGuardarPresentacion } from "@/lib/facturas-http";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }
  try {
    return await handleGuardarPresentacion(request, "admin");
  } catch (error) {
    return facturasError(error, "No pudimos guardar la presentación", "[admin] presentaciones");
  }
}
