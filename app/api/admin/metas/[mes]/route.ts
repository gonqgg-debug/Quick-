import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { parseMetaInput, updateMetaMensual } from "@/lib/admin-parametros";
import { monthStartFromInput } from "@/lib/admin-parametros-shared";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: { mes: string } }) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const mes = monthStartFromInput(decodeURIComponent(params.mes ?? ""));
  if (!mes) {
    return NextResponse.json({ error: "El mes no es válido" }, { status: 400 });
  }

  let body: { meta?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "El cuerpo no es un JSON válido." }, { status: 400 });
  }

  const parsed = parseMetaInput(body, { requireMes: false });
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }

  try {
    const meta = await updateMetaMensual(mes, parsed.meta);
    return NextResponse.json({ meta });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos guardar la meta";
    console.error("[admin] metas update", error);
    const status = message.includes("No encontramos") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
