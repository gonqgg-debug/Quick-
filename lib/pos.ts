import { normalizeBarcode } from "@/lib/barcode";
import { suggestedPagoConAmounts } from "@/lib/cash-payment";
import { formatPrice, toMoney } from "@/lib/money";

export const POS_METODOS = ["efectivo", "tarjeta", "transferencia"] as const;
export type PosMetodoPago = (typeof POS_METODOS)[number];

export const POS_LOW_STOCK = 5;
/** Tope del descuento manual (línea + ticket), en porcentaje del subtotal de lista. */
export const POS_DESCUENTO_TOPE_PCT = 20;
export const QUICKCOINS_PESOS_POR_COIN = 10;
export const QUICKCOINS_VALOR_COIN = 1;
export const QUICKCOINS_MINIMO_CANJE = 50;
export const POS_CATALOG_REFRESH_MS = 5 * 60 * 1000;
export const POS_SYNC_INTERVAL_MS = 15_000;
export const POS_MAX_QTY = 9999;

export type PosStoredProduct = {
  id: string;
  nombre: string;
  marca: string | null;
  precio: number;
  fotoUrl: string | null;
  categoria: string;
  codigoBarras: string | null;
  /** Last stock reported by the server. Null means inventory is not tracked. */
  stockBase: number | null;
};

export type PosProduct = PosStoredProduct & {
  /** stockBase minus quantities in local sales still waiting to sync. */
  stock: number | null;
};

export type PosSaleItem = {
  productoId: string;
  nombre: string;
  cantidad: number;
  /** Net unit price charged, after discounts and QuickCoins. */
  precioUnitario: number;
  /** List unit price. Omitted on sales saved before discounts existed. */
  precioLista?: number;
  /** Manual line discount in DOP for the whole line, not per unit. */
  descuento?: number;
};

export type PosDescuento =
  | { tipo: "ninguno" }
  | { tipo: "porcentaje"; valor: number }
  | { tipo: "monto"; valor: number };

export const POS_SIN_DESCUENTO: PosDescuento = { tipo: "ninguno" };

export type PosQuickcoinsSync = "pendiente_sync" | "sincronizada" | "no_aplica";

export type PosQuickcoinsDraft = {
  telefono: string;
  nombre: string;
  canjePuntos: number;
  ganarPuntos: number;
  descuentoCanje: number;
  coinsSync: PosQuickcoinsSync;
};

export type PosSaleStatus = "pendiente_sync" | "sincronizada";

export type PosSaleDraft = {
  clientId: string;
  createdAt: string;
  items: PosSaleItem[];
  metodoPago: PosMetodoPago;
  montoRecibido: number | null;
  cambio: number | null;
  total: number;
  status: PosSaleStatus;
  stockAdvertencia: boolean;
  lastError: string | null;
  attempts: number;
  turnoClientId?: string | null;
  cajero?: string | null;
  descuentoTicket?: number;
  descuentoTotal?: number;
  quickcoins?: PosQuickcoinsDraft | null;
};

export type PosShiftEstado = "abierto" | "cerrado";
export type PosShiftSync = "pendiente_sync" | "sincronizada" | "no_aplica";

export type PosShiftRecord = {
  clientId: string;
  abiertoEn: string;
  cerradoEn: string | null;
  fondoInicial: number;
  efectivoContado: number | null;
  abiertoPor: string;
  estado: PosShiftEstado;
  aperturaSync: Exclude<PosShiftSync, "no_aplica">;
  cierreSync: PosShiftSync;
  notas: string | null;
  lastError: string | null;
  ventasAlCierre: number | null;
};

export type ShiftTotals = {
  efectivo: number;
  tarjeta: number;
  transferencia: number;
  ventas: number;
};

export type CartLine = {
  productoId: string;
  nombre: string;
  /** List unit price captured when the product was added. */
  precioUnitario: number;
  cantidad: number;
  descuentoTipo?: "ninguno" | "porcentaje" | "monto";
  descuentoValor?: number;
};

