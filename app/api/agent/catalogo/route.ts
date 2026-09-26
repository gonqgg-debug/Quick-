import { NextRequest, NextResponse } from "next/server";
import { requireAgentApi } from "@/lib/agent-auth";
import { listAgentCatalogo } from "@/lib/agent-read";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = requireAgentApi(request);
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
