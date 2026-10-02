export type InventarioEstado = "pendiente" | "parcial" | "aplicada";

export type LineaRecepcionInput = {
  unidadesTotales: number | null;
  cantidadComprada: number | null;
  presentacion: string | null;
  costoUnitario: number | null;
  costoPorPresentacion: number | null;
  productoId: string | null;
};

export type LineaRecepcionOk = {
  ok: true;
  unidades: number;
  costoUnitario: number;
};

export type LineaRecepcionOmitida = {
  ok: false;
  motivo: string;
};

export function roundCantidad(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function roundCosto(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export function normalizarTienda(value: unknown): string {
  if (typeof value !== "string") {
    return "quick";
  }
  const tienda = value.trim().toLowerCase().slice(0, 40);
  return tienda || "quick";
}

/** Unidades que entran al stock. Caja, paquete o fardo sin unidades no se adivinan. */
export function evaluarLineaRecepcion(linea: LineaRecepcionInput): LineaRecepcionOk | LineaRecepcionOmitida {
  if (!linea.productoId) {
    return { ok: false, motivo: "sin producto" };
  }
  const unidadesTotales = linea.unidadesTotales;
  const cantidad = linea.cantidadComprada;
  let unidades: number | null = null;
  if (unidadesTotales != null && unidadesTotales > 0) {
    unidades = unidadesTotales;
  } else if (linea.presentacion === "unidad" && cantidad != null && cantidad > 0) {
    unidades = cantidad;
  } else if (linea.presentacion && linea.presentacion !== "unidad") {
    return { ok: false, motivo: "sin unidades por presentacion" };
  } else {
    return { ok: false, motivo: "sin cantidad" };
  }
  const costo =
    linea.costoUnitario != null && linea.costoUnitario >= 0
      ? linea.costoUnitario
      : linea.presentacion === "unidad" && linea.costoPorPresentacion != null && linea.costoPorPresentacion >= 0
        ? linea.costoPorPresentacion
        : null;
  if (costo == null) {
    return { ok: false, motivo: "sin costo" };
  }
  return { ok: true, unidades: roundCantidad(unidades), costoUnitario: roundCosto(costo) };
}

/**
 * Promedio ponderado. Con stock en cero o negativo, el promedio pasa a ser el costo de esta recepción.
 */
export function costoPromedioSiguiente(
  stockAntes: number,
  costoPromedio: number | null,
  unidades: number,
  costoUnitario: number
): number {
  if (!(unidades > 0)) {
    return costoPromedio == null ? roundCosto(costoUnitario) : roundCosto(costoPromedio);
  }
  if (stockAntes > 0 && costoPromedio != null && costoPromedio >= 0) {
    return roundCosto((stockAntes * costoPromedio + unidades * costoUnitario) / (stockAntes + unidades));
  }
  return roundCosto(costoUnitario);
}

export function estadoInventario(aplicadas: number, omitidas: number): InventarioEstado {
  if (aplicadas <= 0) {
    return "pendiente";
  }
  if (omitidas <= 0) {
    return "aplicada";
  }
  return "parcial";
}
