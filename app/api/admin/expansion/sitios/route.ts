import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { expansionError, handleCreateSitio, handleListSitios } from "@/lib/expansion-http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }
  try {
    return await handleListSitios(request);
  } catch (error) {
    return expansionError(error, "No pudimos leer los sitios", "[admin] expansion sitios");
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }
  try {
    return await handleCreateSitio(request);
  } catch (error) {
    return expansionError(error, "No pudimos guardar el sitio", "[admin] expansion sitio create");
  }
}
