import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { respuestaMiles } from "@/lib/miles-http";
import { guardarVariante } from "@/lib/promo-store";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdminApi();
  if (admin instanceof NextResponse) return admin;
  try {
    const body = await request.json();
    const row = await guardarVariante(params.id, admin.email ?? "admin", body && typeof body === "object" ? body : {});
    return NextResponse.json(
      {
        id: row.id,
        formula: row.formula,
        resultado: row.resultado,
        aviso: "Variante guardada como borrador. No cambia precios ni promociones.",
      },
      { status: 201 },
    );
  } catch (error) {
    return respuestaMiles(error);
  }
}
