import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { resolveProductRequest } from "@/lib/product-requests";
import { isProductRequestEstado } from "@/lib/product-requests-shared";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  let body: { estado?: unknown; notaAdmin?: unknown };
  try {
    body = (await request.json()) as { estado?: unknown; notaAdmin?: unknown };
  } catch {
    return NextResponse.json({ error: "El cuerpo no es un JSON válido." }, { status: 400 });
  }

  if (!isProductRequestEstado(body.estado) || body.estado === "pendiente") {
    return NextResponse.json({ error: "Elige Agregado o No disponible." }, { status: 400 });
  }

  const result = await resolveProductRequest({
    id: params.id,
    estado: body.estado,
    notaAdmin: body.notaAdmin,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  return NextResponse.json({ success: true });
}
