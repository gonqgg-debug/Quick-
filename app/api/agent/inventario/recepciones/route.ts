import { NextRequest, NextResponse } from "next/server";
import { requireAgentApi } from "@/lib/agent-auth";
import { inventarioError } from "@/lib/inventario/http";
import { aplicarFacturaAInventario } from "@/lib/inventario/recepcion";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const denied = requireAgentApi(request);
  if (denied) {
    return denied;
  }
  try {
    const body = (await request.json()) as { facturaId?: unknown; clave?: unknown };
    const id = typeof body.facturaId === "string" && body.facturaId.trim() ? body.facturaId.trim() : typeof body.clave === "string" ? body.clave.trim() : "";
    if (!id) {
      return NextResponse.json({ error: "Manda facturaId o clave" }, { status: 400 });
    }
    const inventario = await aplicarFacturaAInventario(id, "agente");
    return NextResponse.json({ inventario });
  } catch (error) {
    return inventarioError(error, "No pudimos aplicar la factura al inventario", "[agent] inventario recepcion");
  }
}
