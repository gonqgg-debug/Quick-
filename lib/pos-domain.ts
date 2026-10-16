import { addDaysToDayKey, diffDayKeys, isDayKey, isoWeekdayMonday1, localDayKey, todayDayKey, STAFF_TIMEZONE } from "@/lib/local-day";

export const POS_MAX_LINEAS = 1500;
export const POS_MAX_SESIONES = 1;
export const POS_REMATCH_MAX_LINEAS = 500;
export const POS_REMATCH_MAX_FECHAS = 31;
export const CONSUMO_PAGE_DEFAULT = 50;
export const CONSUMO_PAGE_MAX = 500;
export const PERIODO_MAX_DIAS = 366;
export const CANASTA_MIN_ORDENES = 5;
export const TIENDA_DEFAULT = "quick";
/** El precio cobrado en caja ya incluye este ITBIS. No se suma encima. */
export const ITBIS_TASA = 0.18;

export const POS_AGENT_ENDPOINTS = [
  {
    method: "POST",
    path: "/api/agent/pos/sesiones",
    describe:
      "Rodrigo empuja una sesión cerrada. Acepta un objeto sesion o sesiones con una sola. modo completo reemplaza lo que no venga; parcial agrega sin borrar ni recalcular; final cierra el lote y recalcula. Máximo 1.500 líneas por request, sin tope por sesión. La tasa es tasaItbis (0, 16 o 18). tax_ids son ids de account.tax, no el porcentaje: se resuelven con impuestos [{id, tasa}]. Solo paid, done e invoiced cuentan. No manda categoría ni costo de Odoo.",
  },
  {
    method: "POST",
    path: "/api/agent/pos/rematch",
    describe:
      "Procesa la cola de re-cruce. Cada llamada toca como máximo 500 líneas y 31 fechas. Lo que no entra sigue pendiente y el cursor no se salta esas líneas. Responde procesadas, pendientes y fechas. Cambiar codigo_odoo o tasa_itbis solo encola; no recalcula en el mismo request.",
  },
  {
    method: "GET",
    path: "/api/agent/pos/partes",
    describe: "Sesiones que llegaron en modo parcial y todavía no tienen el envío final. Cada una trae odooId, fechaOperativa y loteId.",
  },
  {
    method: "GET",
    path: "/api/agent/pos/sesiones?desde=YYYY-MM-DD",
    describe: "Sesiones ya cargadas, con ultimoOdooId para retomar el backfill. limit y cursor, máximo 500.",
  },
  {
    method: "GET",
    path: "/api/agent/pos/sin-match?desde=&hasta=",
    describe: "Productos vendidos sin cruce al catálogo: código, nombre de Odoo, unidades, venta y última venta. Ordenado por venta.",
  },
  {
    method: "GET",
    path: "/api/agent/consumo/top?desde=&hasta=&orden=venta",
    describe: "Top de productos desde resúmenes. orden: venta, unidades, margen o variacion. categoria y q filtran. Margen null significa sin costo.",
  },
  {
    method: "GET",
    path: "/api/agent/consumo/sin-movimiento?dias=30",
    describe: "Productos activos del catálogo sin unidades en 14, 30 o 60 días.",
  },
  {
    method: "GET",
    path: "/api/agent/consumo/sin-costo?dias=30",
    describe: "Productos vendidos sin costo vigente, ordenados por venta. dias: 7, 30 o 60.",
  },
  {
    method: "GET",
    path: "/api/agent/consumo/horarios?desde=&hasta=",
    describe: "Mapa hora por día de la semana. metrica: venta, ordenes o unidades. categoria opcional.",
  },
  {
    method: "GET",
    path: "/api/agent/consumo/canasta?semana=YYYY-MM-DD",
    describe: "Pares de la semana ISO (lunes) con soporte y lift. Solo pares con al menos 5 órdenes.",
  },
  {
    method: "GET",
    path: "/api/agent/consumo/ticket?desde=&hasta=",
    describe: "Ticket promedio y unidades por ticket, por día y por turno.",
  },
  {
    method: "GET",
    path: "/api/agent/consumo/tendencias?hasta=YYYY-MM-DD",
    describe: "Semana contra semana, mes contra mes, y productos que suben o caen.",
  },
] as const;

const FORBIDDEN_KEYS = new Set([
  "categ_id",
  "categid",
  "pos_category",
  "poscategory",
  "category_id",
  "categoryid",
  "standard_price",
  "standardprice",
  "total_cost",
  "totalcost",
  "categoria",
  "costo",
  "costo_unitario",
  "costounitario",
]);

export type MetodoPago = "efectivo" | "banco" | "credito" | "tarjeta" | "otro";
export type OrdenConsumo = "venta" | "unidades" | "margen" | "variacion" | "variacion_asc";
export type MetricaHorario = "venta" | "ordenes" | "unidades";
export type PresetPeriodo = "7d" | "30d" | "mes" | "custom";

export type PosLinea = {
  odooId: number;
  odooProductId: number;
  odooTmplId: number | null;
  codigoOdoo: string | null;
  nombreOdoo: string | null;
  cantidad: number;
  precioUnit: number | null;
  descuento: number | null;
  subtotal: number | null;
  subtotalConItbis: number | null;
  odooRefundedLineId: number | null;
  tasaItbis: number | null;
  impuestoOdooIds: number[];
};

