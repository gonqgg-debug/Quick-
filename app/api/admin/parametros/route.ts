import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { getParametrosConfig, parseParametrosPatch, updateParametrosConfig } from "@/lib/admin-parametros";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const parametros = await getParametrosConfig();
    return NextResponse.json({ parametros });
  } catch (error) {
    console.error("[admin] parametros get", error);
    return NextResponse.json({ error: "No pudimos cargar los parámetros" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
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

  const parsed = parseParametrosPatch(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }

  try {
    const parametros = await updateParametrosConfig(parsed.data);
    return NextResponse.json({ parametros });
  } catch (error) {
    console.error("[admin] parametros patch", error);
    return NextResponse.json({ error: "No pudimos guardar los parámetros" }, { status: 500 });
  }
}
