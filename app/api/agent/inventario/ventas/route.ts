import { NextRequest } from "next/server";
import { requireAgentApi } from "@/lib/agent-auth";
import { inventarioError } from "@/lib/inventario/http";
import { registrarVentas } from "@/lib/inventario/operaciones";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const denied = requireAgentApi(request);
  if (denied) {
    return denied;
  }
  try {
    const body = (await request.json()) as { tienda?: unknown; origen?: unknown; lineas?: unknown };
    const resultado = await registrarVentas(body);
    return NextResponse.json(resultado);
  } catch (error) {
    return inventarioError(error, "No pudimos registrar la venta", "[agent] inventario ventas");
  }
}
