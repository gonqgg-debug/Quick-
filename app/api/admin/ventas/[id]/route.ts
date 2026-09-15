import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { updateVentaDiaria, type VentaPatch } from "@/lib/admin-ventas";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  let body: VentaPatch;
  try {
    body = (await request.json()) as VentaPatch;
  } catch {
    return NextResponse.json({ error: "El cuerpo no es un JSON válido." }, { status: 400 });
  }

  try {
    const venta = await updateVentaDiaria(params.id, body);
    return NextResponse.json({ venta });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos guardar la venta";
    console.error("[admin] ventas update", error);
    const status =
      message.includes("No encontramos")
        ? 404
        : message === "La fecha no es válida" || message.startsWith("El monto") || message.startsWith("Ya existe")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
