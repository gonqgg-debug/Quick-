import { NextRequest, NextResponse } from "next/server";
import { requireAgentRol } from "@/lib/agent-auth";
import { facturasError, handleLigarFacturaCompra } from "@/lib/facturas-http";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const rol = requireAgentRol(request, ["rodrigo", "boris"]);
  if (rol instanceof NextResponse) {
    return rol;
  }
  try {
    return await handleLigarFacturaCompra(params.id, request, rol);
  } catch (error) {
    return facturasError(error, "No pudimos ligar la factura con la compra", "[agent] factura compra");
  }
}
