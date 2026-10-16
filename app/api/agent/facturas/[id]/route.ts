import { NextRequest, NextResponse } from "next/server";
import { requireAgentApi, requireAgentRol } from "@/lib/agent-auth";
import { facturasError, handleBorrarFactura, handleGetFactura, handlePatchFactura } from "@/lib/facturas-http";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireAgentApi(request);
  if (denied) {
    return denied;
  }
  try {
    return await handleGetFactura(params.id);
  } catch (error) {
    return facturasError(error, "No pudimos leer la factura", "[agent] factura");
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const rol = await requireAgentRol(request, ["rodrigo"]);
  if (rol instanceof NextResponse) {
    return rol;
  }
  try {
    return await handleBorrarFactura(params.id, rol, request);
  } catch (error) {
    return facturasError(error, "No pudimos borrar la factura", "[agent] factura delete");
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const rol = await requireAgentRol(request, ["phillip", "rodrigo", "lectura"]);
  if (rol instanceof NextResponse) {
    return rol;
  }
  try {
    return await handlePatchFactura(params.id, request, rol);
  } catch (error) {
    return facturasError(error, "No pudimos guardar la factura", "[agent] factura update");
  }
}
