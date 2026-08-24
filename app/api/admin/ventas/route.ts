import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { listVentasDiarias, parseVentaInput, parseVentasLimit, upsertVentaDiaria } from "@/lib/admin-ventas";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const limit = parseVentasLimit(request.nextUrl.searchParams.get("limit") ?? request.nextUrl.searchParams.get("n"));

  try {
    const ventas = await listVentasDiarias(limit);
    return NextResponse.json({ ventas });
  } catch (error) {
    console.error("[admin] ventas list", error);
    return NextResponse.json({ error: "No pudimos cargar las ventas" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  let body: { fecha?: unknown; monto?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "El cuerpo no es un JSON válido." }, { status: 400 });
  }

  try {
    const parsed = parseVentaInput(body);
    const venta = await upsertVentaDiaria(parsed.fecha, parsed.monto);
    return NextResponse.json({ venta });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos guardar la venta";
    console.error("[admin] ventas upsert", error);
    const status = message === "La fecha no es válida" || message.startsWith("El monto") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
