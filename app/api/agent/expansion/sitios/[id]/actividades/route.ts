import { NextRequest } from "next/server";
import { requireAgentApi } from "@/lib/agent-auth";
import { expansionError, handleCreateActividad, handleListActividades } from "@/lib/expansion-http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = requireAgentApi(request);
  if (denied) {
    return denied;
  }
  try {
    return await handleListActividades(params.id);
  } catch (error) {
    return expansionError(error, "No pudimos leer las actividades", "[agent] expansion actividades");
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = requireAgentApi(request);
  if (denied) {
    return denied;
  }
  try {
    return await handleCreateActividad(params.id, request);
  } catch (error) {
    return expansionError(error, "No pudimos guardar la actividad", "[agent] expansion actividad create");
  }
}
