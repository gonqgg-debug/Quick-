import { AGENT_EVENT_TYPES } from "../lib/agent-events";
import { parseVentaInput } from "../lib/admin-ventas";
import { leerCamposFactura } from "../lib/facturas-shared";
import {
  assertVersionEditable,
  compararDecisiones,
  mesAnterior,
  puedeCambiarEtapa,
  puedeRegistrar,
  validarCambioEstado,
  OPERACION_AGENT_ENDPOINTS,
} from "../lib/operacion-shared";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const leida = leerCamposFactura({ estado: "Completa" }, "patch");
assert(leida.campos.estado === "registrada", "completa sigue llegando como registrada");

assert(puedeCambiarEtapa("boris", "verificada"), "Boris marca verificada");
assert(!puedeCambiarEtapa("fred", "verificada"), "Fred no marca verificada");
assert(puedeCambiarEtapa("fred", "conciliada"), "Fred marca conciliada");
assert(!puedeCambiarEtapa("boris", "conciliada"), "Boris no marca conciliada");
assert(puedeCambiarEtapa("phillip", "registrada"), "Phillip marca registrada");
assert(puedeCambiarEtapa("fred", "falta_factura"), "Fred deja falta factura");
assert(!puedeRegistrar({ esCompraPersonal: false, lineas: 3, lineasSinRecepcion: 1 }), "con una línea sin recepción no se registra");
assert(puedeRegistrar({ esCompraPersonal: false, lineas: 3, lineasSinRecepcion: 0 }), "con todas las líneas confirmadas sí se registra");
assert(!puedeRegistrar({ esCompraPersonal: false, lineas: 0, lineasSinRecepcion: 0 }), "sin productos no se registra");
assert(puedeRegistrar({ esCompraPersonal: true, lineas: 0, lineasSinRecepcion: 0 }), "la compra personal no espera a la tienda");

let bloqueada = false;
try {
  validarCambioEstado({ actor: "phillip", estado: "registrada", esCompraPersonal: false, lineas: 2, lineasSinRecepcion: 2 });
} catch (error) {
  bloqueada = error instanceof Error && error.message.includes("Rodrigo todavía no confirma la recepción de 2 líneas");
}
assert(bloqueada, "Phillip no cierra registrada sin la recepción");
assert(OPERACION_AGENT_ENDPOINTS.some((item) => item.path.endsWith("/recepcion")), "el directorio lista la recepción de Rodrigo");

let aprobada = false;
try {
  assertVersionEditable("aprobada");
} catch (error) {
  aprobada = error instanceof Error && error.message.includes("versión nueva");
}
assert(aprobada, "la versión aprobada no se edita");
assertVersionEditable("preliminar");

const orden = [
  { monto: 10000, venceEn: "2026-10-01", creadaEn: "2026-10-01T00:00:00.000Z", nombre: "Cristóbal" },
  { monto: null, venceEn: "2026-09-01", creadaEn: "2026-09-01T00:00:00.000Z", nombre: "Sin monto" },
  { monto: 50000, venceEn: "2026-10-20", creadaEn: "2026-10-02T00:00:00.000Z", nombre: "Abreu" },
  { monto: 50000, venceEn: "2026-10-05", creadaEn: "2026-10-03T00:00:00.000Z", nombre: "Abreu corto" },
].sort(compararDecisiones);
assert(orden[0]?.nombre === "Abreu corto", "el monto más alto y el vencimiento más cercano salen primero");
assert(orden[1]?.nombre === "Abreu", "el mismo monto se ordena por vencimiento");
assert(orden[2]?.nombre === "Cristóbal", "Cristóbal queda debajo de Abreu");
assert(orden[3]?.nombre === "Sin monto", "sin plata va al final");
assert(mesAnterior("2026-01") === "2025-12", "enero mira diciembre");

const venta = parseVentaInput({ fecha: "2026-01-05", ventaReal: "1.250,00" });
assert(venta.fecha === "2026-01-05" && venta.monto === 1250, "Rodrigo puede mandar la venta con ventaReal");
let ventaFutura = false;
try {
  parseVentaInput({ fecha: "2099-01-01", monto: 10 });
} catch (error) {
  ventaFutura = error instanceof Error && error.message === "La fecha no es válida";
}
assert(ventaFutura, "una venta futura no se guarda");

assert(OPERACION_AGENT_ENDPOINTS.some((item) => item.method === "POST" && item.path.endsWith("/pagos")), "el directorio lista cómo Fred liga pagos");
assert(OPERACION_AGENT_ENDPOINTS.some((item) => item.method === "DELETE" && item.path.includes("/pagos/")), "el directorio lista cómo Fred quita un pago");
assert(OPERACION_AGENT_ENDPOINTS.some((item) => item.path.startsWith("/api/agent/pendientes")), "el directorio lista los pendientes");
assert(OPERACION_AGENT_ENDPOINTS.some((item) => item.path.endsWith("/conciliacion") && item.describe.includes("ledgerId")), "la conciliación explica ledgerId");
assert((AGENT_EVENT_TYPES as readonly string[]).includes("factura.recordatorio"), "el recordatorio se publica como evento");

console.log("operacion ok");
