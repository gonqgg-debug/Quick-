import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { createCajaLedger, listCajaLedger } from "@/lib/admin-caja";
import { isCaja, isCajaMoneda } from "@/lib/admin-caja-shared";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const cajaRaw = request.nextUrl.searchParams.get("caja")?.trim() ?? "";
  const monedaRaw = request.nextUrl.searchParams.get("moneda")?.trim() ?? "";
  try {
    const movimientos = await listCajaLedger({
      caja: isCaja(cajaRaw) ? cajaRaw : null,
      moneda: isCajaMoneda(monedaRaw) ? monedaRaw : null,
    });
    return NextResponse.json({ movimientos });
  } catch (error) {
    const message =
      error && typeof error === "object" && "message" in error && typeof error.message === "string" && error.message
        ? error.message
        : error instanceof Error
          ? error.message
          : "No pudimos cargar el ledger";
    console.error("[admin] caja ledger list", error);
    return NextResponse.json({ error: message }, { status: 500 });
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
    const movimiento = await createCajaLedger(body);
    return NextResponse.json({ movimiento }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos registrar el movimiento";
    console.error("[admin] caja ledger create", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
