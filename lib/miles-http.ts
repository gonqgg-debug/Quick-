import { NextResponse, type NextRequest } from "next/server";
import { requireAgentRol, type AgentRol } from "@/lib/agent-auth";
import { MilesError } from "@/lib/miles-domain";
import { DEFINICIONES_CONSUMO, ZONA_CONSUMO } from "@/lib/consumo-metricas";

export function respuestaMiles(error: unknown): NextResponse {
  if (error instanceof MilesError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "No pudimos completar eso";
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function exigirMiles(request: NextRequest, allowed: readonly AgentRol[]): Promise<AgentRol | NextResponse> {
  return requireAgentRol(request, allowed);
}

export function sobre(filtros: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return {
    definiciones: DEFINICIONES_CONSUMO,
    zonaHoraria: ZONA_CONSUMO,
    filtros,
    actualizadoEn: new Date().toISOString(),
    ...extra,
  };
}
