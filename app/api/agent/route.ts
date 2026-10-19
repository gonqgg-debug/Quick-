import { NextRequest, NextResponse } from "next/server";
import { AGENT_EVENT_TYPES } from "@/lib/agent-events";
import { agentRolFromRequest, requireAgentApi } from "@/lib/agent-auth";
import { CONSULTAS_MILES } from "@/lib/miles-domain";
import { MILES_AGENT_ENDPOINTS, MILES_BASE_URL, MILES_LIMITES, MILES_NOTA_APEX } from "@/lib/miles-api";
import { EXPANSION_AGENT_ENDPOINTS } from "@/lib/expansion-shared";
import { FACTURAS_AGENT_ENDPOINTS } from "@/lib/facturas-shared";
import { OPERACION_AGENT_ENDPOINTS } from "@/lib/operacion-shared";
import { POS_AGENT_ENDPOINTS } from "@/lib/pos-domain";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = await requireAgentApi(request);
  if (denied) {
    return denied;
  }
  const rol = await agentRolFromRequest(request);
  if (rol === "miles") {
    return NextResponse.json({
      version: 1,
      agente: "Miles — Analista Comercial",
      auth: "Authorization: Bearer <token de Miles>",
      baseUrl: MILES_BASE_URL,
      nota: `Este token solo ve las funciones de Miles. No escribe ventas, costos, precios, inventario ni decisiones humanas. ${MILES_NOTA_APEX}`,
      consultas: CONSULTAS_MILES,
      limites: MILES_LIMITES,
      endpoints: MILES_AGENT_ENDPOINTS,
    });
  }

  return NextResponse.json({
    version: 1,
    baseUrl: MILES_BASE_URL,
    auth: "Authorization: Bearer <AGENT_API_TOKEN>",
    webhook: {
      configurado: Boolean(process.env.AGENT_WEBHOOK_URL?.trim()),
      firmado: (process.env.AGENT_WEBHOOK_SECRET?.trim().length ?? 0) >= 16 && Boolean(process.env.AGENT_WEBHOOK_KEY?.trim()) && Boolean(process.env.AGENT_WEBHOOK_URL?.trim()),
      firma: "Todos los eventos salen con el header X-Quick-Signature: t=<unix>,v1=<hex>. v1 es HMAC-SHA256 de `${timestamp}.${body}` con AGENT_WEBHOOK_SECRET (mínimo 16 caracteres). El secreto vive en el servidor y esta respuesta no lo incluye. El POST también manda Authorization: Bearer <AGENT_WEBHOOK_KEY>, distinta del secreto de la firma. Si el secreto no está, el evento no se envía.",
      eventos: [...AGENT_EVENT_TYPES],
    },
    nota: `Ventas, compras, caja, catálogo y contable no incluyen teléfonos, direcciones ni chats de clientes. Expansión sí incluye teléfono y correo de brokers y desarrolladores: ese directorio es el CRM. El catálogo no tiene existencias. POST de compras registra una factura con RNC, NCF y captura. POST de facturas guarda lo que Phillip lee, incluida la foto original. Cada bot escribe con su token: Boris solo verifica, Fred solo concilia, Hans publica asientos, Robert los estados y Troy aprueba el cierre. AGENT_API_TOKEN sigue pudiendo leer. POST y PATCH de expansión crean y mueven el pipeline. ${MILES_NOTA_APEX}`,
    endpoints: [
      { method: "GET", path: "/api/agent/metas?fecha=YYYY-MM-DD", describe: "Meta del día (la misma que Hoy) y la venta de esa fecha, en cuanto está guardada. Trae metaAcumulada a la fecha y deficit (meta acumulada menos ventas; positivo si va por debajo). Con mes=YYYY-MM devuelve cada día del mes y el acumulado hasta hoy." },
      { method: "GET", path: "/api/agent/ventas?fecha=YYYY-MM-DD", describe: "Ventas diarias de un día, o from y to (máximo 93 días)" },
      { method: "POST", path: "/api/agent/ventas", describe: "Rodrigo guarda la venta del día. JSON: fecha YYYY-MM-DD y monto (también vale ventaReal). Hasta ayer. Si ese día ya existe, lo actualiza." },
      { method: "GET", path: "/api/agent/compras?from=YYYY-MM-DD&to=YYYY-MM-DD", describe: "Facturas con fecha en el rango, incluyendo rnc, ncf y tieneCaptura" },
      { method: "POST", path: "/api/agent/compras", describe: "Registra una factura. JSON o multipart: proveedorNombre o proveedorId, monto, fecha, rnc, ncf y captura (archivo o capturaBase64). JPG, PNG, WebP o PDF, máximo 4 MB." },
      { method: "GET", path: "/api/agent/compras/{id}", describe: "Una compra, con medio de pago, movimiento y el historial de quién cambió qué." },
      { method: "PATCH", path: "/api/agent/compras/{id}", describe: "Rodrigo corrige monto, ncf, rnc, fecha o proveedor (proveedorId o proveedorNombre). Para marcarla pagada manda pagado true, medio (caja chica, caja fuerte o transferencia), pagadoEn y ledgerId (salida de caja) o movimientoId (débito del banco). Queda quién cambió cada campo." },
      { method: "GET", path: "/api/agent/compras/{id}/captura", describe: "Descarga la captura de esa factura" },
      { method: "GET", path: "/api/agent/proveedores?q=", describe: "Proveedores con RNC y empaques (presentación y unidades por producto). q busca por nombre o RNC." },
      { method: "POST", path: "/api/agent/proveedores", describe: "Rodrigo crea un proveedor sin pasar por el panel. JSON: nombre, rnc, tieneCredito, diasCredito, formaPago (efectivo, transferencia o mixto) y notas." },
      { method: "GET", path: "/api/agent/caja?fecha=YYYY-MM-DD", describe: "Turnos y ledger del rango" },
      { method: "GET", path: "/api/agent/catalogo?cursor=&q=", describe: "Productos de a 100. Cada uno trae tasaItbis y tasa_itbis (0, 16 o 18; el precio ya incluye ese ITBIS). stock siempre es null." },
      {
        method: "POST",
        path: "/api/agent/catalogo",
        describe:
          "Rodrigo importa productos al catálogo. Multipart: archivo (.xlsx o .csv, el export de Odoo sirve). JSON: productos: [{ codigo, nombre, precio, categoria, marca, codigoBarras, costo, tasaItbis }], o csv, o base64 con nombre. codigo (Odoo), nombre, precio y categoria son obligatorios; costo y tasaItbis son opcionales. Si el código ya existe, se actualiza. Un costo se guarda como costo manual del producto, con fuente odoo y la fecha; si no viene, ese costo no se toca. tasaItbis solo acepta 0, 16 o 18: si viene, actualiza la tasa del producto; si no viene, la tasa actual no se toca. Otro valor responde 400 e indica el producto. Sin confirmar: true solo responde qué cambiaría (nuevos, actualizados con sus cambios, invalidos con la razón); con confirmar: true lo guarda. Nunca borra productos.",
      },
      { method: "GET", path: "/api/agent/contable?mes=YYYY-MM", describe: "Paquete contable del mes, con líneas y comprobaciones" },
      ...POS_AGENT_ENDPOINTS,
      ...FACTURAS_AGENT_ENDPOINTS,
      ...OPERACION_AGENT_ENDPOINTS,
      ...EXPANSION_AGENT_ENDPOINTS,
    ],
  });
}