export type PosImpuesto = {
  id: number;
  tasa: number;
};

export type PosPago = {
  odooId: number;
  metodoOdooId: number | null;
  metodo: string | null;
  monto: number;
  fecha: string | null;
  esCambio: boolean;
  tipoTarjeta: string | null;
};

export type PosOrden = {
  odooId: number;
  nombre: string | null;
  posReference: string | null;
  fecha: string;
  total: number;
  impuesto: number | null;
  pagado: number | null;
  cambio: number | null;
  estado: string | null;
  ncf: string | null;
  clienteOdooId: number | null;
  empleadoOdooId: number | null;
  lineas: PosLinea[];
  pagos: PosPago[];
};

export type PosSesion = {
  odooId: number;
  nombre: string;
  odooConfigId: number | null;
  estado: string;
  startAt: string;
  stopAt: string | null;
  totalPagos: number | null;
  efectivoInicial: number | null;
  efectivoFinal: number | null;
  odooWriteDate: string | null;
};

export type PosNormalizado = {
  tienda: string;
  modo: ModoIngest;
  loteId: string | null;
  impuestos: PosImpuesto[];
  sesion: PosSesion;
  ordenes: PosOrden[];
};

export type ParsePosResult =
  | { ok: true; payload: PosNormalizado; lineas: number }
  | { ok: false; status: 413 | 422; error: string; campo: string | null };

export type ConteosPos = { sesiones: number; ordenes: number; lineas: number; pagos: number };

export type LineaMem = {
  tienda: string;
  odooId: number;
  ordenOdooId: number;
  codigoOdoo: string;
  nombreOdoo: string | null;
  productId: string | null;
  matchEstado: "match" | "sin_match";
  cantidad: number;
  esDevolucion: boolean;
};

export type OrdenMem = {
  tienda: string;
  odooId: number;
  sesionOdooId: number;
  fechaOperativa: string;
  horaLocal: number;
  dow: number;
  total: number;
  estado: string | null;
  loteId: string | null;
};

export type PagoMem = {
  tienda: string;
  odooId: number;
  ordenOdooId: number;
  sesionOdooId: number;
  metodo: MetodoPago;
  monto: number;
  esCambio: boolean;
};

export type SesionMem = {
  tienda: string;
  odooId: number;
  nombre: string;
  fechaOperativa: string;
  turno: "am" | "pm";
  totalPagos: number | null;
  estado: "closed";
};

export type EstadoPos = {
  sesiones: Map<string, SesionMem>;
  ordenes: Map<string, OrdenMem>;
  lineas: Map<string, LineaMem>;
  pagos: Map<string, PagoMem>;
};

export type ResultadoAplicar = {
  estado: EstadoPos;
  ignorada: boolean;
  insertados: ConteosPos;
  actualizados: ConteosPos;
  borrados: { ordenes: number; lineas: number; pagos: number };
  sinMatch: number;
  totalSesion: number | null;
  sumaOrdenes: number;
  sumaPagos: number;
  alerta: boolean;
  fechaOperativa: string | null;
};

export type FilaVentaDia = {
  ventaReal: number | null;
  ventaPos: number | null;
  origen: "manual" | "pos" | null;
  overrideManual: boolean;
};

export type ConsumoPeriodo = {
  desde: string;
  hasta: string;
  comparar: boolean;
  preset: PresetPeriodo;
  anterior: { desde: string; hasta: string };
};

export type CursorConsumo = { n: number; v: number | null; id: string; orden: string };
export type ModoIngest = "completo" | "parcial" | "final";

export class PosEntradaError extends Error {
  campo: string;
  constructor(message: string, campo = "sesion") {
    super(message);
    this.name = "PosEntradaError";
    this.campo = campo;
  }
}

class ParseError extends PosEntradaError {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function pick(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key] != null && obj[key] !== "") {
      return obj[key];
    }
  }
  return undefined;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function clavePos(tienda: string, odooId: number): string {
  return `${tienda}:${odooId}`;
}

export function relojLocal(iso: string): { fecha: string; hora: number } {
  const date = new Date(iso);
  const fecha = localDayKey(iso);
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: STAFF_TIMEZONE,
    hour: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(date)
    .find((part) => part.type === "hour")?.value;
  return { fecha, hora: Number(hour ?? "0") };
}

export function fechaOperativaDe(startAt: string): string {
  return relojLocal(startAt).fecha;
}

export function turnoDe(horaApertura: number): "am" | "pm" {
  return horaApertura < 14 ? "am" : "pm";
}

export function dowOperativo(fecha: string): number {
  return isoWeekdayMonday1(fecha) ?? 1;
}

export function metodoCanon(valor: string | null): MetodoPago {
  const original = (valor ?? "").trim().toLowerCase();
  if (original === "efectivo" || original === "banco" || original === "credito" || original === "tarjeta" || original === "otro") {
    return original;
  }
  if (original.includes("cardnet") || original.includes("tarjeta")) {
    return "tarjeta";
  }
  if (original.includes("cuenta") || original.includes("credit") || original.includes("crédit")) {
    return "credito";
  }
  if (original.includes("efectivo")) {
    return "efectivo";
  }
  if (original.includes("banco")) {
    return "banco";
  }
  return "otro";
}

