import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { updateCajaTurno } from "@/lib/admin-caja";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "El cuerpo no es un JSON válido." }, { status: 400 });
  }

  try {
    const turno = await updateCajaTurno(params.id, body);
    return NextResponse.json({ turno });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos guardar el turno";
    console.error("[admin] caja turnos update", error);
    const status = message.includes("No encontramos") ? 404 : message.includes("Ya hay un cierre") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
