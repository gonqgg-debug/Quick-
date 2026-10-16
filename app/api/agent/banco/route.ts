import { NextRequest, NextResponse } from "next/server";
import { requireAgentApi, requireAgentRol } from "@/lib/agent-auth";
import { bancoError, handleImportarBanco, handleListarBanco } from "@/lib/banco-http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = await requireAgentApi(request);
  if (denied) {
    return denied;
  }
  try {
    return await handleListarBanco(request);
  } catch (error) {
    return bancoError(error, "No pudimos leer el banco", "[agent] banco");
  }
}

export async function POST(request: NextRequest) {
  const rol = await requireAgentRol(request, ["fred"]);
  if (rol instanceof NextResponse) {
    return rol;
  }
  try {
    return await handleImportarBanco(request, rol);
  } catch (error) {
    return bancoError(error, "No pudimos importar el estado de cuenta", "[agent] banco");
  }
}
