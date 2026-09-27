import { NextRequest } from "next/server";
import { requireAgentApi } from "@/lib/agent-auth";
import { expansionError, handleGetMetas, handlePatchMetas } from "@/lib/expansion-http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = requireAgentApi(request);
  if (denied) {
    return denied;
  }
  try {
    return await handleGetMetas();
  } catch (error) {
    return expansionError(error, "No pudimos leer las metas de expansión", "[agent] expansion metas");
  }
}

export async function PATCH(request: NextRequest) {
  const denied = requireAgentApi(request);
  if (denied) {
    return denied;
  }
  try {
    return await handlePatchMetas(request);
  } catch (error) {
    return expansionError(error, "No pudimos guardar las metas de expansión", "[agent] expansion metas update");
  }
}
