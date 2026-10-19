import { NextRequest, NextResponse } from "next/server";
import { exigirMiles, respuestaMiles } from "@/lib/miles-http";
import { parseTareas } from "@/lib/miles-publicacion";
import { guardarTareas } from "@/lib/miles-store";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const rol = await exigirMiles(request, ["miles"]);
  if (rol instanceof NextResponse) return rol;
  try {
    const tareas = parseTareas(await request.json());
    const rows = await guardarTareas(params.id, tareas);
    return NextResponse.json({ ejecucionId: params.id, tareas: rows });
  } catch (error) {
    return respuestaMiles(error);
  }
}
