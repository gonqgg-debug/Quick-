import { motivoNoRegistrable, type RecepcionConteo } from "@/lib/operacion-shared";
import { resumenRecepcion, type FacturaDetalle } from "@/lib/facturas-shared";
import { pendientesDe as pendientesBase, pendientesInputDe, type Pendiente, type PendienteSeccion } from "@/lib/facturas-pendientes";
import { todayDayKey } from "@/lib/local-day";

export { diferenciaMontos, type Pendiente } from "@/lib/facturas-pendientes";

export type SeccionId = PendienteSeccion;

export const SECCIONES: Array<{ id: Exclude<SeccionId, "documento">; label: string }> = [
  { id: "datos", label: "Datos" },
  { id: "productos", label: "Productos" },
  { id: "equipo", label: "Equipo" },
  { id: "validaciones", label: "Validaciones" },
  { id: "preguntas", label: "Preguntas" },
  { id: "notas", label: "Notas" },
];

export function conteoRecepcion(factura: FacturaDetalle): RecepcionConteo {
  const resumen = resumenRecepcion(factura.lineas);
  return { esCompraPersonal: factura.esCompraPersonal, lineas: resumen.lineas, lineasSinRecepcion: resumen.sinConfirmar };
}

/** Null when Phillip can mark it registrada. */
export function bloqueoRegistro(factura: FacturaDetalle): string | null {
  return motivoNoRegistrable(conteoRecepcion(factura));
}

export function pendientesDe(factura: FacturaDetalle, formatDesde: (value: string | null) => string): Pendiente[] {
  return pendientesBase(pendientesInputDe(factura), { hoy: todayDayKey(), formatDesde });
}
