import { PROPUESTA_UMBRAL, formatMonto, resumenRecepcion, type FacturaDetalle, type FacturaResumen } from "@/lib/facturas-shared";
import { diffDayKeys, isDayKey } from "@/lib/local-day";
import { esOperacionBot, type OperacionBot } from "@/lib/operacion-shared";

export type PendienteSeccion = "datos" | "productos" | "equipo" | "validaciones" | "preguntas" | "notas" | "documento";

export type Pendiente = {
  id: string;
  texto: string;
  seccion: PendienteSeccion;
  grave: boolean;
  /** Quién lo resuelve. Null cuando lo resuelve el admin. */
  dueno: OperacionBot | null;
};

/** Avisa del vencimiento cuando faltan 3 días o menos. */
export const VENCE_AVISO_DIAS = 3;

/** Lo mínimo para armar la lista. La ficha lo saca del detalle; GET /api/agent/pendientes lo arma con consultas agregadas. */
export type PendientesInput = Pick<
  FacturaResumen,
  | "problema"
  | "problemaDueno"
  | "problemaDesde"
  | "problemaFalta"
  | "posibleDuplicado"
  | "duplicadoReferencia"
  | "preguntasAbiertas"
  | "estado"
  | "esCompraPersonal"
  | "moneda"
  | "tieneFoto"
  | "tipoDocumento"
  | "facturaOrigenId"
  | "fechaVencimiento"
  | "subtotal"
  | "descuentoTotal"
  | "itbisTotal"
  | "otrosCargos"
  | "total"
> & {
  recepcion: { lineas: number; sinConfirmar: number; faltantes: number; diferencia: number };
  lineasSinCatalogo: number;
  validacionesConDiferencia: number;
  /** Null cuando no se buscaron (la lista agregada no los busca). */
  pagosCandidatos: number | null;
  pagosDiferencia: number | null;
};

/** Subtotal − descuento + ITBIS + otros cargos, menos el total. Null sin subtotal o sin total; 0 si la diferencia es menor a RD$ 1. */
export function diferenciaMontos(
  factura: Pick<FacturaResumen, "subtotal" | "descuentoTotal" | "itbisTotal" | "otrosCargos" | "total">
): number | null {
  if (factura.subtotal == null || factura.total == null) {
    return null;
  }
  const calculado = factura.subtotal - (factura.descuentoTotal ?? 0) + (factura.itbisTotal ?? 0) + (factura.otrosCargos ?? 0);
  const diferencia = Math.round((calculado - factura.total) * 100) / 100;
  return Math.abs(diferencia) >= 1 ? diferencia : 0;
}

export function lineasSinCatalogo(lineas: FacturaDetalle["lineas"]): number {
  return lineas.filter((linea) => !linea.productoId && (!linea.propuesta || linea.propuesta.confianza < PROPUESTA_UMBRAL)).length;
}

export function pendientesInputDe(factura: FacturaDetalle): PendientesInput {
  return {
    ...factura,
    recepcion: resumenRecepcion(factura.lineas),
    lineasSinCatalogo: lineasSinCatalogo(factura.lineas),
    validacionesConDiferencia: factura.validaciones.filter((validacion) => validacion.resultado === "diferencia").length,
    pagosCandidatos: factura.pagosCandidatos.length,
    pagosDiferencia: factura.pagos.length ? factura.pagosDiferencia : null,
  };
}

function duenoDe(value: string | null): OperacionBot | null {
  return value && esOperacionBot(value) ? value : null;
}

function textoVence(dias: number): string {
  if (dias < 0) {
    return dias === -1 ? "Venció ayer y no está pagada." : `Venció hace ${-dias} días y no está pagada.`;
  }
  if (dias === 0) {
    return "Vence hoy y no está pagada.";
  }
  return dias === 1 ? "Vence mañana y no está pagada." : `Vence en ${dias} días y no está pagada.`;
}

