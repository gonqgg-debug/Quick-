import { NextRequest, NextResponse } from "next/server";
import { adminGreetingName, requireAdminApi } from "@/lib/admin-auth";
import { facturasError, handleGuardarPresentacion, handleListarPresentaciones } from "@/lib/facturas-http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }
  try {
    return await handleListarPresentaciones(request);
  } catch (error) {
    return facturasError(error, "No pudimos leer las equivalencias", "[admin] presentaciones");
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }
  try {
    return await handleGuardarPresentacion(request, "admin", adminGreetingName(auth));
  } catch (error) {
    return facturasError(error, "No pudimos guardar la presentación", "[admin] presentaciones");
  }
}
