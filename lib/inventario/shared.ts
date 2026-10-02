export type InventarioOrigen = "agente" | "admin" | "pos";

export type InventarioMovimientoTipo =
  | "recepcion"
  | "venta"
  | "ajuste"
  | "merma"
  | "conteo"
  | "devolucion_proveedor";

export type Existencia = {
  productoId: string;
  nombre: string;
  marca: string | null;
  codigoOdoo: string | null;
  codigoBarras: string | null;
  precio: number;
  tienda: string;
  cantidad: number;
  costoPromedio: number | null;
  ultimoCosto: number | null;
  puntoReorden: number;
};

export type Movimiento = {
  id: string;
  productoId: string;
  productoNombre: string | null;
  tienda: string;
  tipo: InventarioMovimientoTipo;
  cantidad: number;
  costoUnitario: number | null;
  stockAntes: number;
  stockDespues: number;
  costoPromedioDespues: number | null;
  facturaId: string | null;
  facturaLineaId: string | null;
  compraId: string | null;
  origen: InventarioOrigen;
  nota: string | null;
  referencia: string | null;
  creadoEn: string;
};

export type RecepcionLineaAplicada = {
  numeroLinea: number;
  productoId: string;
  unidades: number;
  costoUnitario: number;
};

export type RecepcionLineaOmitida = {
  numeroLinea: number;
  motivo: string;
};

export type RecepcionResultado = {
  estado: "pendiente" | "parcial" | "aplicada";
  compraId: string | null;
  aplicadas: RecepcionLineaAplicada[];
  omitidas: RecepcionLineaOmitida[];
  yaAplicadas: number;
};

export const INVENTARIO_PAGE_SIZE = 100;
