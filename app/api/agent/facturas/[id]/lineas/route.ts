import { NextRequest } from "next/server";
import { requireAgentApi } from "@/lib/agent-auth";
import { facturasError, handlePostLineas } from "@/lib/contabilidad/facturas-http";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = requireAgentApi(request);
  if (denied) {
    return denied;
  }
  try {
    return await handlePostLineas(params.id, request);
  } catch (error) {
    return facturasError(error, "No pudimos guardar los productos", "[agent] factura lineas");
  }
}
