import { NextRequest } from "next/server";
import { requireAgentApi } from "@/lib/agent-auth";
import { facturasError, handlePostValidaciones } from "@/lib/contabilidad/facturas-http";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = requireAgentApi(request);
  if (denied) {
    return denied;
  }
  try {
    return await handlePostValidaciones(params.id, request);
  } catch (error) {
    return facturasError(error, "No pudimos guardar las validaciones", "[agent] factura validaciones");
  }
}
