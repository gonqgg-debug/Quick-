import { NextRequest, NextResponse } from "next/server";
import { exigirMiles, respuestaMiles } from "@/lib/miles-http";
import { parseLimit } from "@/lib/pos-domain";
import { parsePropuesta } from "@/lib/promo-domain";
import { listarPropuestas, publicarPropuesta } from "@/lib/promo-store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rol = await exigirMiles(request, ["miles", "lectura"]);
  if (rol instanceof NextResponse) return rol;
  const params = request.nextUrl.searchParams;
  try {
    const rows = await listarPropuestas();
    const tipo = params.get("tipo");
    const estado = params.get("estado");
    const tienda = params.get("tienda");
    const filtradas = rows.filter((row) => {
      if (tipo && String(row.tipo) !== tipo) return false;
      if (estado && String(row.estado) !== estado) return false;
      if (tienda && String(row.tienda) !== tienda) return false;
      return true;
    });
    const limit = Math.min(parseLimit(params.get("limit"), 50), 100);
    const pagina = filtradas.slice(0, limit);
    return NextResponse.json({
      propuestas: pagina,
      nota: "El estado de la propuesta no enciende una promoción en caja. En prueba y evaluada salen de las pruebas y evaluaciones, no del estado de la propuesta.",
    });
  } catch (error) {
    return respuestaMiles(error);
  }
}

export async function POST(request: NextRequest) {
  const rol = await exigirMiles(request, ["miles"]);
  if (rol instanceof NextResponse) return rol;
  try {
    const input = parsePropuesta(await request.json());
    const resultado = await publicarPropuesta(input);
    return NextResponse.json(
      {
        id: resultado.row.id,
        estado: resultado.row.estado,
        version: resultado.row.version,
        reintento: resultado.reintento,
        publicadoEn: resultado.row.publicado_en,
        aviso: "Quedó publicada. No cambia precios, descuentos ni pedidos.",
      },
      { status: resultado.reintento ? 200 : 201 },
    );
  } catch (error) {
    return respuestaMiles(error);
  }
}
