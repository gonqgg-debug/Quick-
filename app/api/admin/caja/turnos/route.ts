import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { createCajaTurno, listCajaTurnos } from "@/lib/admin-caja";
import { isDayKey } from "@/lib/local-day";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const fechaRaw = request.nextUrl.searchParams.get("fecha")?.trim() ?? "";
  try {
    const turnos = await listCajaTurnos(isDayKey(fechaRaw) ? fechaRaw : null);
    return NextResponse.json({ turnos });
  } catch (error) {
    console.error("[admin] caja turnos list", error);
    return NextResponse.json({ error: "No pudimos cargar los turnos" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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
    const turno = await createCajaTurno(body);
    return NextResponse.json({ turno }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos registrar el turno";
    console.error("[admin] caja turnos create", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
