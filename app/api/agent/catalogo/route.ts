import { NextRequest, NextResponse } from "next/server";
import { requireAgentApi, requireAgentRol } from "@/lib/agent-auth";
import { listAgentCatalogo } from "@/lib/agent-read";
import { catalogoError, handleImportarCatalogo } from "@/lib/catalog-import-http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const denied = await requireAgentApi(request);
  if (denied) {
    return denied;
  }
  try {
    return NextResponse.json(await listAgentCatalogo(request.nextUrl.searchParams));
  } catch (error) {
    console.error("[agent] catalogo", error);
    return NextResponse.json({ error: "No pudimos leer el catálogo" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const rol = await requireAgentRol(request, ["rodrigo"]);
  if (rol instanceof NextResponse) {
    return rol;
  }
  try {
    return await handleImportarCatalogo(request, rol);
  } catch (error) {
    return catalogoError(error, "No pudimos importar el catálogo", "[agent] importar catalogo");
  }
}
