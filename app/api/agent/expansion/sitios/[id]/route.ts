import { NextRequest } from "next/server";
import { requireAgentApi } from "@/lib/agent-auth";
import { expansionError, handleGetSitio, handlePatchSitio } from "@/lib/expansion-http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = requireAgentApi(request);
  if (denied) {
    return denied;
  }
  try {
    return await handleGetSitio(params.id);
  } catch (error) {
    return expansionError(error, "No pudimos leer el sitio", "[agent] expansion sitio");
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = requireAgentApi(request);
  if (denied) {
    return denied;
  }
  try {
    return await handlePatchSitio(params.id, request);
  } catch (error) {
    return expansionError(error, "No pudimos guardar el sitio", "[agent] expansion sitio update");
  }
}
