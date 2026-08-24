import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { createMetaMensual, listMetasMensuales, parseMetaInput } from "@/lib/admin-parametros";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const metas = await listMetasMensuales();
    return NextResponse.json({ metas });
  } catch (error) {
    console.error("[admin] metas list", error);
    return NextResponse.json({ error: "No pudimos cargar las metas" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  let body: { mes?: unknown; meta?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "El cuerpo no es un JSON válido." }, { status: 400 });
  }

  const parsed = parseMetaInput(body, { requireMes: true });
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }
  if (!parsed.mes) {
    return NextResponse.json({ error: "El mes no es válido" }, { status: 400 });
  }

  try {
    const meta = await createMetaMensual(parsed.mes, parsed.meta);
    return NextResponse.json({ meta }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos guardar la meta";
    console.error("[admin] metas create", error);
    const status = message.includes("Ya existe") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
