import { NextRequest } from "next/server";
import { requireAgentApi } from "@/lib/agent-auth";
import { facturasError, handleGetDocumento } from "@/lib/contabilidad/facturas-http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { id: string; documentoId: string } }) {
  const denied = requireAgentApi(request);
  if (denied) {
    return denied;
  }
  try {
    return await handleGetDocumento(params.id, params.documentoId);
  } catch (error) {
    return facturasError(error, "No pudimos abrir la foto", "[agent] factura documento");
  }
}
