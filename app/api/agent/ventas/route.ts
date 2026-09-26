import { NextRequest, NextResponse } from "next/server";
import { requireAgentApi } from "@/lib/agent-auth";
import { listAgentVentas, parseAgentRange } from "@/lib/agent-read";

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
