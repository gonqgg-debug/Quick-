import { NextRequest } from "next/server";
import { requireAgentApi } from "@/lib/agent-auth";
import { facturasError, handlePostPreguntas } from "@/lib/facturas-http";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = requireAgentApi(request);
  if (denied) {
    return denied;
  }
  try {
    return await handlePostPreguntas(params.id, request);
  } catch (error) {
    return facturasError(error, "No pudimos guardar la pregunta", "[agent] factura preguntas");
  }
}