export function ventaSinItbis(venta: number, tasa = 18): number {
  return round2(venta / (1 + tasa / 100));
}

export function itbisIncluido(venta: number, tasa = 18): number {
  return round2(venta - venta / (1 + tasa / 100));
}

export function tasaCatalogo(value: unknown): number | null {
  if (value == null || value === "") {
    return null;
  }
  const number = typeof value === "number" ? value : Number(value);
  if (number === 0 || number === 16 || number === 18) {
    return number;
  }
  return 18;
}

export function margenConsumo(venta: number, unidades: number, costo: number | null, tasa = 18): number | null {
  if (costo == null) {
    return null;
  }
  return round2(venta / (1 + tasa / 100) - unidades * costo);
}

export function ordenCuenta(estado: string | null | undefined): boolean {
  const valor = (estado ?? "").trim().toLowerCase();
  return valor === "paid" || valor === "done" || valor === "invoiced";
}

export function costoVigenteConsumo(
  manual: number | null,
  factura: number | null,
): { costo: number | null; origen: "manual" | "factura" | null } {
  if (manual != null) {
    return { costo: manual, origen: "manual" };
  }
  if (factura != null) {
    return { costo: factura, origen: "factura" };
  }
  return { costo: null, origen: null };
}

export function aplicarVentaDiaria(fila: FilaVentaDia | null, ventaPos: number): FilaVentaDia {
  if (fila?.overrideManual) {
    return {
      ventaReal: fila.ventaReal,
      ventaPos,
      origen: fila.origen ?? "manual",
      overrideManual: true,
    };
  }
  return { ventaReal: ventaPos, ventaPos, origen: "pos", overrideManual: false };
}

export function fijarVentaManual(fila: FilaVentaDia | null, ventaReal: number): FilaVentaDia {
  return {
    ventaReal,
    ventaPos: fila?.ventaPos ?? null,
    origen: "manual",
    overrideManual: true,
  };
}

export function ventaDifiere(fila: { ventaReal: number | null; ventaPos: number | null }): boolean {
  if (fila.ventaPos == null || fila.ventaReal == null) {
    return false;
  }
  return Math.abs(fila.ventaReal - fila.ventaPos) > 0.01;
}

function forbiddenKey(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = forbiddenKey(item);
      if (found) {
        return found;
      }
    }
    return null;
  }
  if (!isRecord(value)) {
    return null;
  }
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) {
      return key;
    }
    const found = forbiddenKey(value[key]);
    if (found) {
      return found;
    }
  }
  return null;
}

function asInt(value: unknown, label: string, campo = "sesion"): number {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isInteger(number) || number <= 0 || number > 2_000_000_000) {
    throw new ParseError(label, campo);
  }
  return number;
}

function asOptionalInt(value: unknown, label: string, campo = "sesion"): number | null {
  if (value == null || value === "") {
    return null;
  }
  return asInt(value, label, campo);
}

function asMoney(value: unknown, label: string, required: boolean, campo = "sesion"): number | null {
  if (value == null || value === "") {
    if (required) {
      throw new ParseError(label, campo);
    }
    return null;
  }
  const number = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(number) || Math.abs(number) > 100_000_000) {
    throw new ParseError(label, campo);
  }
  return round2(number);
}

function asQty(value: unknown, label: string, campo = "lineas.cantidad"): number {
  const number = typeof value === "number" ? value : Number(String(value ?? "").replace(/,/g, ""));
  if (!Number.isFinite(number) || Math.abs(number) > 1_000_000) {
    throw new ParseError(label, campo);
  }
  return round3(number);
}

function asIso(value: unknown, label: string, required: boolean, campo = "sesion"): string | null {
  if (value == null || value === "") {
    if (required) {
      throw new ParseError(label, campo);
    }
    return null;
  }
  let raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(raw)) {
    raw = `${raw.replace(" ", "T")}Z`;
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new ParseError(label, campo);
  }
  return date.toISOString();
}

function normalizarTasa(value: unknown, campo: string): number {
  const number = typeof value === "number" ? value : Number(String(value).replace("%", "").trim());
  const tasa = number > 0 && number < 1 ? Math.round(number * 100) : number;
  if (tasa === 0 || tasa === 16 || tasa === 18) {
    return tasa;
  }
  throw new ParseError("La tasa de ITBIS tiene que ser 0, 16 o 18", campo);
}

function tasaDeLinea(raw: Record<string, unknown>, campo: string): number | null {
  const directa = pick(raw, ["tasaItbis", "tasa_itbis", "tax_rate", "taxRate"]);
  if (directa != null && directa !== "") {
    return normalizarTasa(directa, campo);
  }
  return null;
}

function idDeImpuesto(item: unknown): number | null {
  if (typeof item === "number" && Number.isInteger(item) && item > 0 && item <= 2_000_000_000) {
    return item;
  }
  if (typeof item === "string" && /^[0-9]+$/.test(item.trim())) {
    const number = Number(item.trim());
    if (number > 0 && number <= 2_000_000_000) {
      return number;
    }
  }
  if (Array.isArray(item)) {
    return item.length > 0 ? idDeImpuesto(item[0]) : null;
  }
  if (isRecord(item)) {
    return idDeImpuesto(pick(item, ["id", "odooId", "odoo_id"]));
  }
  return null;
}

