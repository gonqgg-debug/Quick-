import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { expansionError, handleGetContacto, handlePatchContacto } from "@/lib/expansion-http";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }
  try {
    return await handleGetContacto(params.id);
  } catch (error) {
    return expansionError(error, "No pudimos leer el contacto", "[admin] expansion contacto");
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }
  try {
    return await handlePatchContacto(params.id, request);
  } catch (error) {
    return expansionError(error, "No pudimos guardar el contacto", "[admin] expansion contacto update");
  }
}
