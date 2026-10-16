import { NextRequest, NextResponse } from "next/server";
import { MilesError } from "@/lib/miles-domain";
import { exigirMiles, respuestaMiles } from "@/lib/miles-http";
import { cambiarHallazgo, leerHallazgo } from "@/lib/miles-store";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const rol = await exigirMiles(_request, ["miles", "lectura"]);
  if (rol instanceof NextResponse) return rol;
  try {
    const detalle = await leerHallazgo(params.id);
    if (!detalle) return NextResponse.json({ error: "No está ese hallazgo" }, { status: 404 });
    return NextResponse.json({
      ...detalle,
      nota: "Las métricas son el snapshot de la publicación. Una consulta actual con los mismos filtros puede diferir si hubo importaciones nuevas.",
    });
  } catch (error) {
    return respuestaMiles(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const rol = await exigirMiles(request, ["miles"]);
  if (rol instanceof NextResponse) return rol;
  try {
    const body = await request.json();
    if (body.estado || body.descarteMotivo || body.decision) {
      throw new MilesError(403, "Miles no descarta, no archiva y no decide");
    }
    const version = body.version;
    if (typeof version !== "number") throw new MilesError(400, "version es obligatoria");
    const patch: Record<string, unknown> = {};
    for (const campo of ["interpretacion", "limitaciones"] as const) {
      if (typeof body[campo] === "string") patch[campo] = body[campo].slice(0, 2000);
    }
    if (Object.keys(patch).length === 0) throw new MilesError(400, "Nada que actualizar");
    const row = await cambiarHallazgo(params.id, version, patch, "miles", "correccion");
    return NextResponse.json({ id: row.id, version: row.version });
  } catch (error) {
    return respuestaMiles(error);
  }
}
