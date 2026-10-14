import { motivoNoRegistrable, type RecepcionConteo } from "@/lib/operacion-shared";
import { PROPUESTA_UMBRAL, formatMonto, resumenRecepcion, type FacturaDetalle } from "@/lib/facturas-shared";

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

export function conteoRecepcion(factura: FacturaDetalle): RecepcionConteo {
  const resumen = resumenRecepcion(factura.lineas);
  return { esCompraPersonal: factura.esCompraPersonal, lineas: resumen.lineas, lineasSinRecepcion: resumen.sinConfirmar };
}

/** Null when Phillip can mark it registrada. */
export function bloqueoRegistro(factura: FacturaDetalle): string | null {
  return motivoNoRegistrable(conteoRecepcion(factura));
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
  const recepcion = resumenRecepcion(factura.lineas);
  if (factura.estado === "recibida" && !factura.esCompraPersonal && recepcion.sinConfirmar > 0) {
    items.push({
      id: "recepcion",
      texto:
        recepcion.sinConfirmar === 1
          ? "Rodrigo todavía no confirma la recepción de 1 línea."
          : `Rodrigo todavía no confirma la recepción de ${recepcion.sinConfirmar} líneas.`,
      seccion: "productos",
      grave: false,
    });
  }
  if (recepcion.faltantes > 0) {
    items.push({
      id: "faltantes",
      texto: `${recepcion.faltantes === 1 ? "Una línea llegó incompleta" : `${recepcion.faltantes} líneas llegaron incompletas`}${recepcion.diferencia ? `: faltan ${formatMonto(recepcion.diferencia, factura.moneda)}` : ""}.`,
      seccion: "productos",
      grave: true,
    });
  }
  const bajas = factura.lineas.filter((linea) => !linea.productoId && (!linea.propuesta || linea.propuesta.confianza < PROPUESTA_UMBRAL)).length;
  if (bajas > 0) {
    items.push({
      id: "catalogo",
      texto: bajas === 1 ? "Una línea no tiene producto del catálogo ni una propuesta confiable." : `${bajas} líneas no tienen producto del catálogo ni una propuesta confiable.`,
      seccion: "productos",
      grave: false,
    });
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
