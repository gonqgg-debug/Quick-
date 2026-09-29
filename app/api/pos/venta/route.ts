import { NextRequest, NextResponse } from "next/server";
import { parsePosSaleRequest, posSaleErrorStatus, registrarVentaPos } from "@/lib/pos-server";
import { isStaffAuthorized, unauthorized } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isStaffAuthorized()) {
    return unauthorized();
  }

  const body = await request.json().catch(() => null);
  const parsed = parsePosSaleRequest(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const result = await registrarVentaPos(parsed.value);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos registrar la venta";
    console.error("[pos] no se pudo registrar la venta", error);
    return NextResponse.json({ error: "No pudimos registrar la venta" }, { status: posSaleErrorStatus(message) });
  }
}
