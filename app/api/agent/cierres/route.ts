import { NextRequest } from "next/server";
import { requireAgentApi } from "@/lib/agent-auth";
import { handleCierre, operacionError } from "@/lib/operacion-http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = await requireAgentApi(request);
  if (denied) {
    return denied;
  }
  try {
    return await handleCierre(request.nextUrl.searchParams.get("mes"));
  } catch (error) {
    return operacionError(error, "No pudimos leer el cierre", "[agent] cierre");
  }
}
