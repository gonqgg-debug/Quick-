import { NextRequest } from "next/server";
import { requireAgentApi } from "@/lib/agent-auth";
import { expansionError, handleCreateSitio, handleListSitios } from "@/lib/expansion-http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = requireAgentApi(request);
  if (denied) {
    return denied;
  }
  try {
    return await handleListSitios(request);
  } catch (error) {
    return expansionError(error, "No pudimos leer los sitios", "[agent] expansion sitios");
  }
}

export async function POST(request: NextRequest) {
  const denied = requireAgentApi(request);
  if (denied) {
    return denied;
  }
  try {
    return await handleCreateSitio(request);
  } catch (error) {
    return expansionError(error, "No pudimos guardar el sitio", "[agent] expansion sitio create");
  }
}
