import { NextRequest, NextResponse } from "next/server";
import { requireAgentRol } from "@/lib/agent-auth";
import { handleEstadoProductos, productoError } from "@/lib/catalog-import-http";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const rol = requireAgentRol(request, ["rodrigo"]);
  if (rol instanceof NextResponse) {
    return rol;
  }
  try {
    return await handleEstadoProductos(request, rol);
  } catch (error) {
    return productoError(error, "No pudimos actualizar los productos", "[agent] estado productos");
  }
}
