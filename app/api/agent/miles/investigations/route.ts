import { NextRequest, NextResponse } from "next/server";
import { exigirMiles, respuestaMiles } from "@/lib/miles-http";
import { listarInvestigaciones } from "@/lib/miles-store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rol = await exigirMiles(request, ["miles", "lectura"]);
  if (rol instanceof NextResponse) return rol;
  try {
    const estado = request.nextUrl.searchParams.get("estado");
    const rows = await listarInvestigaciones(estado, 100);
    return NextResponse.json({ investigaciones: rows });
  } catch (error) {
    return respuestaMiles(error);
  }
}
