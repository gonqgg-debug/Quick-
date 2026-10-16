import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { MilesError } from "@/lib/miles-domain";
import { respuestaMiles } from "@/lib/miles-http";
import { crearInvestigacion } from "@/lib/miles-store";
import { cambiarPropuesta, leerPropuesta } from "@/lib/promo-store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdminApi();
  if (admin instanceof NextResponse) return admin;
  try {
    const detalle = await leerPropuesta(params.id);
    if (!detalle) return NextResponse.json({ error: "No está esa propuesta" }, { status: 404 });
    return NextResponse.json(detalle);
  } catch (error) {
    return respuestaMiles(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdminApi();
  if (admin instanceof NextResponse) return admin;
  try {
    const body = await request.json();
    const version = body.version;
    if (typeof version !== "number") throw new MilesError(400, "version es obligatoria");
    const actor = admin.email ?? "admin";
    if (body.accion === "descartar") {
      if (typeof body.motivo !== "string" || body.motivo.trim().length < 3) throw new MilesError(400, "Descartar pide un motivo");
      const row = await cambiarPropuesta(params.id, version, { estado: "descartada", descarte_motivo: body.motivo.trim().slice(0, 500) }, actor, "descarte");
      return NextResponse.json({ id: row.id, estado: row.estado, version: row.version });
    }
    if (body.accion === "archivar") {
      const row = await cambiarPropuesta(params.id, version, { estado: "archivada" }, actor, "archivo");
      return NextResponse.json({ id: row.id, estado: row.estado, version: row.version });
    }
    if (body.accion === "lista") {
      const row = await cambiarPropuesta(params.id, version, { estado: "lista_para_probar" }, actor, "lista");
      return NextResponse.json({ id: row.id, estado: row.estado, version: row.version, aviso: "Lista para probar no enciende la promoción en caja." });
    }
    if (body.accion === "ampliacion") {
      const pregunta = typeof body.pregunta === "string" ? body.pregunta.trim() : "";
      if (pregunta.length < 3) throw new MilesError(400, "La ampliación necesita una pregunta");
      const actual = await leerPropuesta(params.id);
      if (!actual) throw new MilesError(404, "No está esa propuesta");
      const hallazgos = Array.isArray(actual.hallazgos) ? actual.hallazgos : [];
      const hallazgoId = hallazgos[0] && typeof hallazgos[0] === "object" ? String((hallazgos[0] as { id?: string }).id ?? "") : "";
      const creada = await crearInvestigacion({
        hallazgoId: hallazgoId || null,
        tipo: hallazgoId ? "ampliacion" : "investigacion",
        pregunta,
        alcance: { solicitud: "ampliacion", propuestaId: params.id },
        solicitante: actor,
      });
      const row = await cambiarPropuesta(params.id, version, { estado: "requiere_ampliacion" }, actor, "ampliacion");
      return NextResponse.json({
        id: row.id,
        estado: row.estado,
        version: row.version,
        investigacionId: creada.id,
        aviso: "Quedó pendiente. Miles la verá cuando consulte las investigaciones. No se generó otra propuesta.",
      });
    }
    throw new MilesError(400, "Acción no reconocida");
  } catch (error) {
    return respuestaMiles(error);
  }
}
