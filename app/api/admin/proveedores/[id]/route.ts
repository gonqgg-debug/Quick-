import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { parseProveedorInput, updateProveedor } from "@/lib/admin-compras";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  let body: { nombre?: unknown; tieneCredito?: unknown; diasCredito?: unknown; notas?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "El cuerpo no es un JSON válido." }, { status: 400 });
  }

  const parsed = parseProveedorInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }

  try {
    const proveedor = await updateProveedor(params.id, parsed.data);
    return NextResponse.json({ proveedor });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos guardar el proveedor";
    console.error("[admin] proveedores update", error);
    const status = message.includes("No encontramos") ? 404 : message.includes("Ya existe") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
