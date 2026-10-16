import { NextRequest, NextResponse } from "next/server";
import { parseEvaluacion } from "@/lib/miles-domain";
import { exigirMiles, respuestaMiles } from "@/lib/miles-http";
import { publicarEvaluacion } from "@/lib/miles-store";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const rol = await exigirMiles(request, ["miles"]);
  if (rol instanceof NextResponse) return rol;
  try {
    const body = parseEvaluacion(await request.json());
    const resultado = await publicarEvaluacion(params.id, body);
    return NextResponse.json(
      { id: resultado.row.id, pruebaId: params.id, reintento: resultado.reintento, nota: "La evaluación no cambia el estado de la prueba." },
      { status: resultado.reintento ? 200 : 201 },
    );
  } catch (error) {
    return respuestaMiles(error);
  }
}
