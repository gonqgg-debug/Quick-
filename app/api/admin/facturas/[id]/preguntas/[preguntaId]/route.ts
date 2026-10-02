import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { facturasError, handlePatchPregunta } from "@/lib/contabilidad/facturas-http";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: { id: string; preguntaId: string } }) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }
  try {
    return await handlePatchPregunta(params.id, params.preguntaId, request);
  } catch (error) {
    return facturasError(error, "No pudimos guardar la respuesta", "[admin] factura pregunta");
  }
}
