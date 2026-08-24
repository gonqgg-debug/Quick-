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
    const message =
      error && typeof error === "object" && "message" in error && typeof error.message === "string" && error.message
        ? error.message
        : error instanceof Error
          ? error.message
          : "No pudimos cargar los balances";
    console.error("[admin] caja balances", error);
    return NextResponse.json({ error: message || "No pudimos cargar los balances" }, { status: 500 });
  }
}
