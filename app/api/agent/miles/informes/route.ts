import { NextRequest, NextResponse } from "next/server";
import { exigirMiles, respuestaMiles } from "@/lib/miles-http";
import { parseInforme } from "@/lib/miles-publicacion";
import { casosDeInforme, listarInformes, publicarInforme } from "@/lib/miles-store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rol = await exigirMiles(request, ["miles", "lectura"]);
  if (rol instanceof NextResponse) return rol;
  try {
    const fecha = request.nextUrl.searchParams.get("fecha");
    const informes = await listarInformes(40);
    const dia = (value: unknown) => String(value ?? "").slice(0, 10);
    const elegido = fecha ? informes.find((row) => dia(row.fecha) === fecha) ?? null : informes[0] ?? null;
    const casos = elegido ? await casosDeInforme(String(elegido.id)) : [];
    return NextResponse.json({ informes, informe: elegido, casos });
  } catch (error) {
    return respuestaMiles(error);
  }
}

export async function POST(request: NextRequest) {
  const rol = await exigirMiles(request, ["miles"]);
  if (rol instanceof NextResponse) return rol;
  try {
    const input = parseInforme(await request.json());
    const resultado = await publicarInforme(input);
    return NextResponse.json({ id: resultado.row.id, fecha: resultado.row.fecha, estado: resultado.row.estado, reintento: resultado.reintento }, { status: resultado.reintento ? 200 : 201 });
  } catch (error) {
    return respuestaMiles(error);
  }
}
