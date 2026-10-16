import { NextResponse } from "next/server";
import { PosEntradaError } from "@/lib/pos-domain";

function codigoDe(error: unknown): string {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return "";
  }
  return String(error.code ?? "");
}

function campoDe(error: unknown): string | null {
  if (error instanceof PosEntradaError && error.campo) {
    return error.campo;
  }
  if (error && typeof error === "object" && "hint" in error && typeof error.hint === "string" && error.hint.trim()) {
    return error.hint.trim();
  }
  return null;
}

function esEntradaMalFormada(error: unknown): boolean {
  if (error instanceof PosEntradaError) {
    return true;
  }
  const code = codigoDe(error);
  return code === "22023" || code === "22P02";
}

export function respuestaPos(error: unknown, etiqueta: string) {
  if (esEntradaMalFormada(error)) {
    const message = error instanceof Error && error.message ? error.message : "La sesión no es válida";
    return NextResponse.json({ error: message, campo: campoDe(error) }, { status: 422 });
  }
  console.error(etiqueta, error);
  const message = error instanceof Error && error.message === "Falta aplicar la migración de consumo"
    ? error.message
    : "No pudimos completar la consulta";
  const status = message === "Falta aplicar la migración de consumo" ? 503 : 500;
  return NextResponse.json({ error: message }, { status });
}
