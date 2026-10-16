import { NextRequest, NextResponse } from "next/server";
import { exigirMiles, respuestaMiles } from "@/lib/miles-http";
import { listarPruebas } from "@/lib/miles-store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rol = await exigirMiles(request, ["miles", "lectura"]);
  if (rol instanceof NextResponse) return rol;
  try {
    const rows = await listarPruebas(request.nextUrl.searchParams.get("estado"));
    return NextResponse.json({
      pruebas: rows,
      nota: "Publicar una evaluación no aprueba ni finaliza la prueba.",
    });
  } catch (error) {
    return respuestaMiles(error);
  }
}
