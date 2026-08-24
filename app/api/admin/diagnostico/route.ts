import { NextResponse } from "next/server";
import { formulaForecastCierreMes } from "@/lib/admin-diagnostico-shared";
import { requireAdminApi } from "@/lib/admin-auth";
import { loadDiagnosticoForecast } from "@/lib/admin-diagnostico";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const diagnostico = await loadDiagnosticoForecast();
    return NextResponse.json({
      ...diagnostico,
      formula: formulaForecastCierreMes(diagnostico),
    });
  } catch (error) {
    console.error("[admin] diagnostico", error);
    const message = error instanceof Error ? error.message : "No pudimos cargar el diagnóstico";
    return NextResponse.json({ error: message || "No pudimos cargar el diagnóstico" }, { status: 500 });
  }
}
