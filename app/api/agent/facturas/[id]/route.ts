import { NextRequest } from "next/server";
import { requireAgentApi } from "@/lib/agent-auth";
import { facturasError, handleGetFactura, handlePatchFactura } from "@/lib/facturas-http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = requireAgentApi(request);
  if (denied) {
    return denied;
  }
  try {
    return await handleGetFactura(params.id);
  } catch (error) {
    return facturasError(error, "No pudimos leer la factura", "[agent] factura");
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = requireAgentApi(request);
  if (denied) {
    return denied;
  }
  try {
    return await handlePatchFactura(params.id, request);
  } catch (error) {
    return facturasError(error, "No pudimos guardar la factura", "[agent] factura update");
  }
}
