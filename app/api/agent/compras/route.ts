import { NextRequest, NextResponse } from "next/server";
import { requireAgentApi } from "@/lib/agent-auth";
import { compraFailure, createCompra } from "@/lib/contabilidad/compras";
import { listAgentCompras, parseAgentRange } from "@/lib/agent-read";
import { readCompraBody } from "@/lib/contabilidad/compra-request";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

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
    return NextResponse.json(await listAgentCompras(range.range));
  } catch (error) {
    console.error("[agent] compras", error);
    return NextResponse.json({ error: "No pudimos leer las compras" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const denied = requireAgentApi(request);
  if (denied) {
    return denied;
  }
  try {
    const compra = await createCompra(await readCompraBody(request));
    return NextResponse.json({ compra }, { status: 201 });
  } catch (error) {
    console.error("[agent] compras create", error);
    const failure = compraFailure(error, "No pudimos registrar la compra");
    return NextResponse.json({ error: failure.error, compra: failure.compra }, { status: failure.status });
  }
}
