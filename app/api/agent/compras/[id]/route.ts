import { NextRequest, NextResponse } from "next/server";
import { requireAgentApi, requireAgentRol } from "@/lib/agent-auth";
import { compraFailure, getCompraPublica, listarCambiosCompra, updateCompra } from "@/lib/admin-compras";
import { readCompraBody } from "@/lib/compra-request";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const denied = requireAgentApi(request);
  if (denied) {
    return denied;
  }
  try {
    const compra = await getCompraPublica(params.id);
    if (!compra) {
      return NextResponse.json({ error: "No encontramos esa compra" }, { status: 404 });
    }
    const cambios = await listarCambiosCompra(params.id);
    return NextResponse.json({ compra, cambios });
  } catch (error) {
    console.error("[agent] compra", error);
    return NextResponse.json({ error: "No pudimos leer la compra" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const rol = requireAgentRol(request, ["rodrigo"]);
  if (rol instanceof NextResponse) {
    return rol;
  }
  try {
    const body = await readCompraBody(request);
    const marcaPago = body.pagado === true || body.medioPago != null || body.ledgerId != null || body.movimientoId != null;
    if (marcaPago && !body.ledgerId && !body.movimientoId) {
      return NextResponse.json(
        { error: "Manda el movimiento de caja (ledgerId) o del banco (movimientoId)" },
        { status: 400 }
      );
    }
    const { compra, cambios } = await updateCompra(params.id, body, rol);
    return NextResponse.json({ compra, cambios });
  } catch (error) {
    console.error("[agent] compras update", error);
    const failure = compraFailure(error, "No pudimos guardar la compra");
    return NextResponse.json({ error: failure.error, compra: failure.compra }, { status: failure.status });
  }
}
