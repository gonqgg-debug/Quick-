import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { expansionError, handleCreateContacto, handleListContactos } from "@/lib/expansion-http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }
  try {
    return await handleListContactos(request);
  } catch (error) {
    return expansionError(error, "No pudimos leer los contactos", "[admin] expansion contactos");
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }
  try {
    return await handleCreateContacto(request);
  } catch (error) {
    return expansionError(error, "No pudimos guardar el contacto", "[admin] expansion contacto create");
  }
}
