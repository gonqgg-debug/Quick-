import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { getAsignacionSugerida } from "@/lib/caja";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const asignacion = await getAsignacionSugerida();
    return NextResponse.json({
      balances: {
        chicaDop: asignacion.saldoEsperadoChica,
        fuerteDop: asignacion.saldoEsperadoFuerteAntes,
        fuerteUsd: asignacion.usdEnFuerte,
      },
      asignacion,
    });
  } catch (error) {
    console.error("[admin] caja balances", error);
    const message = error instanceof Error ? error.message : "No pudimos cargar los balances";
    return NextResponse.json({ error: message || "No pudimos cargar los balances" }, { status: 500 });
  }
}
