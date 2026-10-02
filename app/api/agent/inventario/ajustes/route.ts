import { NextRequest, NextResponse } from "next/server";
import { requireAgentApi } from "@/lib/agent-auth";
import { inventarioError } from "@/lib/inventario/http";
import { registrarAjuste } from "@/lib/inventario/operaciones";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const denied = requireAgentApi(request);
  if (denied) {
    return denied;
  }
  try {
    const body = (await request.json()) as {
      tienda?: unknown;
      tipo?: unknown;
      productoId?: unknown;
      codigoOdoo?: unknown;
      codigoBarras?: unknown;
      cantidad?: unknown;
      nota?: unknown;
    };
    const ajuste = await registrarAjuste({ ...body, origen: "agente" });
    return NextResponse.json({ ajuste });
  } catch (error) {
    return inventarioError(error, "No pudimos registrar el ajuste", "[agent] inventario ajustes");
  }
}
