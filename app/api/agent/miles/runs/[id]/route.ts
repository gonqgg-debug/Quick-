import { NextRequest, NextResponse } from "next/server";
import { parseCierreRun } from "@/lib/miles-domain";
import { exigirMiles, respuestaMiles } from "@/lib/miles-http";
import { cerrarEjecucion } from "@/lib/miles-store";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const rol = await exigirMiles(request, ["miles"]);
  if (rol instanceof NextResponse) return rol;
  try {
    const body = parseCierreRun(await request.json());
    const row = await cerrarEjecucion(params.id, body);
    return NextResponse.json({ id: row.id, estado: row.estado, version: row.version, terminadaEn: row.terminada_en });
  } catch (error) {
    return respuestaMiles(error);
  }
}
