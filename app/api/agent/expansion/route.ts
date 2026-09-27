import { NextRequest } from "next/server";
import { requireAgentApi } from "@/lib/agent-auth";
import { expansionError, handleExpansionOverview } from "@/lib/expansion-http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = requireAgentApi(request);
  if (denied) {
    return denied;
  }
  try {
    return await handleExpansionOverview();
  } catch (error) {
    return expansionError(error, "No pudimos leer el pipeline de expansión", "[agent] expansion");
  }
}
