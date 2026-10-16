import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { MilesError } from "@/lib/miles-domain";
import { respuestaMiles } from "@/lib/miles-http";
import { crearInvestigacion } from "@/lib/miles-store";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const admin = await requireAdminApi();
  if (admin instanceof NextResponse) return admin;
  try {
    const body = await request.json();
    const pregunta = typeof body.pregunta === "string" ? body.pregunta.trim() : "";
    if (pregunta.length < 8) throw new MilesError(400, "Escribe la pregunta");
    const creada = await crearInvestigacion({
      hallazgoId: typeof body.hallazgoId === "string" ? body.hallazgoId : null,
      tipo: "investigacion",
      pregunta,
      alcance: body.alcance && typeof body.alcance === "object" ? body.alcance : {},
      solicitante: admin.email ?? "admin",
    });
    return NextResponse.json({ id: creada.id, estado: "pendiente" }, { status: 201 });
  } catch (error) {
    return respuestaMiles(error);
  }
}
