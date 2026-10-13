import { NextRequest, NextResponse } from "next/server";
import { requireAgentApi, requireAgentRol } from "@/lib/agent-auth";
import { listAgentVentas, parseAgentRange } from "@/lib/agent-read";
import { parseVentaInput, upsertVentaDiaria } from "@/lib/admin-ventas";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = requireAgentApi(request);
  if (denied) {
    return denied;
  }
  const range = parseAgentRange(request.nextUrl.searchParams);
  if (!range.ok) {
    return NextResponse.json({ error: range.error }, { status: 400 });
  }
  try {
    return NextResponse.json(await listAgentVentas(range.range));
  } catch (error) {
    console.error("[agent] ventas", error);
    return NextResponse.json({ error: "No pudimos leer las ventas" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const rol = requireAgentRol(request, ["rodrigo"]);
  if (rol instanceof NextResponse) {
    return rol;
  }
  let body: { fecha?: unknown; monto?: unknown; ventaReal?: unknown; venta_real?: unknown };
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
    const status = message === "La fecha no es válida" || message.startsWith("El monto") ? 400 : 500;
    if (status === 500) {
      console.error("[agent] ventas upsert", error);
    }
    return NextResponse.json({ error: message }, { status });
  }
}
