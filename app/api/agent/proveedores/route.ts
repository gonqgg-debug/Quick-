import { NextRequest, NextResponse } from "next/server";
import { requireAgentApi, requireAgentRol } from "@/lib/agent-auth";
import { createProveedor, listProveedoresAgente, parseProveedorInput, type ProveedorBody } from "@/lib/admin-compras";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = requireAgentApi(request);
  if (denied) {
    return denied;
  }
  try {
    const proveedores = await listProveedoresAgente(request.nextUrl.searchParams.get("q") ?? "");
    return NextResponse.json({ proveedores });
  } catch (error) {
    console.error("[agent] proveedores", error);
    return NextResponse.json({ error: "No pudimos leer los proveedores" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const rol = requireAgentRol(request, ["rodrigo"]);
  if (rol instanceof NextResponse) {
    return rol;
  }
  let body: ProveedorBody;
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
    console.error("[agent] proveedores create", error);
    const status = message.includes("Ya existe") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