export type PosVentaInput = {
  clientId: string;
  fecha: string | null;
  metodoPago: PosMetodoPago;
  montoRecibido: number | null;
  items: PosSaleItem[];
  turnoClientId: string | null;
  creadoPor: string | null;
  descuentoTicket: number;
  descuentoTotal: number;
  quickcoins: PosQuickcoinsDraft | null;
};

export const POS_FONDO_RAPIDO = [0, 500, 1000, 2000, 5000] as const;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function moneyCents(value: number): number {
  return Math.round(toMoney(value) * 100);
}

export function centsToMoney(cents: number): number {
  return Math.round(cents) / 100;
}

export function lineSubtotal(line: { precioUnitario: number; cantidad: number }): number {
  return centsToMoney(moneyCents(line.precioUnitario) * line.cantidad);
}

export function cartTotal(lines: Array<{ precioUnitario: number; cantidad: number }>): number {
  const cents = lines.reduce((sum, line) => sum + moneyCents(line.precioUnitario) * line.cantidad, 0);
  return centsToMoney(cents);
}

export function lineListCents(line: { precioUnitario: number; cantidad: number }): number {
  return moneyCents(line.precioUnitario) * line.cantidad;
}

export function lineManualDiscountCents(line: CartLine): number {
  const list = lineListCents(line);
  const tipo = line.descuentoTipo ?? "ninguno";
  const valor = line.descuentoValor ?? 0;
  if (tipo === "porcentaje") {
    const pct = Math.min(100, Math.max(0, valor));
    return Math.min(list, Math.round((list * pct) / 100));
  }
  if (tipo === "monto") {
    return Math.min(list, Math.max(0, moneyCents(valor)));
  }
  return 0;
}

export function discountCapCents(lines: Array<{ precioUnitario: number; cantidad: number }>): number {
  const list = lines.reduce((sum, line) => sum + lineListCents(line), 0);
  return Math.round((list * POS_DESCUENTO_TOPE_PCT) / 100);
}

export function ticketDiscountCents(afterLineCents: number, ticket: PosDescuento): number {
  if (afterLineCents <= 0 || ticket.tipo === "ninguno") return 0;
  if (ticket.tipo === "porcentaje") {
    const pct = Math.min(100, Math.max(0, ticket.valor));
    return Math.min(afterLineCents, Math.round((afterLineCents * pct) / 100));
  }
  return Math.min(afterLineCents, Math.max(0, moneyCents(ticket.valor)));
}

export function manualDiscountWithinCap(lines: CartLine[], ticket: PosDescuento): boolean {
  const lineCents = lines.reduce((sum, line) => sum + lineManualDiscountCents(line), 0);
  const list = lines.reduce((sum, line) => sum + lineListCents(line), 0);
  const ticketCents = ticketDiscountCents(list - lineCents, ticket);
  return lineCents + ticketCents <= discountCapCents(lines);
}

export type PosPricing = {
  listCents: number;
  lineDiscountCents: number;
  ticketDiscountCents: number;
  coinDiscountCents: number;
  totalCents: number;
  items: PosSaleItem[];
};

function allocateCents(weights: number[], pool: number): number[] {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (pool <= 0 || total <= 0) return weights.map(() => 0);
  const base = weights.map((weight) => Math.floor((pool * weight) / total));
  let left = pool - base.reduce((sum, value) => sum + value, 0);
  const order = weights.map((weight, index) => ({ weight, index })).sort((a, b) => b.weight - a.weight);
  for (const entry of order) {
    if (left <= 0) break;
    base[entry.index] += 1;
    left -= 1;
  }
  return base;
}

