import { NextResponse } from "next/server";

export function respuestaPos(error: unknown, etiqueta: string) {
  console.error(etiqueta, error);
  const message = error instanceof Error && error.message === "Falta aplicar la migración de consumo"
    ? error.message
    : "No pudimos completar la consulta";
  const status = message === "Falta aplicar la migración de consumo" ? 503 : 500;
  return NextResponse.json({ error: message }, { status });
}
