import { NextRequest } from "next/server";
import { requireAgentApi } from "@/lib/agent-auth";
import { facturasError, handleCreateFactura, handleFacturasOverview } from "@/lib/contabilidad/facturas-http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = requireAgentApi(request);
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
  const denied = requireAgentApi(request);
  if (denied) {
    return denied;
  }
  try {
    return await handleCreateFactura(request);
  } catch (error) {
    return facturasError(error, "No pudimos guardar la factura", "[agent] facturas create");
  }
}
