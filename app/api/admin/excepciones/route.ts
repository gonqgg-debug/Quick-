import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { handleListarExcepciones, operacionError } from "@/lib/operacion-http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }
  try {
    return await handleListarExcepciones(request);
  } catch (error) {
    return operacionError(error, "No pudimos leer las excepciones", "[admin] excepciones");
  }
}