export function priceCart(lines: CartLine[], ticket: PosDescuento, coinCents = 0): PosPricing | { error: string } {
  if (!manualDiscountWithinCap(lines, ticket)) {
    return { error: `El descuento pasa del ${POS_DESCUENTO_TOPE_PCT}%` };
  }
  const listCents = lines.reduce((sum, line) => sum + lineListCents(line), 0);
  const lineDiscounts = lines.map((line) => lineManualDiscountCents(line));
  const lineDiscountCents = lineDiscounts.reduce((sum, value) => sum + value, 0);
  const afterLines = listCents - lineDiscountCents;
  const ticketCents = ticketDiscountCents(afterLines, ticket);
  const coinDiscountCents = Math.min(Math.max(0, coinCents), afterLines - ticketCents);
  const weights = lines.map((line, index) => lineListCents(line) - lineDiscounts[index]);
  const shared = allocateCents(weights, ticketCents + coinDiscountCents);
  const items: PosSaleItem[] = [];
  let totalCents = 0;
  lines.forEach((line, index) => {
    const target = Math.max(0, weights[index] - shared[index]);
    const unitCents = line.cantidad > 0 ? Math.round(target / line.cantidad) : 0;
    const linePay = unitCents * line.cantidad;
    totalCents += linePay;
    items.push({
      productoId: line.productoId,
      nombre: line.nombre,
      cantidad: line.cantidad,
      precioLista: centsToMoney(moneyCents(line.precioUnitario)),
      descuento: centsToMoney(lineDiscounts[index]),
      precioUnitario: centsToMoney(unitCents),
    });
  });
  return {
    listCents,
    lineDiscountCents,
    ticketDiscountCents: ticketCents,
    coinDiscountCents,
    totalCents,
    items,
  };
}

export function cartAmountDue(lines: CartLine[], ticket: PosDescuento = POS_SIN_DESCUENTO, coinCents = 0): number {
  const priced = priceCart(lines, ticket, coinCents);
  if ("error" in priced) return cartTotal(lines);
  return centsToMoney(priced.totalCents);
}

export function quickcoinsEarn(paidCents: number, pesosPorCoin = QUICKCOINS_PESOS_POR_COIN): number {
  const step = moneyCents(pesosPorCoin);
  if (step <= 0) return 0;
  return Math.floor(paidCents / step);
}

export function quickcoinsDiscountCents(puntos: number, valorCoin = QUICKCOINS_VALOR_COIN): number {
  if (!Number.isInteger(puntos) || puntos <= 0) return 0;
  return moneyCents(valorCoin) * puntos;
}

export function findProductsByBarcode<T extends { codigoBarras?: string | null }>(products: T[], raw: string): T[] {
  const code = normalizeBarcode(raw);
  if (!code) return [];
  return products.filter((product) => product.codigoBarras === code);
}

export function cashChangeAmount(recibido: number, total: number): number {
  return centsToMoney(moneyCents(recibido) - moneyCents(total));
}

export function normalizePosText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function productMatchesQuery(product: { nombre: string }, query: string): boolean {
  const needle = normalizePosText(query);
  if (!needle) {
    return true;
  }
  return normalizePosText(product.nombre).includes(needle);
}

