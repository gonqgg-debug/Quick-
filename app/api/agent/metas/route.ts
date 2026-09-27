import { NextRequest, NextResponse } from "next/server";
import { requireAgentApi } from "@/lib/agent-auth";
import { loadAgentMetaFecha, loadAgentMetaMes, parseAgentMetaQuery } from "@/lib/agent-metas";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = requireAgentApi(request);
  if (denied) {
    return denied;
  }
  const parsed = parseAgentMetaQuery(request.nextUrl.searchParams);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  try {
    const body = parsed.kind === "fecha" ? await loadAgentMetaFecha(parsed.fecha) : await loadAgentMetaMes(parsed.mes);
    return NextResponse.json(body);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos leer la meta del día";
    console.error("[agent] metas", error);
    const status = message.includes("no es válido") ? 400 : 500;
    return NextResponse.json({ error: status === 400 ? message : "No pudimos leer la meta del día" }, { status });
  }
}
