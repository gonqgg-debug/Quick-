import { NextRequest, NextResponse } from "next/server";
import { parsePosVentaInput } from "@/lib/pos";
import { registrarVentaCobro } from "@/lib/pos-server";
import { isStaffAuthorized, unauthorized } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

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
  const parsed = parsePosVentaInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  try {
    const venta = await registrarVentaCobro(parsed.value);
    return NextResponse.json(venta);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos guardar la venta";
    console.error("[pos] venta", error);
    const status = /inválid|no cubre|no tiene productos|demasiados/i.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
