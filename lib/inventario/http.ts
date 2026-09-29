import { NextResponse } from "next/server";

export function inventarioError(error: unknown, fallback: string, logLabel: string): NextResponse {
  const message = error instanceof Error && error.message ? error.message : fallback;
  if (/does not exist|schema cache|inventario_/i.test(message)) {
    return NextResponse.json({ error: "Falta crear las tablas de inventario. Corre la migración en Supabase." }, { status: 500 });
  }
  if (message.startsWith("No encontramos") || message === "producto no encontrado") {
    return NextResponse.json({ error: message === "producto no encontrado" ? "No encontramos ese producto" : message }, { status: 404 });
  }
  if (
    message.startsWith("Manda ") ||
    message.startsWith("La ") ||
    message.startsWith("El ") ||
    message.startsWith("Hay ")
  ) {
    return NextResponse.json({ error: message }, { status: 400 });
  }
  console.error(logLabel, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
