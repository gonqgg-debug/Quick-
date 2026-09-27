import { NextRequest } from "next/server";
import { requireAgentApi } from "@/lib/agent-auth";
import { expansionError, handleGetContacto, handlePatchContacto } from "@/lib/expansion-http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = requireAgentApi(request);
  if (denied) {
    return denied;
  }
  try {
    return await handleGetContacto(params.id);
  } catch (error) {
    return expansionError(error, "No pudimos leer el contacto", "[agent] expansion contacto");
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = requireAgentApi(request);
  if (denied) {
    return denied;
  }
  try {
    return await handlePatchContacto(params.id, request);
  } catch (error) {
    return expansionError(error, "No pudimos guardar el contacto", "[agent] expansion contacto update");
  }
}
