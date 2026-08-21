import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { createTestOrderSession } from "@/lib/admin-test-session";

export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const session = await createTestOrderSession();
    return NextResponse.json(session);
  } catch (error) {
    console.error("[admin] no se pudo crear la sesión de prueba", error);
    return NextResponse.json({ error: "No pudimos generar el link de prueba" }, { status: 500 });
  }
}
