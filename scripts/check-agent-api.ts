import { AGENT_SIGNATURE_HEADER, agentWebhookRequest, signAgentPayload } from "../lib/agent-events";
import { acumuladoALaFecha, agentMetaDia, corteAcumulado, type AgentMetaDia } from "../lib/agent-metas";
import { cambiosEntreCompras, medioDesdeCaja, parseCompraMedio, type Compra } from "../lib/admin-compras-shared";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function compra(patch: Partial<Compra> = {}): Compra {
  return {
    id: "c1",
    proveedorId: "p1",
    proveedorNombre: "Rica",
    monto: 1000,
    notasCredito: 0,
    saldo: 1000,
    fecha: "2026-10-14",
    dueDate: "2026-10-14",
    pagado: false,
    pagadoEn: null,
    medioPago: null,
    ledgerId: null,
    movimientoId: null,
    rnc: "101000001",
    ncf: "B0100000001",
    tieneCaptura: true,
    ...patch,
  };
}

assert(parseCompraMedio("caja fuerte") === "caja_fuerte", "caja fuerte se lee con espacio");
assert(parseCompraMedio("Caja chica") === "caja_chica", "caja chica se lee");
assert(parseCompraMedio("transferencia") === "transferencia", "transferencia se lee");
assert(parseCompraMedio("banco") === "transferencia", "banco cuenta como transferencia");
assert(medioDesdeCaja("Fuerte") === "caja_fuerte" && medioDesdeCaja("Chica") === "caja_chica", "la caja del movimiento define el medio");

const cambios = cambiosEntreCompras(compra(), compra({ proveedorNombre: "Corripio", rnc: "101000002", monto: 1200 }));
assert(
  cambios.map((cambio) => cambio.campo).join(",") === "proveedor,monto,rnc",
  "el historial registra proveedor, monto y RNC"
);
assert(cambios[0]?.antes === "Rica" && cambios[0]?.despues === "Corripio", "el historial guarda el valor anterior y el nuevo");
assert(cambiosEntreCompras(compra(), compra()).length === 0, "sin cambios no hay historial");

const dias: AgentMetaDia[] = ["2026-10-01", "2026-10-02", "2026-10-03"].map((fecha, index) =>
  agentMetaDia(fecha, [100, 100, 100, 100, 100, 100, 100], index === 2 ? null : 80)
);
const al2 = acumuladoALaFecha(dias, "2026-10-02");
assert(al2.metaAcumulada === 200 && al2.ventasALaFecha === 160 && al2.deficit === 40, "al 2 la meta acumulada es 200 y el déficit 40");
const al3 = acumuladoALaFecha(dias, "2026-10-03");
assert(al3.metaAcumulada === 300 && al3.ventasALaFecha === 160 && al3.deficit === 140, "un día sin venta entra en el déficit");
assert(corteAcumulado("2026-10", 31, "2026-10-14") === "2026-10-14", "en el mes corriente el corte es hoy");
assert(corteAcumulado("2026-09", 30, "2026-10-14") === "2026-09-30", "un mes pasado se acumula hasta el último día");
assert(corteAcumulado("2026-11", 30, "2026-10-14") === null, "un mes futuro todavía no acumula");
assert(acumuladoALaFecha(dias, null).deficit === null, "sin corte no hay déficit");

const secreto = "secreto-de-prueba-16";
const pedido = agentWebhookRequest({
  url: "https://example.com/hook",
  secret: secreto,
  bearer: "llave",
  tipo: "venta.guardada",
  recurso: { fecha: "2026-10-14", monto: 500 },
  id: "evt-1",
  ocurridoEn: "2026-10-14T12:00:00.000Z",
  timestamp: 1_700_000_000,
});
const firma = pedido.headers[AGENT_SIGNATURE_HEADER] ?? "";
const v1 = firma.split(",v1=")[1];
assert(firma.startsWith("t=1700000000,v1=") && v1 === signAgentPayload(secreto, 1_700_000_000, pedido.body), "el webhook firma el cuerpo con X-Quick-Signature");
assert(!pedido.body.includes(secreto), "el cuerpo del webhook no lleva el secreto");

console.log("agent api ok");