function idsDeImpuesto(raw: Record<string, unknown>): number[] {
  const tax = raw.tax_ids ?? raw.taxIds ?? raw.impuestoOdooIds ?? raw.impuesto_odoo_ids;
  if (tax == null || tax === "") {
    return [];
  }
  const lista = Array.isArray(tax) ? tax : [tax];
  const ids: number[] = [];
  for (const item of lista) {
    const id = idDeImpuesto(item);
    if (id != null && !ids.includes(id)) {
      ids.push(id);
    }
  }
  return ids;
}

function parseImpuestos(raw: unknown): PosImpuesto[] {
  if (raw == null) {
    return [];
  }
  if (!Array.isArray(raw)) {
    throw new ParseError("impuestos tiene que ser una lista de {id, tasa}", "impuestos");
  }
  const tasas = new Map<number, number>();
  for (const item of raw) {
    if (!isRecord(item)) {
      throw new ParseError("Cada impuesto necesita id y tasa", "impuestos");
    }
    const id = asInt(pick(item, ["id", "odooId", "odoo_id"]), "Cada impuesto necesita id", "impuestos");
    const tasa = normalizarTasa(pick(item, ["tasa", "tasaItbis", "tasa_itbis"]), "impuestos");
    tasas.set(id, tasa);
  }
  return Array.from(tasas, ([id, tasa]) => ({ id, tasa }));
}

function asText(value: unknown, max: number): string | null {
  if (typeof value !== "string") {
    return value == null ? null : String(value).slice(0, max);
  }
  const text = value.trim();
  return text ? text.slice(0, max) : null;
}

function countLineasItem(item: Record<string, unknown>): number {
  if (!Array.isArray(item.ordenes)) {
    return 0;
  }
  let total = 0;
  for (const orden of item.ordenes) {
    if (isRecord(orden) && Array.isArray(orden.lineas)) {
      total += orden.lineas.length;
    }
  }
  return total;
}

function parseModo(value: unknown): ModoIngest {
  if (value == null || value === "") {
    return "completo";
  }
  const modo = String(value).trim().toLowerCase();
  if (modo === "completo" || modo === "parcial" || modo === "final") {
    return modo;
  }
  throw new ParseError("modo tiene que ser completo, parcial o final", "modo");
}

function parseLinea(raw: unknown): PosLinea {
  if (!isRecord(raw)) {
    throw new ParseError("Una línea no tiene la forma esperada", "lineas");
  }
  return {
    odooId: asInt(pick(raw, ["odooId", "odoo_id", "id"]), "Cada línea necesita odooId", "lineas.odooId"),
    odooProductId: asInt(pick(raw, ["odooProductId", "odoo_product_id", "product_id"]), "Cada línea necesita odooProductId", "lineas.odooProductId"),
    odooTmplId: asOptionalInt(pick(raw, ["odooTmplId", "odoo_tmpl_id", "product_tmpl_id"]), "odooTmplId no es válido"),
    codigoOdoo: asText(pick(raw, ["codigoOdoo", "codigo_odoo"]), 160),
    nombreOdoo: asText(pick(raw, ["nombreOdoo", "nombre_odoo", "full_product_name"]), 240),
    cantidad: asQty(pick(raw, ["cantidad", "qty"]), "La cantidad de una línea no es válida", "lineas.cantidad"),
    precioUnit: asMoney(pick(raw, ["precioUnit", "precio_unit", "price_unit"]), "El precio de una línea no es válido", false, "lineas.precioUnit"),
    descuento: asMoney(pick(raw, ["descuento", "discount"]), "El descuento de una línea no es válido", false, "lineas.descuento"),
    subtotal: asMoney(pick(raw, ["subtotal", "price_subtotal"]), "El subtotal de una línea no es válido", false, "lineas.subtotal"),
    subtotalConItbis: asMoney(
      pick(raw, ["subtotalConItbis", "subtotal_con_itbis", "price_subtotal_incl"]),
      "El subtotal con ITBIS no es válido",
      false,
      "lineas.subtotalConItbis",
    ),
    odooRefundedLineId: asOptionalInt(
      pick(raw, ["odooRefundedLineId", "odoo_refunded_line_id", "refunded_orderline_id"]),
      "La línea devuelta no es válida",
      "lineas.odooRefundedLineId",
    ),
    tasaItbis: tasaDeLinea(raw, "lineas.tasaItbis"),
    impuestoOdooIds: idsDeImpuesto(raw),
  };
}

