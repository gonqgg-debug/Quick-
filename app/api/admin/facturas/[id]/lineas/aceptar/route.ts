import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { facturasError, handleAceptarPropuestas } from "@/lib/facturas-http";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }
  try {
    return await handleAceptarPropuestas(params.id, request, "admin");
  } catch (error) {
    return facturasError(error, "No pudimos aceptar las propuestas", "[admin] aceptar propuestas");
  }
}
