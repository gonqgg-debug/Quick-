import { NextRequest, NextResponse } from "next/server";
import { requireAgentApi } from "@/lib/agent-auth";
import { facturasError } from "@/lib/facturas-http";
import { listarPendientes } from "@/lib/facturas";
import { isDayKey, todayDayKey } from "@/lib/local-day";
import { OPERACION_BOTS, esOperacionBot, type OperacionBot } from "@/lib/operacion-shared";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = await requireAgentApi(request);
  if (denied) {
    return denied;
  }
  try {
    const params = request.nextUrl.searchParams;
    const fechaParam = params.get("fecha")?.trim() || null;
    if (fechaParam && !isDayKey(fechaParam)) {
      return NextResponse.json({ error: "La fecha tiene que ser YYYY-MM-DD" }, { status: 400 });
    }
    const duenoParam = params.get("dueno")?.trim().toLowerCase() || null;
    if (duenoParam && !esOperacionBot(duenoParam)) {
      return NextResponse.json({ error: `El dueño tiene que ser ${OPERACION_BOTS.join(", ")}` }, { status: 400 });
    }
    const fecha = fechaParam ?? todayDayKey();
    const facturas = await listarPendientes({ hoy: fecha, dueno: duenoParam as OperacionBot | null });
    const porDueno: Record<string, number> = {};
    for (const factura of facturas) {
      for (const item of factura.pendientes) {
        const clave = item.dueno ?? "admin";
        porDueno[clave] = (porDueno[clave] ?? 0) + 1;
      }
    }
    return NextResponse.json({
      fecha,
      dueno: duenoParam,
      facturas,
      totalFacturas: facturas.length,
      totalPendientes: facturas.reduce((sum, factura) => sum + factura.pendientes.length, 0),
      porDueno,
    });
  } catch (error) {
    return facturasError(error, "No pudimos leer los pendientes", "[agent] pendientes");
  }
}