export function productInitials(nombre: string): string {
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "•";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

export function posCategories(products: Array<{ categoria: string }>): string[] {
  const names = new Set<string>();
  for (const product of products) {
    const name = product.categoria.trim();
    if (name && !/^(all|todos)$/i.test(name)) {
      names.add(name);
    }
  }
  return Array.from(names).sort((left, right) => left.localeCompare(right, "es"));
}

export function stockBadge(stock: number | null): { label: string; tone: "low" | "negative" } | null {
  if (stock == null || stock > POS_LOW_STOCK) {
    return null;
  }
  if (stock < 0) {
    return { label: `Stock ${stock}`, tone: "negative" };
  }
  return { label: `Quedan ${stock}`, tone: "low" };
}

export function pendingQtyByProduct(
  sales: Array<{ status: PosSaleStatus; items: PosSaleItem[] }>
): Map<string, number> {
  const qty = new Map<string, number>();
  for (const sale of sales) {
    if (sale.status !== "pendiente_sync") {
      continue;
    }
    for (const item of sale.items) {
      qty.set(item.productoId, (qty.get(item.productoId) ?? 0) + item.cantidad);
    }
  }
  return qty;
}

export function withOptimisticStock(products: PosStoredProduct[], pending: Map<string, number>): PosProduct[] {
  return products.map((product) => {
    if (product.stockBase == null) {
      return { ...product, stock: null };
    }
    const sold = pending.get(product.id) ?? 0;
    return { ...product, stock: product.stockBase - sold };
  });
}

export function addProductToCart(lines: CartLine[], product: Pick<PosProduct, "id" | "nombre" | "precio">): CartLine[] {
  const existing = lines.find((line) => line.productoId === product.id);
  if (!existing) {
    return [
      ...lines,
      {
        productoId: product.id,
        nombre: product.nombre,
        precioUnitario: product.precio,
        cantidad: 1,
        descuentoTipo: "ninguno",
        descuentoValor: 0,
      },
    ];
  }
  return lines.map((line) =>
    line.productoId === product.id
      ? { ...line, cantidad: Math.min(POS_MAX_QTY, line.cantidad + 1) }
      : line
  );
}

export function setCartQty(lines: CartLine[], productoId: string, cantidad: number): CartLine[] {
  if (!Number.isInteger(cantidad) || cantidad <= 0) {
    return lines.filter((line) => line.productoId !== productoId);
  }
  const next = Math.min(POS_MAX_QTY, cantidad);
  return lines.map((line) => (line.productoId === productoId ? { ...line, cantidad: next } : line));
}

export function posQuickCashAmounts(total: number): Array<{ amount: number; label: string }> {
  const exact = centsToMoney(moneyCents(total));
  const amounts = new Set<number>([exact]);
  for (const bill of suggestedPagoConAmounts(Math.max(exact, 0))) {
    if (moneyCents(bill) >= moneyCents(exact)) {
      amounts.add(centsToMoney(moneyCents(bill)));
    }
  }
  return Array.from(amounts)
    .sort((left, right) => left - right)
    .slice(0, 6)
    .map((amount) => ({
      amount,
      label: moneyCents(amount) === moneyCents(exact) ? "Exacto" : formatPrice(amount),
    }));
}

export function shiftTotals(sales: Array<{ metodoPago: string; total: number }>): ShiftTotals {
  let efectivo = 0;
  let tarjeta = 0;
  let transferencia = 0;
  for (const sale of sales) {
    const cents = moneyCents(sale.total);
    if (sale.metodoPago === "efectivo") efectivo += cents;
    else if (sale.metodoPago === "tarjeta") tarjeta += cents;
    else if (sale.metodoPago === "transferencia") transferencia += cents;
  }
  return {
    efectivo: centsToMoney(efectivo),
    tarjeta: centsToMoney(tarjeta),
    transferencia: centsToMoney(transferencia),
    ventas: sales.length,
  };
}

export function shiftCashExpected(fondoInicial: number, efectivoVentas: number): number {
  return centsToMoney(moneyCents(fondoInicial) + moneyCents(efectivoVentas));
}

export function shiftDifference(contado: number, esperado: number): number {
  return centsToMoney(moneyCents(contado) - moneyCents(esperado));
}

export function shiftDifferenceLabel(diferencia: number): { text: string; tone: "ok" | "short" | "over" } {
  const cents = moneyCents(diferencia);
  if (cents === 0) {
    return { text: "Cuadra", tone: "ok" };
  }
  if (cents < 0) {
    return { text: `Falta ${formatPrice(centsToMoney(Math.abs(cents)))}`, tone: "short" };
  }
  return { text: `Sobra ${formatPrice(diferencia)}`, tone: "over" };
}

export function buildOpenShift(input: {
  clientId: string;
  abiertoEn: string;
  abiertoPor: string;
  fondoInicial: number;
}): PosShiftRecord | { error: string } {
  if (!UUID_RE.test(input.clientId)) {
    return { error: "Identificador de turno inválido" };
  }
  const abiertoPor = input.abiertoPor.trim().slice(0, 80);
  if (!abiertoPor) {
    return { error: "Escribe el nombre de quien abre" };
  }
  if (!Number.isFinite(input.fondoInicial) || input.fondoInicial < 0 || input.fondoInicial > 1_000_000) {
    return { error: "Fondo inicial inválido" };
  }
  return {
    clientId: input.clientId,
    abiertoEn: input.abiertoEn,
    cerradoEn: null,
    fondoInicial: centsToMoney(moneyCents(input.fondoInicial)),
    efectivoContado: null,
    abiertoPor,
    estado: "abierto",
    aperturaSync: "pendiente_sync",
    cierreSync: "no_aplica",
    notas: null,
    lastError: null,
    ventasAlCierre: null,
  };
}

export function buildShiftClose(input: {
  shift: PosShiftRecord;
  sales: Array<{ metodoPago: string; total: number }>;
  efectivoContado: number;
  notas: string;
  cerradoEn: string;
}): { shift: PosShiftRecord; totals: ShiftTotals; esperado: number; diferencia: number } | { error: string } {
  if (input.shift.estado !== "abierto") {
    return { error: "Este turno ya está cerrado" };
  }
  if (!Number.isFinite(input.efectivoContado) || input.efectivoContado < 0 || input.efectivoContado > 1_000_000) {
    return { error: "Indica el efectivo contado" };
  }
  const totals = shiftTotals(input.sales);
  const esperado = shiftCashExpected(input.shift.fondoInicial, totals.efectivo);
  const contado = centsToMoney(moneyCents(input.efectivoContado));
  const diferencia = shiftDifference(contado, esperado);
  const notas = input.notas.trim().slice(0, 500);
  return {
    totals,
    esperado,
    diferencia,
    shift: {
      ...input.shift,
      estado: "cerrado",
      cerradoEn: input.cerradoEn,
      efectivoContado: contado,
      cierreSync: "pendiente_sync",
      notas: notas || null,
      lastError: null,
      ventasAlCierre: totals.ventas,
    },
  };
}

export function isPosShiftRecord(value: PosShiftRecord | { error: string }): value is PosShiftRecord {
  return !("error" in value);
}

export function setLineDiscount(
  lines: CartLine[],
  productoId: string,
  descuento: PosDescuento,
  ticket: PosDescuento
): CartLine[] | { error: string } {
  const next = lines.map((line) =>
    line.productoId === productoId
      ? {
          ...line,
          descuentoTipo: descuento.tipo,
          descuentoValor: descuento.tipo === "ninguno" ? 0 : descuento.valor,
        }
      : line
  );
  if (!manualDiscountWithinCap(next, ticket)) {
    return { error: `El descuento pasa del ${POS_DESCUENTO_TOPE_PCT}%` };
  }
  return next;
}

export function buildSale(input: {
  clientId: string;
  createdAt: string;
  lines: CartLine[];
  metodoPago: PosMetodoPago;
  montoRecibido: number | null;
  turnoClientId: string;
  cajero: string;
  ticket?: PosDescuento;
  quickcoins?: PosQuickcoinsDraft | null;
}): PosSaleDraft | { error: string } {
  if (!UUID_RE.test(input.clientId)) {
    return { error: "Identificador de venta inválido" };
  }
  if (!UUID_RE.test(input.turnoClientId)) {
    return { error: "Abre un turno antes de cobrar" };
  }
  const cajero = input.cajero.trim().slice(0, 80);
  if (!cajero) {
    return { error: "Abre un turno antes de cobrar" };
  }
  if (input.lines.length === 0) {
    return { error: "El carrito está vacío" };
  }
  const ticket = input.ticket ?? POS_SIN_DESCUENTO;
  const coinCents = quickcoinsDiscountCents(input.quickcoins?.canjePuntos ?? 0);
  const priced = priceCart(input.lines, ticket, coinCents);
  if ("error" in priced) return priced;
  const total = centsToMoney(priced.totalCents);
  const descuentoTicket = centsToMoney(priced.ticketDiscountCents);
  const descuentoTotal = centsToMoney(priced.lineDiscountCents + priced.ticketDiscountCents + priced.coinDiscountCents);
  let montoRecibido: number | null = null;
  let cambio: number | null = null;
  if (input.metodoPago === "efectivo") {
    if (input.montoRecibido == null || !Number.isFinite(input.montoRecibido)) {
      return { error: "Indica el monto recibido" };
    }
    const recibido = moneyCents(input.montoRecibido);
    const due = moneyCents(total);
    if (recibido < due) {
      return { error: "El monto no cubre el total" };
    }
    montoRecibido = centsToMoney(recibido);
    cambio = centsToMoney(recibido - due);
  }
  return {
    clientId: input.clientId,
    createdAt: input.createdAt,
    items: priced.items,
    metodoPago: input.metodoPago,
    montoRecibido,
    cambio,
    total,
    status: "pendiente_sync",
    stockAdvertencia: false,
    lastError: null,
    attempts: 0,
    turnoClientId: input.turnoClientId,
    cajero,
    descuentoTicket,
    descuentoTotal,
    quickcoins: input.quickcoins
      ? {
          ...input.quickcoins,
          canjePuntos: Math.floor(priced.coinDiscountCents / Math.max(1, moneyCents(QUICKCOINS_VALOR_COIN))),
          ganarPuntos: quickcoinsEarn(priced.totalCents),
          descuentoCanje: centsToMoney(priced.coinDiscountCents),
          coinsSync: "pendiente_sync",
        }
      : null,
  };
}

function readString(source: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string") {
      return value;
    }
  }
  return "";
}

