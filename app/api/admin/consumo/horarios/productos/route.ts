import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { tiendaPermitida } from "@/lib/consumo-productos-ui";
import { leerFranja } from "@/lib/consumo-horarios-ui";
import { cargarProductosFranja, periodoDesdeParams, tiendasConsumo } from "@/lib/pos-consumo";
import { TIENDA_DEFAULT } from "@/lib/pos-domain";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const admin = await requireAdminApi();
  if (admin instanceof NextResponse) return admin;
  const params = request.nextUrl.searchParams;
  const franja = leerFranja(params.get("franja") ?? `${params.get("dow") ?? ""}-${params.get("hora") ?? ""}`);
  if (!franja) return NextResponse.json({ error: "Falta una franja válida" }, { status: 400 });
  try {
    let tiendas = [TIENDA_DEFAULT];
    try {
      tiendas = await tiendasConsumo();
    } catch {
      tiendas = [TIENDA_DEFAULT];
    }
    const periodo = periodoDesdeParams(params);
    const data = await cargarProductosFranja({
      tienda: tiendaPermitida(params.get("tienda"), tiendas, TIENDA_DEFAULT),
      desde: periodo.desde,
      hasta: periodo.hasta,
      categoria: (params.get("categoria") ?? "").slice(0, 80),
      reloj: params.get("reloj") === "caja" ? "caja" : "real",
      dow: franja.dow,
      hora: franja.hora,
    });
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos cargar los productos de la franja";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
