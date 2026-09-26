import { NextRequest, NextResponse } from "next/server";
import { requireAgentApi } from "@/lib/agent-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = requireAgentApi(request);
  if (denied) {
    return denied;
  }

  return NextResponse.json({
    version: 1,
    auth: "Authorization: Bearer <AGENT_API_TOKEN>",
    webhook: {
      configurado: Boolean(process.env.AGENT_WEBHOOK_URL?.trim()),
      firma: "Header X-Quick-Signature: t=<unix>,v1=<hex>. HMAC-SHA256 de `${timestamp}.${body}` con AGENT_WEBHOOK_SECRET. El POST también manda Authorization: Bearer <AGENT_WEBHOOK_KEY>, distinta del secreto de la firma.",
      eventos: [
        "venta.guardada",
        "compra.creada",
        "compra.actualizada",
        "proveedor.creado",
        "proveedor.actualizado",
        "turno.creado",
        "turno.actualizado",
        "ledger.creado",
        "ledger.actualizado",
        "ledger.eliminado",
        "producto.actualizado",
        "productos.actualizados",
        "catalogo.importado",
        "meta.guardada",
        "parametros.actualizados",
      ],
    },
    nota: "Estas rutas son de solo lectura y no incluyen teléfonos, direcciones ni chats. El catálogo no tiene existencias.",
    endpoints: [
      { method: "GET", path: "/api/agent/ventas?fecha=YYYY-MM-DD", describe: "Ventas diarias de un día, o from y to (máximo 93 días)" },
      { method: "GET", path: "/api/agent/compras?from=YYYY-MM-DD&to=YYYY-MM-DD", describe: "Facturas con fecha en el rango" },
      { method: "GET", path: "/api/agent/caja?fecha=YYYY-MM-DD", describe: "Turnos y ledger del rango" },
      { method: "GET", path: "/api/agent/catalogo?cursor=&q=", describe: "Productos de a 100. stock siempre es null" },
      { method: "GET", path: "/api/agent/contable?mes=YYYY-MM", describe: "Paquete contable del mes, con líneas y comprobaciones" },
    ],
  });
}
