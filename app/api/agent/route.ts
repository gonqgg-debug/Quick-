import { NextRequest, NextResponse } from "next/server";
import { requireAgentApi } from "@/lib/agent-auth";
import { EXPANSION_AGENT_ENDPOINTS } from "@/lib/expansion-shared";

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
    nota: "Ventas, compras, caja, catálogo y contable no incluyen teléfonos, direcciones ni chats de clientes. Expansión sí incluye teléfono y correo de brokers y desarrolladores: ese directorio es el CRM. El catálogo no tiene existencias. POST de compras registra una factura con RNC, NCF y captura. POST y PATCH de expansión crean y mueven el pipeline.",
    endpoints: [
      { method: "GET", path: "/api/agent/metas?fecha=YYYY-MM-DD", describe: "Meta del día (la misma que Hoy) y la venta de esa fecha. Con mes=YYYY-MM devuelve cada día del mes." },
      { method: "GET", path: "/api/agent/ventas?fecha=YYYY-MM-DD", describe: "Ventas diarias de un día, o from y to (máximo 93 días)" },
      { method: "GET", path: "/api/agent/compras?from=YYYY-MM-DD&to=YYYY-MM-DD", describe: "Facturas con fecha en el rango, incluyendo rnc, ncf y tieneCaptura" },
      { method: "POST", path: "/api/agent/compras", describe: "Registra una factura. JSON o multipart: proveedorNombre o proveedorId, monto, fecha, rnc, ncf y captura (archivo o capturaBase64). JPG, PNG, WebP o PDF, máximo 4 MB." },
      { method: "GET", path: "/api/agent/compras/{id}/captura", describe: "Descarga la captura de esa factura" },
      { method: "GET", path: "/api/agent/caja?fecha=YYYY-MM-DD", describe: "Turnos y ledger del rango" },
      { method: "GET", path: "/api/agent/catalogo?cursor=&q=", describe: "Productos de a 100. stock siempre es null" },
      { method: "GET", path: "/api/agent/contable?mes=YYYY-MM", describe: "Paquete contable del mes, con líneas y comprobaciones" },
      ...EXPANSION_AGENT_ENDPOINTS,
    ],
  });
}
