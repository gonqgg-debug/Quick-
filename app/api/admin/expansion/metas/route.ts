import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { expansionError, handleGetMetas, handlePatchMetas } from "@/lib/expansion-http";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }
  try {
    return await handleGetMetas();
  } catch (error) {
    return expansionError(error, "No pudimos leer las metas de expansión", "[admin] expansion metas");
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }
  try {
    return await handlePatchMetas(request);
  } catch (error) {
    return expansionError(error, "No pudimos guardar las metas de expansión", "[admin] expansion metas update");
  }
}
