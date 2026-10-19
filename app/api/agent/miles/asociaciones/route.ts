import { NextRequest, NextResponse } from "next/server";
import { exigirMiles, respuestaMiles } from "@/lib/miles-http";
import { parseAsociacion } from "@/lib/miles-publicacion";
import { listarAsociaciones, publicarAsociacion } from "@/lib/miles-store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rol = await exigirMiles(request, ["miles", "lectura"]);
  if (rol instanceof NextResponse) return rol;
  try {
    const rows = await listarAsociaciones(80);
    return NextResponse.json({ asociaciones: rows });
  } catch (error) {
    return respuestaMiles(error);
  }
}

export async function POST(request: NextRequest) {
  const rol = await exigirMiles(request, ["miles"]);
  if (rol instanceof NextResponse) return rol;
  try {
    const input = parseAsociacion(await request.json());
    const resultado = await publicarAsociacion(input);
    return NextResponse.json({ id: resultado.row.id, version: resultado.row.version, reintento: resultado.reintento }, { status: resultado.reintento ? 200 : 201 });
  } catch (error) {
    return respuestaMiles(error);
  }
}
