import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { expansionError, handleCreateActividad, handleListActividades } from "@/lib/expansion-http";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }
  try {
    return await handleListActividades(params.id);
  } catch (error) {
    return expansionError(error, "No pudimos leer las actividades", "[admin] expansion actividades");
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }
  try {
    return await handleCreateActividad(params.id, request);
  } catch (error) {
    return expansionError(error, "No pudimos guardar la actividad", "[admin] expansion actividad create");
  }
}