function readNumber(source: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

export function parsePosVentaInput(body: unknown): { ok: true; value: PosVentaInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "JSON inválido" };
  }
  const record = body as Record<string, unknown>;
  const clientId = readString(record, "client_id", "clientId").trim();
  if (!UUID_RE.test(clientId)) {
    return { ok: false, error: "Falta el identificador de la venta" };
  }
  const metodoRaw = readString(record, "metodo_pago", "metodoPago").trim().toLowerCase();
  if (!POS_METODOS.includes(metodoRaw as PosMetodoPago)) {
    return { ok: false, error: "Método de pago inválido" };
  }
  const metodoPago = metodoRaw as PosMetodoPago;
  const itemsRaw = record.items;
  if (!Array.isArray(itemsRaw) || itemsRaw.length === 0) {
    return { ok: false, error: "La venta no tiene productos" };
  }
  if (itemsRaw.length > 200) {
    return { ok: false, error: "Demasiados productos en la venta" };
  }
  const items: PosSaleItem[] = [];
  for (const entry of itemsRaw) {
    if (!entry || typeof entry !== "object") {
      return { ok: false, error: "Producto inválido" };
    }
    const item = entry as Record<string, unknown>;
    const productoId = readString(item, "producto_id", "productoId").trim();
    if (!UUID_RE.test(productoId)) {
      return { ok: false, error: "Producto inválido" };
    }
    const cantidad = readNumber(item, "cantidad");
    if (cantidad == null || !Number.isInteger(cantidad) || cantidad <= 0 || cantidad > POS_MAX_QTY) {
      return { ok: false, error: "Cantidad inválida" };
    }
    const precio = readNumber(item, "precio_unitario", "precioUnitario");
    if (precio == null || precio < 0 || precio > 1_000_000) {
      return { ok: false, error: "Precio inválido" };
    }
    const nombre = readString(item, "nombre").trim().slice(0, 200);
    const precioLista = readNumber(item, "precio_lista", "precioLista");
    const descuento = readNumber(item, "descuento");
    items.push({
      productoId,
      nombre,
      cantidad,
      precioUnitario: centsToMoney(moneyCents(precio)),
      precioLista: precioLista == null ? undefined : centsToMoney(moneyCents(precioLista)),
      descuento: descuento == null ? undefined : centsToMoney(moneyCents(descuento)),
    });
  }
  const fechaRaw = readString(record, "fecha", "createdAt").trim();
  let fecha: string | null = null;
  if (fechaRaw) {
    const parsed = new Date(fechaRaw);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, error: "Fecha inválida" };
    }
    fecha = parsed.toISOString();
  }
  const turnoRaw = readString(record, "turno_client_id", "turnoClientId").trim();
  let turnoClientId: string | null = null;
  if (turnoRaw) {
    if (!UUID_RE.test(turnoRaw)) {
      return { ok: false, error: "Turno inválido" };
    }
    turnoClientId = turnoRaw;
  }
  const creadoPor = readString(record, "creado_por", "creadoPor").trim().slice(0, 80) || null;
  let montoRecibido: number | null = null;
  if (metodoPago === "efectivo") {
    const monto = readNumber(record, "monto_recibido", "montoRecibido");
    if (monto == null || monto < 0) {
      return { ok: false, error: "Indica el monto recibido" };
    }
    const total = cartTotal(items);
    if (moneyCents(monto) < moneyCents(total)) {
      return { ok: false, error: "El monto no cubre el total" };
    }
    montoRecibido = centsToMoney(moneyCents(monto));
  }
  const descuentoTicket = centsToMoney(moneyCents(readNumber(record, "descuento_ticket", "descuentoTicket") ?? 0));
  const descuentoTotal = centsToMoney(moneyCents(readNumber(record, "descuento_total", "descuentoTotal") ?? 0));
  const coinsRaw = record.quickcoins;
  let quickcoins: PosQuickcoinsDraft | null = null;
  let canjePuntos = 0;
  if (coinsRaw && typeof coinsRaw === "object") {
    const coins = coinsRaw as Record<string, unknown>;
    const telefono = readString(coins, "telefono").replace(/\D/g, "");
    canjePuntos = readNumber(coins, "canje_puntos", "canjePuntos") ?? 0;
    const ganarPuntos = readNumber(coins, "ganar_puntos", "ganarPuntos") ?? 0;
    if (!telefono || telefono.length < 10 || telefono.length > 15) {
      return { ok: false, error: "Teléfono de QuickCoins inválido" };
    }
    if (!Number.isInteger(canjePuntos) || canjePuntos < 0 || !Number.isInteger(ganarPuntos) || ganarPuntos < 0) {
      return { ok: false, error: "QuickCoins inválidos" };
    }
    if (canjePuntos > 0 && canjePuntos < QUICKCOINS_MINIMO_CANJE) {
      return { ok: false, error: `El mínimo para canjear es ${QUICKCOINS_MINIMO_CANJE} QuickCoins` };
    }
    quickcoins = {
      telefono,
      nombre: readString(coins, "nombre").trim().slice(0, 80) || "Cliente",
      canjePuntos,
      ganarPuntos,
      descuentoCanje: centsToMoney(quickcoinsDiscountCents(canjePuntos)),
      coinsSync: "pendiente_sync",
    };
  }
  if (items.some((item) => item.precioLista != null)) {
    const listLines = items.map((item) => ({
      precioUnitario: item.precioLista ?? item.precioUnitario,
      cantidad: item.cantidad,
    }));
    const listCents = listLines.reduce((sum, item) => sum + lineListCents(item), 0);
    const netCents = items.reduce((sum, item) => sum + moneyCents(item.precioUnitario) * item.cantidad, 0);
    const manualCents = listCents - netCents - quickcoinsDiscountCents(canjePuntos);
    if (manualCents > discountCapCents(listLines) + 1) {
      return { ok: false, error: `El descuento pasa del ${POS_DESCUENTO_TOPE_PCT}%` };
    }
  }
  return {
    ok: true,
    value: { clientId, fecha, metodoPago, montoRecibido, items, turnoClientId, creadoPor, descuentoTicket, descuentoTotal, quickcoins },
  };
}

