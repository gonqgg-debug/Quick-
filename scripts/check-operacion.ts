import { parseVentaInput } from "../lib/admin-ventas";
import { leerCamposFactura } from "../lib/facturas-shared";
import {
  assertVersionEditable,
  compararDecisiones,
  mesAnterior,
  puedeCambiarEtapa,
  puedeRegistrar,
  validarCambioEstado,
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
assert(!puedeRegistrar({ esCompraPersonal: false, confirmacionEn: null }), "sin Ramón no se registra");
assert(puedeRegistrar({ esCompraPersonal: false, confirmacionEn: "2026-10-01T12:00:00.000Z" }), "con Ramón sí se registra");
assert(puedeRegistrar({ esCompraPersonal: true, confirmacionEn: null }), "la compra personal no espera a la tienda");

let bloqueada = false;
try {
  validarCambioEstado({ actor: "phillip", estado: "registrada", esCompraPersonal: false, confirmacionEn: null });
} catch (error) {
  bloqueada = error instanceof Error && error.message.includes("Ramón");
}
assert(bloqueada, "Phillip no cierra registrada sin la respuesta");

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

console.log("operacion ok");
