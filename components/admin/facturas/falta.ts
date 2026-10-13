import { puedeRegistrar } from "@/lib/operacion-shared";
import type { FacturaDetalle } from "@/lib/facturas-shared";

export type SeccionId = "datos" | "productos" | "equipo" | "validaciones" | "preguntas" | "notas" | "documento";

export const SECCIONES: Array<{ id: Exclude<SeccionId, "documento">; label: string }> = [
  { id: "datos", label: "Datos" },
  { id: "productos", label: "Productos" },
  { id: "equipo", label: "Equipo" },
  { id: "validaciones", label: "Validaciones" },
  { id: "preguntas", label: "Preguntas" },
  { id: "notas", label: "Notas" },
];

/** Subtotal − descuento + ITBIS + otros cargos, minus total. Null when the invoice lacks subtotal or total. */
export function diferenciaMontos(factura: FacturaDetalle): number | null {
  if (factura.subtotal == null || factura.total == null) {
    return null;
  }
  const calculado = factura.subtotal - (factura.descuentoTotal ?? 0) + (factura.itbisTotal ?? 0) + (factura.otrosCargos ?? 0);
  const diferencia = Math.round((calculado - factura.total) * 100) / 100;
  return Math.abs(diferencia) >= 1 ? diferencia : 0;
}

export function faltaRespuestaTienda(factura: FacturaDetalle): boolean {
  return factura.estado === "recibida" && !puedeRegistrar({ esCompraPersonal: factura.esCompraPersonal, confirmacionEn: factura.confirmacionEn });
}

export type Pendiente = { id: string; texto: string; seccion: SeccionId; grave: boolean };

export function pendientesDe(factura: FacturaDetalle, formatDesde: (value: string | null) => string): Pendiente[] {
  const items: Pendiente[] = [];
  if (factura.problema) {
    const quien = factura.problemaDueno ? `lo tiene ${factura.problemaDueno}` : "sin dueño";
    items.push({
      id: "problema",
      texto: `Con problema, ${quien} desde ${formatDesde(factura.problemaDesde)}.${factura.problemaFalta ? ` ${factura.problemaFalta}` : ""}`,
      seccion: "equipo",
      grave: true,
    });
  }
  if (factura.posibleDuplicado) {
    items.push({
      id: "duplicado",
      texto: factura.duplicadoReferencia ? `Posible duplicado de ${factura.duplicadoReferencia}.` : "Posible duplicado.",
      seccion: "datos",
      grave: true,
    });
  }
  const abiertas = factura.preguntas.filter((pregunta) => pregunta.estado === "abierta").length;
  if (abiertas > 0) {
    items.push({
      id: "preguntas",
      texto: abiertas === 1 ? "Hay 1 pregunta abierta." : `Hay ${abiertas} preguntas abiertas.`,
      seccion: "preguntas",
      grave: false,
    });
  }
  if (faltaRespuestaTienda(factura)) {
    items.push({ id: "ramon", texto: "Falta la respuesta de Ramón para que Phillip la registre.", seccion: "equipo", grave: false });
  }
  if (!factura.tieneFoto) {
    items.push({ id: "foto", texto: "Falta la foto o el PDF original.", seccion: "documento", grave: false });
  }
  const diferencias = factura.validaciones.filter((validacion) => validacion.resultado === "diferencia").length;
  if (diferencias > 0) {
    items.push({
      id: "validaciones",
      texto: diferencias === 1 ? "Una validación dio diferencia." : `${diferencias} validaciones dieron diferencia.`,
      seccion: "validaciones",
      grave: true,
    });
  }
  const diferencia = diferenciaMontos(factura);
  if (diferencia) {
    items.push({ id: "montos", texto: "Los montos no suman el total.", seccion: "datos", grave: true });
  }
  return items;
}
