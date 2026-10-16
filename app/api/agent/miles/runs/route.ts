import { NextRequest, NextResponse } from "next/server";
import { exigirMiles, respuestaMiles } from "@/lib/miles-http";
import { parseRun } from "@/lib/miles-domain";
import { abrirEjecucion } from "@/lib/miles-store";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const rol = await exigirMiles(request, ["miles"]);
  if (rol instanceof NextResponse) return rol;
  try {
    const body = parseRun(await request.json());
    const resultado = await abrirEjecucion(body);
    return NextResponse.json({ id: resultado.row.id, estado: resultado.row.estado, version: resultado.row.version, reintento: resultado.reintento }, { status: resultado.reintento ? 200 : 201 });
  } catch (error) {
    return respuestaMiles(error);
  }
}
