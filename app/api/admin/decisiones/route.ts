import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { handleListarDecisiones, operacionError } from "@/lib/operacion-http";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }
  try {
    return await handleListarDecisiones();
  } catch (error) {
    return operacionError(error, "No pudimos leer las decisiones", "[admin] decisiones");
  }
}
