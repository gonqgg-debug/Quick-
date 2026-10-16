import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { MilesError } from "@/lib/miles-domain";
import { respuestaMiles } from "@/lib/miles-http";
import { cambiarHallazgo, crearInvestigacion } from "@/lib/miles-store";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdminApi();
  if (admin instanceof NextResponse) return admin;
  try {
    const body = await request.json();
    const version = body.version;
    if (typeof version !== "number") throw new MilesError(400, "version es obligatoria");
    if (body.accion === "descartar") {
      if (typeof body.motivo !== "string" || body.motivo.trim().length < 3) {
        throw new MilesError(400, "Descartar pide un motivo");
      }
      const row = await cambiarHallazgo(params.id, version, { estado: "descartado", descarte_motivo: body.motivo.trim() }, admin.email ?? "admin", "descarte");
      return NextResponse.json({ id: row.id, estado: row.estado, version: row.version });
    }
    if (body.accion === "archivar") {
      const row = await cambiarHallazgo(params.id, version, { estado: "archivado" }, admin.email ?? "admin", "archivo");
      return NextResponse.json({ id: row.id, estado: row.estado, version: row.version });
    }
    if (body.accion === "ampliacion") {
      const pregunta = typeof body.pregunta === "string" ? body.pregunta.trim() : "";
      if (pregunta.length < 3) throw new MilesError(400, "La ampliación necesita una pregunta");
      const creada = await crearInvestigacion({
        hallazgoId: params.id,
        tipo: "ampliacion",
        pregunta,
        alcance: {},
        solicitante: admin.email ?? "admin",
      });
      return NextResponse.json({ id: creada.id, estado: creada.estado, aviso: "Quedó pendiente. Miles la verá cuando consulte la API." });
    }
    throw new MilesError(400, "Acción no reconocida");
  } catch (error) {
    return respuestaMiles(error);
  }
}
