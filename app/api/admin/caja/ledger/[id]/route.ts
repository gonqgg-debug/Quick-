import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { deleteCajaLedger, updateCajaLedger } from "@/lib/admin-caja";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "El cuerpo no es un JSON válido." }, { status: 400 });
  }

  try {
    const movimiento = await updateCajaLedger(params.id, body);
    return NextResponse.json({ movimiento });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos guardar el movimiento";
    console.error("[admin] caja ledger update", error);
    const status = message.includes("No encontramos") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    await deleteCajaLedger(params.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos borrar el movimiento";
    console.error("[admin] caja ledger delete", error);
    const status = message.includes("No encontramos") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
