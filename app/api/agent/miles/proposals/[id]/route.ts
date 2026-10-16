import { NextRequest, NextResponse } from "next/server";
import { exigirMiles, respuestaMiles } from "@/lib/miles-http";
import { parseCorreccionPropuesta } from "@/lib/promo-domain";
import { corregirPropuestaMiles, leerPropuesta } from "@/lib/promo-store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const rol = await exigirMiles(request, ["miles", "lectura"]);
  if (rol instanceof NextResponse) return rol;
  try {
    const detalle = await leerPropuesta(params.id);
    if (!detalle) return NextResponse.json({ error: "No está esa propuesta" }, { status: 404 });
    return NextResponse.json({
      ...detalle,
      nota: "Los costos del simulador salen del costo vigente de la plataforma. Un costo informado por Miles se guarda aparte y no entra en la fórmula.",
    });
  } catch (error) {
    return respuestaMiles(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const rol = await exigirMiles(request, ["miles"]);
  if (rol instanceof NextResponse) return rol;
  try {
    const correccion = parseCorreccionPropuesta(await request.json());
    const row = await corregirPropuestaMiles(params.id, correccion.version, correccion.patch);
    return NextResponse.json({ id: row.id, version: row.version, estado: row.estado });
  } catch (error) {
    return respuestaMiles(error);
  }
}
