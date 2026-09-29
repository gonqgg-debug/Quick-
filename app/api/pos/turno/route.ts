import { NextRequest, NextResponse } from "next/server";
import { parseAbrirTurnoInput } from "@/lib/pos";
import { abrirTurnoPos } from "@/lib/pos-server";
import { isStaffAuthorized, unauthorized } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return "No pudimos abrir el turno";
}

export async function POST(request: NextRequest) {
  if (!isStaffAuthorized()) {
    return unauthorized();
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const parsed = parseAbrirTurnoInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  try {
    const turno = await abrirTurnoPos(parsed.value);
    return NextResponse.json(turno);
  } catch (error) {
    const message = errorMessage(error);
    console.error("[pos] abrir turno", error);
    const status = /inválid|quién abre|indica/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
