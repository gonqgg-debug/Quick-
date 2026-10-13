import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { handleCierre, operacionError } from "@/lib/operacion-http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }
  try {
    return await handleCierre(request.nextUrl.searchParams.get("mes"));
  } catch (error) {
    return operacionError(error, "No pudimos leer el cierre", "[admin] cierre");
  }
}
