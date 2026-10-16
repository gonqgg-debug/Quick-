import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { credencialMilesActiva, emitirTokenMiles, revocarTokenMiles } from "@/lib/miles-store";
import { respuestaMiles } from "@/lib/miles-http";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireAdminApi();
  if (admin instanceof NextResponse) return admin;
  try {
    const activa = await credencialMilesActiva();
    return NextResponse.json({ activa: activa ? { id: activa.id, prefijo: activa.prefijo, creadoEn: activa.creadoEn } : null });
  } catch (error) {
    return respuestaMiles(error);
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdminApi();
  if (admin instanceof NextResponse) return admin;
  try {
    const body = await request.json().catch(() => ({}));
    if (body.revocar && typeof body.id === "string") {
      await revocarTokenMiles(body.id);
      return NextResponse.json({ revocada: true });
    }
    const emitida = await emitirTokenMiles();
    return NextResponse.json({
      token: emitida.token,
      prefijo: emitida.prefijo,
      id: emitida.id,
      aviso: "Este token se muestra una sola vez. Guárdalo fuera del repositorio. Aquí solo queda el hash.",
    });
  } catch (error) {
    return respuestaMiles(error);
  }
}
