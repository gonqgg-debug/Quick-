import { NextRequest } from "next/server";
import { requireAgentApi } from "@/lib/agent-auth";
import { expansionError, handleCreateContacto, handleListContactos } from "@/lib/expansion-http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = requireAgentApi(request);
  if (denied) {
    return denied;
  }
  try {
    return await handleListContactos(request);
  } catch (error) {
    return expansionError(error, "No pudimos leer los contactos", "[agent] expansion contactos");
  }
}

export async function POST(request: NextRequest) {
  const denied = requireAgentApi(request);
  if (denied) {
    return denied;
  }
  try {
    return await handleCreateContacto(request);
  } catch (error) {
    return expansionError(error, "No pudimos guardar el contacto", "[agent] expansion contacto create");
  }
}
