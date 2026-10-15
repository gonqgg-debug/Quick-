export const CATALOG_PRODUCTS_PAGE_SIZE = 50;

/** Margen por debajo de este valor se marca para verlo al pasar la vista. */
export const MARGEN_BAJO = 0.15;

export const DESCRIPCION_LISTA = 280;

export type CatalogoEstado = "todos" | "activo" | "inactivo" | "sin_costo";

export type AdminCatalogProveedor = {
  id: string;
  nombre: string;
  ultimaCompra: string | null;
};

export type CostoManualFuente = "odoo" | "admin";
export type CostoFuente = "factura" | CostoManualFuente;

export type AdminCatalogProduct = {
  id: string;
  nombre: string;
  descripcion: string | null;
  marca: string | null;
  categoria: string;
  precio: number;
  /** Costo que se muestra: el más reciente entre la factura y el costo manual. */
  costo: number | null;
  costoEn: string | null;
  costoFuente: CostoFuente | null;
  costoFactura: number | null;
  /** Fecha de la factura, para mostrarla. */
  costoFacturaEn: string | null;
  /** Instante con el que se compara el costo manual. Puede incluir la hora de recibido. */
  costoFacturaClave: string | null;
  costoManual: number | null;
  costoManualEn: string | null;
  costoManualFuente: CostoManualFuente | null;
  margen: number | null;
  proveedores: AdminCatalogProveedor[];
  codigoOdoo: string | null;
  codigoBarras: string | null;
  fotoUrl: string | null;
  activo: boolean;
};

export type AdminCatalogCompra = {
  facturaId: string;
  fecha: string | null;
  proveedor: string | null;
  costo: number;
};

export type AdminCatalogPresentacion = {
  presentacion: string;
  etiqueta: string;
  unidades: number;
  proveedor: string | null;
};

export type AdminCatalogProductDetalle = {
  product: AdminCatalogProduct;
  compra: AdminCatalogCompra | null;
  presentaciones: AdminCatalogPresentacion[];
  categories: string[];
};

export type AdminCatalogConteos = {
  activos: number;
  inactivos: number;
  sinCosto: number;
  todos: number;
};

export type AdminCatalogProductFilters = {
  q: string;
  categoria: string;
  estado: CatalogoEstado;
  page: number;
};

export type AdminCatalogComercial = {
  id: string;
  costo: number | null;
  costoEn: string | null;
  proveedores: AdminCatalogProveedor[];
};

export type AdminCatalogProductList = {
  products: AdminCatalogProduct[];
  total: number;
  page: number;
  pageSize: number;
  categories: string[];
  /** Null cuando la lista llegó sola y los conteos se piden aparte. */
  conteos: AdminCatalogConteos | null;
};

export function catalogProductsQueryString(filters: AdminCatalogProductFilters): string {
  const params = new URLSearchParams();
  if (filters.q.trim()) {
    params.set("q", filters.q.trim());
  }
  if (filters.categoria.trim()) {
    params.set("categoria", filters.categoria.trim());
  }
  if (filters.estado !== "todos") {
    params.set("estado", filters.estado);
  }
  if (filters.page > 1) {
    params.set("page", String(filters.page));
  }
  return params.toString();
}

export function isUncategorized(categoria: string | null | undefined): boolean {
  return !categoria?.trim() || /^(all|todos)$/i.test(categoria.trim());
}

export function shortOdooCode(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 14) {
    return trimmed;
  }
  return `…${trimmed.slice(-8)}`;
}

export function etiquetaCostoFuente(fuente: CostoFuente | null): string {
  if (fuente === "factura") {
    return "Factura";
  }
  if (fuente === "odoo") {
    return "Odoo";
  }
  if (fuente === "admin") {
    return "Manual";
  }
  return "";
}

function instanteCosto(value: string | null): number {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? Date.parse(`${value}T00:00:00-04:00`) : Date.parse(value);
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

/** El costo que se muestra es el que tiene la fecha más nueva. En empate queda el de la factura. */
export function elegirCosto(input: {
  facturaCosto: number | null;
  facturaEn: string | null;
  manualCosto: number | null;
  manualEn: string | null;
  manualFuente: CostoManualFuente | null;
}): { costo: number | null; en: string | null; fuente: CostoFuente | null } {
  const factura = input.facturaCosto == null ? null : { costo: input.facturaCosto, en: input.facturaEn, fuente: "factura" as const };
  const manual =
    input.manualCosto == null || input.manualFuente == null
      ? null
      : { costo: input.manualCosto, en: input.manualEn, fuente: input.manualFuente };
  if (!factura) {
    return manual ? { costo: manual.costo, en: manual.en, fuente: manual.fuente } : { costo: null, en: null, fuente: null };
  }
  if (!manual) {
    return { costo: factura.costo, en: factura.en, fuente: factura.fuente };
  }
  if (instanteCosto(manual.en) > instanteCosto(factura.en)) {
    return { costo: manual.costo, en: manual.en, fuente: manual.fuente };
  }
  return { costo: factura.costo, en: factura.en, fuente: factura.fuente };
}

/** (precio − costo) / precio. Null si no hay costo o el precio no alcanza para un margen. */
export function margenDe(precio: number, costo: number | null): number | null {
  if (costo == null || !(precio > 0)) {
    return null;
  }
  return Math.round(((precio - costo) / precio) * 1000) / 1000;
}

export function formatoMargen(margen: number | null): string {
  if (margen == null) {
    return "—";
  }
  const pct = Math.round(margen * 1000) / 10;
  const text = Number.isInteger(pct) ? String(pct) : pct.toFixed(1);
  return `${text}%`;
}

export function margenBajo(margen: number | null): boolean {
  return margen != null && margen < MARGEN_BAJO;
}

/** Recorte para la lista y los bloques. Conserva los saltos de línea. */
export function recorteDescripcion(value: string | null | undefined, max = DESCRIPCION_LISTA): string | null {
  if (!value) {
    return null;
  }
  const limpio = value.replace(/\r\n/g, "\n").trim();
  if (!limpio) {
    return null;
  }
  if (limpio.length <= max) {
    return limpio;
  }
  return `${limpio.slice(0, max - 1).trimEnd()}…`;
}