function parsePago(raw: unknown): PosPago {
  if (!isRecord(raw)) {
    throw new ParseError("Un pago no tiene la forma esperada", "pagos");
  }
  const metodo = asText(pick(raw, ["metodo", "payment_method", "payment_method_name", "metodoNombre"]), 80);
  return {
    odooId: asInt(pick(raw, ["odooId", "odoo_id", "id"]), "Cada pago necesita odooId", "pagos.odooId"),
    metodoOdooId: asOptionalInt(pick(raw, ["metodoOdooId", "metodo_odoo_id", "payment_method_id"]), "El método de pago no es válido"),
    metodo,
    monto: asMoney(pick(raw, ["monto", "amount"]), "El monto de un pago no es válido", true, "pagos.monto") ?? 0,
    fecha: asIso(pick(raw, ["fecha", "payment_date"]), "La fecha de un pago no es válida", false),
    esCambio: pick(raw, ["esCambio", "es_cambio", "is_change"]) === true || pick(raw, ["esCambio", "es_cambio", "is_change"]) === "true",
    tipoTarjeta: asText(pick(raw, ["tipoTarjeta", "tipo_tarjeta", "card_type"]), 40),
  };
}

function parseOrdenPos(raw: unknown): PosOrden {
  if (!isRecord(raw)) {
    throw new ParseError("Una orden no tiene la forma esperada", "ordenes");
  }
  const lineasRaw = Array.isArray(raw.lineas) ? raw.lineas : [];
  const pagosRaw = Array.isArray(raw.pagos) ? raw.pagos : [];
  return {
    odooId: asInt(pick(raw, ["odooId", "odoo_id", "id"]), "Cada orden necesita odooId", "ordenes.odooId"),
    nombre: asText(pick(raw, ["nombre", "name"]), 80),
    posReference: asText(pick(raw, ["posReference", "pos_reference"]), 80),
    fecha: asIso(pick(raw, ["fecha", "date_order"]), "Cada orden necesita fecha", true, "ordenes.fecha") ?? "",
    total: asMoney(pick(raw, ["total", "amount_total"]), "Cada orden necesita total", true, "ordenes.total") ?? 0,
    impuesto: asMoney(pick(raw, ["impuesto", "amount_tax"]), "El impuesto de una orden no es válido", false),
    pagado: asMoney(pick(raw, ["pagado", "amount_paid"]), "El pagado de una orden no es válido", false),
    cambio: asMoney(pick(raw, ["cambio", "amount_return"]), "El cambio de una orden no es válido", false),
    estado: asText(pick(raw, ["estado", "state"]), 40),
    ncf: asText(pick(raw, ["ncf"]), 40),
    clienteOdooId: asOptionalInt(pick(raw, ["clienteOdooId", "cliente_odoo_id", "partner_id"]), "El cliente de la orden no es válido"),
    empleadoOdooId: asOptionalInt(pick(raw, ["empleadoOdooId", "empleado_odoo_id", "employee_id"]), "El cajero de la orden no es válido"),
    lineas: lineasRaw.map(parseLinea),
    pagos: pagosRaw.map(parsePago),
  };
}

