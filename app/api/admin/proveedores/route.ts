import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { createProveedor, listProveedores, parseProveedorInput } from "@/lib/admin-compras";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const proveedores = await listProveedores();
    return NextResponse.json({ proveedores });
  } catch (error) {
    console.error("[admin] proveedores list", error);
    return NextResponse.json({ error: "No pudimos cargar los proveedores" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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
    const proveedor = await createProveedor(parsed.data);
    return NextResponse.json({ proveedor }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos guardar el proveedor";
    console.error("[admin] proveedores create", error);
    const status = message.includes("Ya existe") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
