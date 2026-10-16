import { NextRequest, NextResponse } from "next/server";
import { requireAgentRol } from "@/lib/agent-auth";
import { POS_REMATCH_MAX_FECHAS, POS_REMATCH_MAX_LINEAS } from "@/lib/pos-domain";
import { respuestaPos } from "@/lib/pos-http";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const rol = await requireAgentRol(request, ["rodrigo"]);
  if (rol instanceof NextResponse) {
    return rol;
  }
  let limite = POS_REMATCH_MAX_LINEAS;
  const body = await request.json().catch(() => null);
  if (body && typeof body === "object" && "limite" in body) {
    const parsed = Number((body as { limite?: unknown }).limite);
    if (Number.isInteger(parsed) && parsed > 0) {
      limite = Math.min(POS_REMATCH_MAX_LINEAS, parsed);
    }
  }
  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.rpc("procesar_pos_rematch", {
      p_limite: limite,
      p_max_fechas: POS_REMATCH_MAX_FECHAS,
    });
    if (error) {
      throw error;
    }
    const resultado = data && typeof data === "object" ? data : { procesadas: 0, pendientes: 0 };
    return NextResponse.json(resultado);
  } catch (error) {
    return respuestaPos(error, "[agent] pos rematch");
  }
}