export function parsePosIngestBody(body: unknown): ParsePosResult {
  if (!isRecord(body)) {
    return { ok: false, status: 422, error: "El cuerpo no tiene la forma esperada", campo: "sesion" };
  }
  const tieneSesion = isRecord(body.sesion);
  const tieneLista = Array.isArray(body.sesiones);
  if (tieneSesion && tieneLista) {
    return { ok: false, status: 422, error: "Manda sesion o sesiones, no las dos", campo: "sesiones" };
  }
  let item: Record<string, unknown>;
  if (tieneLista) {
    const sesiones = body.sesiones as unknown[];
    if (sesiones.length > POS_MAX_SESIONES) {
      return { ok: false, status: 413, error: "Manda una sola sesión por request", campo: "sesiones" };
    }
    if (sesiones.length !== 1 || !isRecord(sesiones[0])) {
      return { ok: false, status: 422, error: "Falta la sesión", campo: "sesiones" };
    }
    item = sesiones[0];
  } else if (tieneSesion) {
    item = { sesion: body.sesion, ordenes: body.ordenes };
  } else {
    return { ok: false, status: 422, error: "Falta la sesión", campo: "sesion" };
  }
  if (countLineasItem(item) > POS_MAX_LINEAS) {
    return { ok: false, status: 413, error: "La sesión trae más de 1.500 líneas", campo: "lineas" };
  }
  const forbidden = forbiddenKey(body);
  if (forbidden) {
    return { ok: false, status: 422, error: `No se acepta ${forbidden} de Odoo`, campo: forbidden };
  }
  try {
    if (!isRecord(item.sesion)) {
      throw new ParseError("Falta la sesión", "sesion");
    }
    const sesionRaw = item.sesion;
    const ordenesRaw = Array.isArray(item.ordenes) ? item.ordenes : [];
    const modo = parseModo(body.modo ?? item.modo);
    const loteId = asText(pick(body, ["loteId", "lote_id"]) ?? pick(item, ["loteId", "lote_id"]), 80);
    if ((modo === "parcial" || modo === "final") && !loteId) {
      throw new ParseError("Una sesión en partes necesita loteId", "loteId");
    }
    const tienda = (asText(body.tienda, 40) ?? TIENDA_DEFAULT).toLowerCase();
    const sesion: PosSesion = {
      odooId: asInt(pick(sesionRaw, ["odooId", "odoo_id", "id"]), "La sesión necesita odooId", "sesion.odooId"),
      nombre: asText(pick(sesionRaw, ["nombre", "name"]), 80) ?? `POS/${pick(sesionRaw, ["odooId", "odoo_id", "id"])}`,
      odooConfigId: asOptionalInt(pick(sesionRaw, ["odooConfigId", "odoo_config_id", "config_id"]), "La caja no es válida", "sesion.odooConfigId"),
      estado: (asText(pick(sesionRaw, ["estado", "state"]), 40) ?? "").toLowerCase(),
      startAt: asIso(pick(sesionRaw, ["startAt", "start_at"]), "La sesión necesita startAt", true, "sesion.startAt") ?? "",
      stopAt: asIso(pick(sesionRaw, ["stopAt", "stop_at"]), "stopAt no es válido", false, "sesion.stopAt"),
      totalPagos: asMoney(
        pick(sesionRaw, ["totalPagos", "total_pagos", "total_payments_amount"]),
        "El total de pagos no es válido",
        false,
        "sesion.totalPagos",
      ),
      efectivoInicial: asMoney(
        pick(sesionRaw, ["efectivoInicial", "efectivo_inicial", "cash_register_balance_start"]),
        "El efectivo inicial no es válido",
        false,
        "sesion.efectivoInicial",
      ),
      efectivoFinal: asMoney(
        pick(sesionRaw, ["efectivoFinal", "efectivo_final", "cash_register_balance_end_real"]),
        "El efectivo final no es válido",
        false,
        "sesion.efectivoFinal",
      ),
      odooWriteDate: asIso(
        pick(sesionRaw, ["odooWriteDate", "odoo_write_date", "write_date"]),
        "write_date no es válido",
        false,
        "sesion.odooWriteDate",
      ),
    };
    const impuestos = parseImpuestos(body.impuestos !== undefined ? body.impuestos : item.impuestos);
    const ordenes = ordenesRaw.map(parseOrdenPos);
    const vistos = new Set<string>();
    const marcar = (tipo: string, id: number, campo: string) => {
      const key = `${tipo}:${id}`;
      if (vistos.has(key)) {
        throw new ParseError(`Hay un ${tipo} repetido (${id})`, campo);
      }
      vistos.add(key);
    };
    marcar("sesión", sesion.odooId, "sesion.odooId");
    for (const orden of ordenes) {
      marcar("orden", orden.odooId, "ordenes.odooId");
      for (const linea of orden.lineas) {
        marcar("línea", linea.odooId, "lineas.odooId");
      }
      for (const pago of orden.pagos) {
        marcar("pago", pago.odooId, "pagos.odooId");
      }
    }
    const lineas = ordenes.reduce((sum, orden) => sum + orden.lineas.length, 0);
    return { ok: true, payload: { tienda, modo, loteId, impuestos, sesion, ordenes }, lineas };
  } catch (error) {
    if (error instanceof ParseError) {
      return { ok: false, status: 422, error: error.message, campo: error.campo };
    }
    return { ok: false, status: 422, error: "El cuerpo no es válido", campo: "sesion" };
  }
}

export function estadoPosVacio(): EstadoPos {
  return { sesiones: new Map(), ordenes: new Map(), lineas: new Map(), pagos: new Map() };
}

function clonar(estado: EstadoPos): EstadoPos {
  return {
    sesiones: new Map(estado.sesiones),
    ordenes: new Map(estado.ordenes),
    lineas: new Map(estado.lineas),
    pagos: new Map(estado.pagos),
  };
}