export type PosAbrirTurnoInput = {
  clientId: string;
  abiertoEn: string | null;
  fondoInicial: number;
  abiertoPor: string;
};

export type PosCerrarTurnoInput = {
  clientId: string;
  cerradoEn: string | null;
  efectivoContado: number;
  notas: string | null;
  ventasCount: number;
};

export function parseAbrirTurnoInput(body: unknown): { ok: true; value: PosAbrirTurnoInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "JSON inválido" };
  }
  const record = body as Record<string, unknown>;
  const clientId = readString(record, "client_id", "clientId").trim();
  if (!UUID_RE.test(clientId)) {
    return { ok: false, error: "Falta el identificador del turno" };
  }
  const abiertoPor = readString(record, "abierto_por", "abiertoPor").trim().slice(0, 80);
  if (!abiertoPor) {
    return { ok: false, error: "Escribe el nombre de quien abre" };
  }
  const fondo = readNumber(record, "fondo_inicial", "fondoInicial");
  if (fondo == null || fondo < 0 || fondo > 1_000_000) {
    return { ok: false, error: "Fondo inicial inválido" };
  }
  const abiertoRaw = readString(record, "abierto_en", "abiertoEn").trim();
  let abiertoEn: string | null = null;
  if (abiertoRaw) {
    const parsed = new Date(abiertoRaw);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, error: "Fecha inválida" };
    }
    abiertoEn = parsed.toISOString();
  }
  return {
    ok: true,
    value: {
      clientId,
      abiertoEn,
      fondoInicial: centsToMoney(moneyCents(fondo)),
      abiertoPor,
    },
  };
}

