import { NextRequest, NextResponse } from "next/server";
import { requireAgentRol } from "@/lib/agent-auth";
import { handleEditarProducto, productoError } from "@/lib/catalog-import-http";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: { producto: string } }) {
  const rol = requireAgentRol(request, ["rodrigo"]);
  if (rol instanceof NextResponse) {
    return rol;
  }
  try {
    return await handleEditarProducto(params.producto, request, rol);
  } catch (error) {
    return productoError(error, "No pudimos guardar el producto", "[agent] editar producto");
  }
}