export function aplicarSesion(
  estado: EstadoPos,
  payload: PosNormalizado,
  catalogo: ReadonlyMap<string, string>,
): ResultadoAplicar {
  const next = clonar(estado);
  const ceros: ConteosPos = { sesiones: 0, ordenes: 0, lineas: 0, pagos: 0 };
  if (payload.sesion.estado !== "closed") {
    return {
      estado: next,
      ignorada: true,
      insertados: ceros,
      actualizados: ceros,
      borrados: { ordenes: 0, lineas: 0, pagos: 0 },
      sinMatch: 0,
      totalSesion: null,
      sumaOrdenes: 0,
      sumaPagos: 0,
      alerta: false,
      fechaOperativa: null,
    };
  }

  const fecha = fechaOperativaDe(payload.sesion.startAt);
  const apertura = relojLocal(payload.sesion.startAt);
  const sKey = clavePos(payload.tienda, payload.sesion.odooId);
  const existia = next.sesiones.has(sKey);
  next.sesiones.set(sKey, {
    tienda: payload.tienda,
    odooId: payload.sesion.odooId,
    nombre: payload.sesion.nombre,
    fechaOperativa: fecha,
    turno: turnoDe(apertura.hora),
    totalPagos: payload.sesion.totalPagos,
    estado: "closed",
  });

  const incomingOrders = new Set(payload.ordenes.map((orden) => orden.odooId));
  let borradosOrdenes = 0;
  let borradosLineas = 0;
  let borradosPagos = 0;
  for (const [key, orden] of Array.from(next.ordenes)) {
    if (orden.tienda !== payload.tienda || orden.sesionOdooId !== payload.sesion.odooId) {
      continue;
    }
    const sobra =
      payload.modo === "parcial"
        ? false
        : payload.modo === "final"
          ? orden.loteId !== payload.loteId
          : !incomingOrders.has(orden.odooId);
    if (sobra) {
      next.ordenes.delete(key);
      borradosOrdenes += 1;
      for (const [lineKey, linea] of Array.from(next.lineas)) {
        if (linea.tienda === payload.tienda && linea.ordenOdooId === orden.odooId) {
          next.lineas.delete(lineKey);
          borradosLineas += 1;
        }
      }
      for (const [pagoKey, pago] of Array.from(next.pagos)) {
        if (pago.tienda === payload.tienda && pago.ordenOdooId === orden.odooId) {
          next.pagos.delete(pagoKey);
          borradosPagos += 1;
        }
      }
    }
  }

  let ordenesIns = 0;
  let ordenesUpd = 0;
  let lineasIns = 0;
  let lineasUpd = 0;
  let pagosIns = 0;
  let pagosUpd = 0;
  for (const orden of payload.ordenes) {
    const oKey = clavePos(payload.tienda, orden.odooId);
    if (next.ordenes.has(oKey)) {
      ordenesUpd += 1;
    } else {
      ordenesIns += 1;
    }
    const hora = relojLocal(orden.fecha).hora;
    next.ordenes.set(oKey, {
      tienda: payload.tienda,
      odooId: orden.odooId,
      sesionOdooId: payload.sesion.odooId,
      fechaOperativa: fecha,
      horaLocal: hora,
      dow: dowOperativo(fecha),
      total: orden.total,
      estado: orden.estado,
      loteId: payload.loteId,
    });

    const incomingLines = new Set(orden.lineas.map((linea) => linea.odooId));
    for (const [lineKey, linea] of Array.from(next.lineas)) {
      if (linea.tienda === payload.tienda && linea.ordenOdooId === orden.odooId && !incomingLines.has(linea.odooId)) {
        next.lineas.delete(lineKey);
        borradosLineas += 1;
      }
    }
    for (const linea of orden.lineas) {
      const lineKey = clavePos(payload.tienda, linea.odooId);
      if (next.lineas.has(lineKey)) {
        lineasUpd += 1;
      } else {
        lineasIns += 1;
      }
      const codigo = linea.codigoOdoo?.trim() || `sin_codigo:${linea.odooProductId}`;
      const productId = catalogo.get(codigo) ?? null;
      next.lineas.set(lineKey, {
        tienda: payload.tienda,
        odooId: linea.odooId,
        ordenOdooId: orden.odooId,
        codigoOdoo: codigo,
        nombreOdoo: linea.nombreOdoo,
        productId,
        matchEstado: productId ? "match" : "sin_match",
        cantidad: linea.cantidad,
        esDevolucion: linea.cantidad < 0 || linea.odooRefundedLineId != null,
      });
    }

    const incomingPagos = new Set(orden.pagos.map((pago) => pago.odooId));
    for (const [pagoKey, pago] of Array.from(next.pagos)) {
      if (pago.tienda === payload.tienda && pago.ordenOdooId === orden.odooId && !incomingPagos.has(pago.odooId)) {
        next.pagos.delete(pagoKey);
        borradosPagos += 1;
      }
    }
    for (const pago of orden.pagos) {
      const pagoKey = clavePos(payload.tienda, pago.odooId);
      if (next.pagos.has(pagoKey)) {
        pagosUpd += 1;
      } else {
        pagosIns += 1;
      }
      next.pagos.set(pagoKey, {
        tienda: payload.tienda,
        odooId: pago.odooId,
        ordenOdooId: orden.odooId,
        sesionOdooId: payload.sesion.odooId,
        metodo: metodoCanon(pago.metodo),
        monto: pago.monto,
        esCambio: pago.esCambio,
      });
    }
  }

  let sumaOrdenes = 0;
  let sumaPagos = 0;
  let sinMatch = 0;
  for (const orden of Array.from(next.ordenes.values())) {
    if (orden.tienda === payload.tienda && orden.sesionOdooId === payload.sesion.odooId && ordenCuenta(orden.estado)) {
      sumaOrdenes += orden.total;
    }
  }
  for (const pago of Array.from(next.pagos.values())) {
    const orden = next.ordenes.get(clavePos(pago.tienda, pago.ordenOdooId));
    if (
      pago.tienda === payload.tienda &&
      pago.sesionOdooId === payload.sesion.odooId &&
      orden &&
      ordenCuenta(orden.estado)
    ) {
      sumaPagos += pago.monto;
    }
  }
  for (const linea of Array.from(next.lineas.values())) {
    const orden = next.ordenes.get(clavePos(linea.tienda, linea.ordenOdooId));
    if (orden?.sesionOdooId === payload.sesion.odooId && linea.matchEstado === "sin_match") {
      sinMatch += 1;
    }
  }
  sumaOrdenes = round2(sumaOrdenes);
  sumaPagos = round2(sumaPagos);
  const total = payload.sesion.totalPagos;
  const alerta =
    payload.modo !== "parcial" &&
    total != null &&
    (Math.abs(total - sumaOrdenes) > 0.01 || Math.abs(total - sumaPagos) > 0.01);

  return {
    estado: next,
    ignorada: false,
    insertados: { sesiones: existia ? 0 : 1, ordenes: ordenesIns, lineas: lineasIns, pagos: pagosIns },
    actualizados: { sesiones: existia ? 1 : 0, ordenes: ordenesUpd, lineas: lineasUpd, pagos: pagosUpd },
    borrados: { ordenes: borradosOrdenes, lineas: borradosLineas, pagos: borradosPagos },
    sinMatch,
    totalSesion: total,
    sumaOrdenes,
    sumaPagos,
    alerta,
    fechaOperativa: fecha,
  };
}

