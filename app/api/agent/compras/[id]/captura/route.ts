import { NextRequest, NextResponse } from "next/server";
import { requireAgentApi } from "@/lib/agent-auth";
import { loadCompraCaptura } from "@/lib/compra-captura";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = requireAgentApi(request);
  if (denied) {
    return denied;
  }
  try {
    const captura = await loadCompraCaptura(params.id);
    if (!captura) {
      return NextResponse.json({ error: "Esta compra no tiene captura" }, { status: 404 });
    }
    return new NextResponse(Buffer.from(captura.bytes), {
      headers: {
        "Content-Type": captura.mime,
        "Content-Disposition": `inline; filename="${captura.filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[agent] compras captura", error);
    return NextResponse.json({ error: "No pudimos abrir la captura" }, { status: 500 });
  }
}
