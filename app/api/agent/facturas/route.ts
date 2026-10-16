import { NextRequest, NextResponse } from "next/server";
import { requireAgentApi, requireAgentRol } from "@/lib/agent-auth";
import { facturasError, handleCreateFactura, handleFacturasOverview } from "@/lib/facturas-http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = await requireAgentApi(request);
  if (denied) {
    return denied;
  }
  try {
    return await handleFacturasOverview(request);
  } catch (error) {
    return facturasError(error, "No pudimos leer las facturas", "[agent] facturas");
  }
}

export async function POST(request: NextRequest) {
  const rol = await requireAgentRol(request, ["rodrigo", "phillip", "fred", "lectura"]);
  if (rol instanceof NextResponse) {
    return rol;
  }
  try {
    return await handleCreateFactura(request, rol);
  } catch (error) {
    return facturasError(error, "No pudimos guardar la factura", "[agent] facturas create");
  }
}
