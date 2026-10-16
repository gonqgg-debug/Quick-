import { NextRequest, NextResponse } from "next/server";
import { parseAvanceInvestigacion } from "@/lib/miles-domain";
import { exigirMiles, respuestaMiles } from "@/lib/miles-http";
import { avanzarInvestigacion } from "@/lib/miles-store";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const rol = await exigirMiles(request, ["miles"]);
  if (rol instanceof NextResponse) return rol;
  try {
    const body = parseAvanceInvestigacion(await request.json());
    const row = await avanzarInvestigacion(params.id, body);
    return NextResponse.json({ id: row.id, estado: row.estado, version: row.version, tomadaEn: row.tomada_en });
  } catch (error) {
    return respuestaMiles(error);
  }
}
