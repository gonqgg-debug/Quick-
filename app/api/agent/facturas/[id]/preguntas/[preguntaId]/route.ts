import { NextRequest } from "next/server";
import { requireAgentApi } from "@/lib/agent-auth";
import { facturasError, handlePatchPregunta } from "@/lib/contabilidad/facturas-http";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: { id: string; preguntaId: string } }) {
  const denied = requireAgentApi(request);
  if (denied) {
    return denied;
  }
  try {
    return await handlePatchPregunta(params.id, params.preguntaId, request);
  } catch (error) {
    return facturasError(error, "No pudimos guardar la respuesta", "[agent] factura pregunta");
  }
}