export function ventaDelDia(estado: EstadoPos, tienda: string, fecha: string): number {
  let suma = 0;
  for (const orden of Array.from(estado.ordenes.values())) {
    if (orden.tienda === tienda && orden.fechaOperativa === fecha && ordenCuenta(orden.estado)) {
      suma += orden.total;
    }
  }
  return round2(suma);
}

export function resolverPeriodo(
  input: { desde?: string | null; hasta?: string | null; preset?: string | null; comparar?: string | null },
  now = Date.now(),
): ConsumoPeriodo {
  const hoy = todayDayKey(now);
  let hasta = input.hasta && isDayKey(input.hasta) ? input.hasta : hoy;
  const preset: PresetPeriodo =
    input.preset === "30d" || input.preset === "mes" || input.preset === "custom" || input.preset === "7d"
      ? input.preset
      : input.desde || input.hasta
        ? "custom"
        : "7d";
  let desde = addDaysToDayKey(hasta, -6);
  if (preset === "30d") {
    desde = addDaysToDayKey(hasta, -29);
  } else if (preset === "mes") {
    desde = `${hasta.slice(0, 7)}-01`;
  } else if (preset === "custom" && input.desde && isDayKey(input.desde)) {
    desde = input.desde;
  }
  if (desde > hasta) {
    const swap = desde;
    desde = hasta;
    hasta = swap;
  }
  if (diffDayKeys(desde, hasta) > PERIODO_MAX_DIAS) {
    desde = addDaysToDayKey(hasta, -PERIODO_MAX_DIAS);
  }
  const dias = diffDayKeys(desde, hasta);
  const hastaAnterior = addDaysToDayKey(desde, -1);
  const desdeAnterior = addDaysToDayKey(hastaAnterior, -dias);
  return {
    desde,
    hasta,
    comparar: input.comparar !== "0" && input.comparar !== "false",
    preset,
    anterior: { desde: desdeAnterior, hasta: hastaAnterior },
  };
}

export function lunesDe(fecha: string): string {
  const dow = isoWeekdayMonday1(fecha);
  if (!dow) {
    return fecha;
  }
  return addDaysToDayKey(fecha, -(dow - 1));
}

export function parseLimit(raw: string | null, fallback = CONSUMO_PAGE_DEFAULT): number {
  if (raw == null || raw.trim() === "") {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.min(CONSUMO_PAGE_MAX, parsed);
}

export function parseOrden(raw: string | null): OrdenConsumo {
  if (raw === "unidades" || raw === "margen" || raw === "variacion" || raw === "variacion_asc" || raw === "venta") {
    return raw;
  }
  return "venta";
}

export function parseMetrica(raw: string | null): MetricaHorario {
  if (raw === "ordenes" || raw === "unidades" || raw === "venta") {
    return raw;
  }
  return "venta";
}

export function parseDias(raw: string | null, allowed: readonly number[], fallback: number): number {
  const parsed = Number(raw);
  return allowed.includes(parsed) ? parsed : fallback;
}

export function buscarSeguro(raw: string | null): string {
  return (raw ?? "").replace(/[%_\\]/g, "").trim().slice(0, 80);
}

export function encodeCursor(cursor: CursorConsumo): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeCursor(raw: string | null, orden: string): CursorConsumo | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Partial<CursorConsumo>;
    if (!parsed || parsed.orden !== orden || typeof parsed.id !== "string") {
      return null;
    }
    return { n: Number(parsed.n) || 0, v: parsed.v == null ? null : Number(parsed.v), id: parsed.id, orden };
  } catch {
    return null;
  }
}

export function formatRd(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }
  const formatted = new Intl.NumberFormat("es-DO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return `RD$${formatted}`;
}

export function formatNumero(value: number | null | undefined, digits = 0): string {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }
  return new Intl.NumberFormat("es-DO", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatUnidades(value: number): string {
  const digits = Math.abs(value - Math.round(value)) < 0.001 ? 0 : 1;
  return formatNumero(value, digits);
}

export function formatPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }
  const formatted = new Intl.NumberFormat("es-DO", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  }).format(value * 100);
  return `${formatted}%`;
}

export const DEFINICIONES = {
  venta: "Lo que pagó el cliente, con las devoluciones ya restadas. El ITBIS ya va incluido: no se suma encima. Solo entran órdenes paid, done e invoiced.",
  ticket: "Venta dividida entre el número de órdenes del periodo. El ITBIS ya va incluido.",
  unidadesTicket: "Unidades vendidas divididas entre el número de órdenes.",
  margen: "Venta sin el ITBIS de la línea (o el del producto: 0, 16 o 18), menos unidades por el costo sin ITBIS. Si no hay costo, no se calcula: no es cero.",
  cobertura: "Parte de la venta que tiene costo, manual o de la última factura.",
  lift: "Cuántas veces más se llevan juntos de lo que se esperaría por separado.",
  hora: "Una venta después de medianoche sigue en el día en que se abrió la caja.",
} as const;
