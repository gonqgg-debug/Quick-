import { NextRequest, NextResponse } from "next/server";
import { parseHallazgo } from "@/lib/miles-domain";
import { exigirMiles, respuestaMiles } from "@/lib/miles-http";
import { listarHallazgos, publicarHallazgo } from "@/lib/miles-store";
import { parseLimit } from "@/lib/pos-domain";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rol = await exigirMiles(request, ["miles", "lectura"]);
  if (rol instanceof NextResponse) return rol;
  const params = request.nextUrl.searchParams;
  try {
    const rows = await listarHallazgos({
      tienda: params.get("tienda"),
      tipo: params.get("tipo"),
      estado: params.get("estado"),
      prioridad: params.get("prioridad"),
      desde: params.get("desde"),
      hasta: params.get("hasta"),
      limit: Math.min(parseLimit(params.get("limit"), 50), 100),
      cursor: params.get("cursor"),
    });
    return NextResponse.json({ hallazgos: rows, siguiente: rows.length === Math.min(parseLimit(params.get("limit"), 50), 100) ? rows[rows.length - 1]?.publicado_en ?? null : null });
  } catch (error) {
    return respuestaMiles(error);
  }
}

export async function POST(request: NextRequest) {
  const rol = await exigirMiles(request, ["miles"]);
  if (rol instanceof NextResponse) return rol;
  try {
    const input = parseHallazgo(await request.json());
    const resultado = await publicarHallazgo(input);
    return NextResponse.json({ id: resultado.row.id, estado: resultado.row.estado, version: resultado.row.version, reintento: resultado.reintento, publicadoEn: resultado.row.publicado_en }, { status: resultado.reintento ? 200 : 201 });
  } catch (error) {
    return respuestaMiles(error);
  }
}
