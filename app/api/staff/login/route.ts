import { NextRequest, NextResponse } from "next/server";
import {
  applyStaffSessionCookie,
  isStaffPasswordConfigured,
  isValidStaffPassword,
} from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isStaffPasswordConfigured()) {
    return NextResponse.json(
      { error: "Falta la variable de entorno STAFF_PASSWORD" },
      { status: 503 }
    );
  }

  let password = "";
  try {
    const body = (await request.json()) as { password?: unknown };
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!isValidStaffPassword(password)) {
    return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 });
  }

  return applyStaffSessionCookie(NextResponse.json({ ok: true }));
}
