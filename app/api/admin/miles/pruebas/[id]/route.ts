import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { MilesError, puedeTransicionarPrueba } from "@/lib/miles-domain";
import { respuestaMiles } from "@/lib/miles-http";
import { listarPruebas, transicionarPrueba } from "@/lib/miles-store";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdminApi();
  if (admin instanceof NextResponse) return admin;
  try {
    const body = await request.json();
    const version = body.version;
    const estado = body.estado;
    if (typeof version !== "number" || typeof estado !== "string") throw new MilesError(400, "version y estado son obligatorios");
    const actuales = await listarPruebas(null);
    const actual = actuales.find((row) => String(row.id) === params.id);
    if (!actual) throw new MilesError(404, "No está esa prueba");
    if (!puedeTransicionarPrueba(String(actual.estado), estado)) {
      throw new MilesError(400, "Ese cambio de estado no está permitido");
    }
    const extra: Record<string, unknown> = {};
    if (estado === "finalizada" || estado === "cancelada") {
      extra.decision = typeof body.decision === "string" ? body.decision.slice(0, 500) : null;
      extra.decision_en = new Date().toISOString();
    }
    if (typeof body.inicioReal === "string") extra.inicio_real = body.inicioReal;
    if (typeof body.finReal === "string") extra.fin_real = body.finReal;
    const row = await transicionarPrueba(params.id, version, estado, extra, admin.email ?? "admin");
    return NextResponse.json({ id: row.id, estado: row.estado, version: row.version });
  } catch (error) {
    return respuestaMiles(error);
  }
}
