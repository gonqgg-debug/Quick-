import { NextRequest, NextResponse } from "next/server";
import { requireAgentApi } from "@/lib/agent-auth";
import { EXPANSION_AGENT_ENDPOINTS } from "@/lib/expansion-shared";
import { FACTURAS_AGENT_ENDPOINTS } from "@/lib/contabilidad/facturas-shared";

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
        "inventario.recibido",
        "inventario.vendido",
        "inventario.ajustado",
      ],
    },
    nota: "Ventas, compras, caja, catálogo y contable no incluyen teléfonos, direcciones ni chats de clientes. Expansión sí incluye teléfono y correo de brokers y desarrolladores: ese directorio es el CRM. El stock y el costo viven por tienda en inventario. POST de compras registra una cuenta por pagar con RNC, NCF y captura. POST de facturas guarda lo que Phillip lee, incluida la foto original. Con aplicarInventario: true esa factura mete unidades y costo. POST y PATCH de expansión crean y mueven el pipeline.",
    endpoints: [
      { method: "GET", path: "/api/agent/metas?fecha=YYYY-MM-DD", describe: "Meta del día (la misma que Hoy) y la venta de esa fecha. Con mes=YYYY-MM devuelve cada día del mes." },
      { method: "GET", path: "/api/agent/ventas?fecha=YYYY-MM-DD", describe: "Ventas diarias de un día, o from y to (máximo 93 días)" },
      { method: "GET", path: "/api/agent/compras?from=YYYY-MM-DD&to=YYYY-MM-DD", describe: "Facturas con fecha en el rango, incluyendo rnc, ncf y tieneCaptura" },
      { method: "POST", path: "/api/agent/compras", describe: "Registra una factura. JSON o multipart: proveedorNombre o proveedorId, monto, fecha, rnc, ncf y captura (archivo o capturaBase64). JPG, PNG, WebP o PDF, máximo 4 MB." },
      { method: "GET", path: "/api/agent/compras/{id}/captura", describe: "Descarga la captura de esa factura" },
      { method: "GET", path: "/api/agent/caja?fecha=YYYY-MM-DD", describe: "Turnos y ledger del rango" },
      { method: "GET", path: "/api/agent/catalogo?cursor=&q=&tienda=quick", describe: "Productos de a 100. stock, costoPromedio, ultimoCosto y puntoReorden son de esa tienda." },
      { method: "GET", path: "/api/agent/inventario?tienda=quick&q=&bajoMinimo=true&cursor=", describe: "Existencias de a 100: cantidad, costo promedio, último costo y punto de reorden." },
      { method: "POST", path: "/api/agent/inventario/recepciones", describe: "Aplica una factura ya guardada al inventario. JSON: facturaId o clave." },
      { method: "POST", path: "/api/agent/inventario/ventas", describe: "Baja stock por línea del POS. No toca ventas_diarias. JSON: tienda, lineas[{ productoId | codigoOdoo | codigoBarras, cantidad }]." },
      { method: "POST", path: "/api/agent/inventario/ajustes", describe: "Ajuste, merma o devolución. JSON: tienda, tipo, cantidad, nota y productoId, codigoOdoo o codigoBarras." },
      { method: "GET", path: "/api/agent/contable?mes=YYYY-MM", describe: "Paquete contable del mes, con líneas y comprobaciones" },
      ...FACTURAS_AGENT_ENDPOINTS,
      ...EXPANSION_AGENT_ENDPOINTS,
    ],
  });
}
