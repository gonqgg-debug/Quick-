import { NextRequest, NextResponse } from "next/server";
import { crearClienteQuickcoins, lookupQuickcoins } from "@/lib/pos-server";
import { isStaffAuthorized, unauthorized } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return "No pudimos consultar QuickCoins";
}

export async function GET(request: NextRequest) {
  if (!isStaffAuthorized()) return unauthorized();
  const telefono = request.nextUrl.searchParams.get("telefono") ?? "";
  try {
    const cuenta = await lookupQuickcoins(telefono);
    return NextResponse.json(cuenta);
  } catch (error) {
    const message = errorMessage(error);
    const status = /inválid|escribe/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  if (!isStaffAuthorized()) return unauthorized();
  let body: { telefono?: unknown; nombre?: unknown };
  try {
    body = (await request.json()) as { telefono?: unknown; nombre?: unknown };
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  try {
    const cuenta = await crearClienteQuickcoins(String(body.telefono ?? ""), String(body.nombre ?? ""));
    return NextResponse.json(cuenta);
  } catch (error) {
    const message = errorMessage(error);
    const status = /inválid|escribe/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
