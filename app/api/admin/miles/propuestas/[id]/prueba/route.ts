import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { isDayKey } from "@/lib/local-day";
import { MilesError } from "@/lib/miles-domain";
import { respuestaMiles } from "@/lib/miles-http";
import { crearPruebaDePropuesta } from "@/lib/promo-store";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdminApi();
  if (admin instanceof NextResponse) return admin;
  try {
    const body = await request.json();
    for (const campo of ["inicioPrevisto", "finPrevisto"] as const) {
      if (body[campo] != null && body[campo] !== "" && (typeof body[campo] !== "string" || !isDayKey(body[campo]))) {
        throw new MilesError(400, `${campo} tiene que ser una fecha`);
      }
    }
    const row = await crearPruebaDePropuesta(params.id, admin.email ?? "admin", body && typeof body === "object" ? body : {});
    return NextResponse.json(
      {
        id: row.id,
        estado: row.estado,
        propuestaId: row.propuesta_id,
        varianteId: row.variante_id,
        aviso: "La prueba quedó en propuesta. Aprobarla no cambia precios ni enciende la promoción en caja. El snapshot no se recalcula.",
      },
      { status: 201 },
    );
  } catch (error) {
    return respuestaMiles(error);
  }
}
