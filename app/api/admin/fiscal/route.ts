import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { parseNegocioFiscalPatch } from "@/lib/pos-fiscal";
import { guardarNegocioFiscal, leerNegocioFiscal } from "@/lib/pos-fiscal-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }
  try {
    const fiscal = await leerNegocioFiscal();
    return NextResponse.json(fiscal);
  } catch (error) {
    console.error("[admin] fiscal get", error);
    return NextResponse.json({ error: "No pudimos cargar los datos del negocio" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "El cuerpo no es un JSON válido." }, { status: 400 });
  }
  try {
    const current = await leerNegocioFiscal();
    if (!current.persistido) {
      return NextResponse.json(
        { error: "Falta crear la ficha fiscal en Supabase. Corre la migración antes de guardar." },
        { status: 503 }
      );
    }
    const parsed = parseNegocioFiscalPatch(body, current.negocio, current.emitidos > 0);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.message }, { status: 400 });
    }
    const negocio = await guardarNegocioFiscal(parsed.value);
    return NextResponse.json({ negocio, persistido: true, emitidos: current.emitidos });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos guardar los datos del negocio";
    console.error("[admin] fiscal put", error);
    const status = /migración|ficha fiscal/i.test(message) ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