/** Lo que le falta a la factura, en orden de gravedad, con quién lo resuelve. */
export function pendientesDe(factura: PendientesInput, opciones: { hoy: string; formatDesde: (value: string | null) => string }): Pendiente[] {
  const items: Pendiente[] = [];
  const conciliada = factura.estado === "conciliada";
  const esNota = factura.tipoDocumento === "nota_credito";
  if (factura.problema) {
    const quien = factura.problemaDueno ? `lo tiene ${factura.problemaDueno}` : "sin dueño";
    items.push({
      id: "problema",
      texto: `Con problema, ${quien} desde ${opciones.formatDesde(factura.problemaDesde)}.${factura.problemaFalta ? ` ${factura.problemaFalta}` : ""}`,
      seccion: "equipo",
      grave: true,
      dueno: duenoDe(factura.problemaDueno),
    });
  }
  if (factura.posibleDuplicado) {
    items.push({
      id: "duplicado",
      texto: factura.duplicadoReferencia ? `Posible duplicado de ${factura.duplicadoReferencia}.` : "Posible duplicado.",
      seccion: "datos",
      grave: true,
      dueno: null,
    });
  }
  if (factura.preguntasAbiertas > 0) {
    items.push({
      id: "preguntas",
      texto: factura.preguntasAbiertas === 1 ? "Hay 1 pregunta abierta." : `Hay ${factura.preguntasAbiertas} preguntas abiertas.`,
      seccion: "preguntas",
      grave: false,
      dueno: null,
    });
  }
  const { recepcion } = factura;
  if (factura.estado === "recibida" && !factura.esCompraPersonal && recepcion.sinConfirmar > 0) {
    items.push({
      id: "recepcion",
      texto:
        recepcion.sinConfirmar === 1
          ? "Rodrigo todavía no confirma la recepción de 1 línea."
          : `Rodrigo todavía no confirma la recepción de ${recepcion.sinConfirmar} líneas.`,
      seccion: "productos",
      grave: false,
      dueno: "rodrigo",
    });
  }
  if (recepcion.faltantes > 0) {
    items.push({
      id: "faltantes",
      texto: `${recepcion.faltantes === 1 ? "Una línea llegó incompleta" : `${recepcion.faltantes} líneas llegaron incompletas`}${recepcion.diferencia ? `: faltan ${formatMonto(recepcion.diferencia, factura.moneda)}` : ""}.`,
      seccion: "productos",
      grave: true,
      dueno: "rodrigo",
    });
  }
  if (factura.lineasSinCatalogo > 0) {
    items.push({
      id: "catalogo",
      texto:
        factura.lineasSinCatalogo === 1
          ? "Una línea no tiene producto del catálogo ni una propuesta confiable."
          : `${factura.lineasSinCatalogo} líneas no tienen producto del catálogo ni una propuesta confiable.`,
      seccion: "productos",
      grave: false,
      dueno: "phillip",
    });
  }
  if (!factura.tieneFoto) {
    items.push({ id: "foto", texto: "Falta la foto o el PDF original.", seccion: "documento", grave: false, dueno: "rodrigo" });
  }
  if (factura.validacionesConDiferencia > 0) {
    items.push({
      id: "validaciones",
      texto: factura.validacionesConDiferencia === 1 ? "Una validación dio diferencia." : `${factura.validacionesConDiferencia} validaciones dieron diferencia.`,
      seccion: "validaciones",
      grave: true,
      dueno: "boris",
    });
  }
  if (diferenciaMontos(factura)) {
    items.push({ id: "montos", texto: "Los montos no suman el total.", seccion: "datos", grave: true, dueno: "phillip" });
  }
  if (esNota && !factura.facturaOrigenId) {
    items.push({
      id: "nota_origen",
      texto: "La nota de crédito no está ligada a su factura original.",
      seccion: "datos",
      grave: true,
      dueno: "rodrigo",
    });
  }
  if (!conciliada && !esNota && !factura.esCompraPersonal) {
    if (factura.pagosDiferencia != null && factura.pagosDiferencia !== 0) {
      items.push({
        id: "pago_diferencia",
        texto:
          factura.pagosDiferencia > 0
            ? `Lo ligado en caja no llega al total: faltan ${formatMonto(factura.pagosDiferencia, factura.moneda)}.`
            : `Lo ligado en caja pasa del total por ${formatMonto(-factura.pagosDiferencia, factura.moneda)}.`,
        seccion: "equipo",
        grave: true,
        dueno: "fred",
      });
    } else if (factura.pagosDiferencia == null && factura.pagosCandidatos) {
      items.push({
        id: "pago_candidato",
        texto: factura.pagosCandidatos === 1 ? "Hay un posible pago en caja para ligar." : `Hay ${factura.pagosCandidatos} posibles pagos en caja para ligar.`,
        seccion: "equipo",
        grave: false,
        dueno: "fred",
      });
    }
    if (factura.fechaVencimiento && isDayKey(factura.fechaVencimiento) && factura.pagosDiferencia !== 0) {
      const dias = diffDayKeys(opciones.hoy, factura.fechaVencimiento);
      if (dias <= VENCE_AVISO_DIAS) {
        items.push({ id: "vencimiento", texto: textoVence(dias), seccion: "equipo", grave: dias < 0, dueno: "fred" });
      }
    }
  }
  return items;
}
