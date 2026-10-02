import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { inventarioError } from "@/lib/inventario/http";
import { registrarConteo } from "@/lib/inventario/operaciones";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }
  try {
    const body = (await request.json()) as {
      tienda?: unknown;
      productoId?: unknown;
      codigoOdoo?: unknown;
      codigoBarras?: unknown;
      cantidadContada?: unknown;
      nota?: unknown;
    };
    const conteo = await registrarConteo({ ...body, origen: "admin" });
    return NextResponse.json({ conteo });
  } catch (error) {
    return inventarioError(error, "No pudimos guardar el conteo", "[admin] conteos");
  }
}
