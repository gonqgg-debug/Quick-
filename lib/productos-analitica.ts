import { codigoVisible } from "@/lib/consumo-metricas";
import type { ProductoConsumo } from "@/lib/pos-consumo";

export type VistaProductos = "ventas" | "rentabilidad";

export type ColumnaExtra = "categoria" | "marca" | "sku" | "costo" | "fuente" | "estado";

export const COLUMNAS_EXTRA: Array<{ id: ColumnaExtra; etiqueta: string }> = [
  { id: "categoria", etiqueta: "Categoría" },
  { id: "marca", etiqueta: "Marca" },
  { id: "sku", etiqueta: "SKU" },
  { id: "costo", etiqueta: "Costo unitario de referencia" },
  { id: "fuente", etiqueta: "Fuente y fecha del costo" },
  { id: "estado", etiqueta: "Estado del costo" },
];

export const COLUMNAS_VACIAS: Record<ColumnaExtra, boolean> = {
  categoria: false,
  marca: false,
  sku: false,
  costo: false,
  fuente: false,
  estado: false,
};

export type EtiquetaVariacion = { tipo: "pct"; valor: number } | { tipo: "nuevo" } | { tipo: "sin_base" };

export function parseVista(raw: string | null): VistaProductos {
  return raw === "rentabilidad" ? "rentabilidad" : "ventas";
}

export function parseSinCosto(raw: string | null): boolean {
  return raw === "1" || raw === "true";
}

/** Base anterior en cero es una venta nueva. Base ausente no es lo mismo y no se muestra como cero. */
export function etiquetaVariacion(ventaAnterior: number | null, variacion: number | null): EtiquetaVariacion {
  if (ventaAnterior == null) {
    return { tipo: "sin_base" };
  }
  if (ventaAnterior === 0) {
    return { tipo: "nuevo" };
  }
  if (variacion == null || !Number.isFinite(variacion)) {
    return { tipo: "sin_base" };
  }
  return { tipo: "pct", valor: variacion };
}

/** El total no es un producto nuevo: una base de cero se queda en sin base. */
export function etiquetaVariacionTotal(actual: number | null, anterior: number | null): EtiquetaVariacion {
  if (actual == null || anterior == null || anterior === 0) {
    return { tipo: "sin_base" };
  }
  const valor = (actual - anterior) / Math.abs(anterior);
  if (!Number.isFinite(valor)) {
    return { tipo: "sin_base" };
  }
  return { tipo: "pct", valor };
}

export function formatParticipacion(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  const formatted = new Intl.NumberFormat("es-DO", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value * 100);
  return `${formatted}%`;
}

export function estadoCosto(costo: number | null): "Estimado" | "Sin costo" {
  return costo == null ? "Sin costo" : "Estimado";
}

export function textoOrigenCosto(origen: string | null): string {
  if (origen === "manual") {
    return "Manual";
  }
  if (origen === "factura") {
    return "Última factura";
  }
  return origen?.trim() ? origen : "Referencia";
}

export function secundarioProducto(row: { nombre: string; marca: string | null; codigo: string }): string | null {
  const partes: string[] = [];
  const marca = row.marca?.trim();
  if (marca && !row.nombre.toLowerCase().includes(marca.toLowerCase())) {
    partes.push(marca);
  }
  const sku = codigoVisible(row.codigo);
  if (sku && !row.nombre.includes(sku)) {
    partes.push(sku);
  }
  return partes.length > 0 ? partes.join(" · ") : null;
}

/** Utilidad de las ventas con costo, dividida entre sus ventas netas. No promedia porcentajes. */
export function margenAgregado(margen: number | null, ventaNetaConCosto: number): number | null {
  if (margen == null || !(ventaNetaConCosto > 0) || !Number.isFinite(margen)) {
    return null;
  }
  return margen / ventaNetaConCosto;
}

export function coberturaVentas(ventaConCosto: number, venta: number): number | null {
  if (!(venta > 0) || !Number.isFinite(ventaConCosto)) {
    return null;
  }
  return ventaConCosto / venta;
}

export function celdaCsv(value: string | number | null | undefined): string {
  if (value == null) {
    return "";
  }
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function csvProductos(filas: ProductoConsumo[], denominador: number, comparar: boolean): string {
  const encabezado = [
    "Producto",
    "Marca",
    "SKU",
    "Barras",
    "Categoría",
    "Unidades",
    "Ventas con ITBIS",
    "Participación",
    "Variación de ventas",
    "Ventas netas",
    "Costo de ventas",
    "Utilidad bruta",
    "Margen bruto",
    "Estado del costo",
    "Origen del costo",
    "Fecha del costo",
  ];
  const lineas = filas.map((row) => {
    const parte = denominador > 0 ? row.venta / denominador : null;
    const variacion = !comparar
      ? ""
      : textoPlanoVariacion(etiquetaVariacion(row.ventaAnterior, row.variacion));
    return [
      row.nombre,
      row.marca,
      codigoVisible(row.codigo),
      row.codigoBarras,
      row.categoria,
      row.unidades,
      row.venta,
      parte == null ? "" : Number((parte * 100).toFixed(1)),
      variacion,
      row.ventaNeta,
      row.costoVentas,
      row.margen,
      row.margenPct == null ? "" : Number((row.margenPct * 100).toFixed(1)),
      estadoCosto(row.costo),
      row.costo == null ? "" : textoOrigenCosto(row.costoOrigen),
      row.costoFecha,
    ].map(celdaCsv).join(",");
  });
  return `\uFEFF${encabezado.join(",")}\n${lineas.join("\n")}`;
}

export function textoPlanoVariacion(etiqueta: EtiquetaVariacion): string {
  if (etiqueta.tipo === "nuevo") {
    return "Nuevo";
  }
  if (etiqueta.tipo === "sin_base") {
    return "Sin base";
  }
  const pct = etiqueta.valor * 100;
  const formatted = new Intl.NumberFormat("es-DO", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  }).format(pct);
  if (!Number.isFinite(pct)) {
    return "Sin base";
  }
  if (Math.abs(etiqueta.valor) < 0.0005) {
    return `igual ${formatted}%`;
  }
  return `${etiqueta.valor > 0 ? "sube" : "baja"} ${formatted}%`;
}