export function parseCerrarTurnoInput(body: unknown): { ok: true; value: PosCerrarTurnoInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "JSON inválido" };
  }
  const record = body as Record<string, unknown>;
  const clientId = readString(record, "client_id", "clientId").trim();
  if (!UUID_RE.test(clientId)) {
    return { ok: false, error: "Falta el identificador del turno" };
  }
  const contado = readNumber(record, "efectivo_contado", "efectivoContado");
  if (contado == null || contado < 0 || contado > 1_000_000) {
    return { ok: false, error: "Indica el efectivo contado" };
  }
  const ventas = readNumber(record, "ventas_count", "ventasCount");
  if (ventas == null || !Number.isInteger(ventas) || ventas < 0 || ventas > 100_000) {
    return { ok: false, error: "Conteo de ventas inválido" };
  }
  const cerradoRaw = readString(record, "cerrado_en", "cerradoEn").trim();
  let cerradoEn: string | null = null;
  if (cerradoRaw) {
    const parsed = new Date(cerradoRaw);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, error: "Fecha inválida" };
    }
    cerradoEn = parsed.toISOString();
  }
  const notas = readString(record, "notas").trim().slice(0, 500) || null;
  return {
    ok: true,
    value: {
      clientId,
      cerradoEn,
      efectivoContado: centsToMoney(moneyCents(contado)),
      notas,
      ventasCount: ventas,
    },
  };
}

export function isPosSaleDraft(value: PosSaleDraft | { error: string }): value is PosSaleDraft {
  return !("error" in value);
}

export type PosStockDetalle = {
  nombre: string;
  motivo: string;
  cantidad: number | null;
  stockAntes: number | null;
  stockDespues: number | null;
};

export type PosTurnoResumen = {
  id: string;
  clientId: string;
  abiertoEn: string;
  cerradoEn: string | null;
  fondoInicial: number;
  efectivoContado: number | null;
  efectivoEsperado: number | null;
  diferencia: number | null;
  totalEfectivo: number;
  totalTarjeta: number;
  totalTransferencia: number;
  ventasCount: number;
  estado: string;
  abiertoPor: string;
  notas: string | null;
};

export type PosAdvertencia = {
  id: string;
  fecha: string;
  total: number;
  metodoPago: string;
  montoRecibido: number | null;
  cambio: number | null;
  detalle: PosStockDetalle[];
};

export function metodoPagoLabel(metodo: string): string {
  if (metodo === "efectivo") return "Efectivo";
  if (metodo === "tarjeta") return "Tarjeta";
  if (metodo === "transferencia") return "Transferencia";
  return metodo;
}
