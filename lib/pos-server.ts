import { aplicarVentaMostrador } from "@/lib/inventario/operaciones";
import { existenciasPorProducto, schemaInventarioFalta } from "@/lib/inventario/movimientos";
import { toMoney } from "@/lib/money";
import type {
  PosAbrirTurnoInput,
  PosAdvertencia,
  PosCerrarTurnoInput,
  PosStoredProduct,
  PosTurnoResumen,
  PosVentaInput,
} from "@/lib/pos";
import { getSupabaseAdminClient } from "@/lib/supabase";

const PAGE = 1000;
const MAX = 8000;

type ProductRow = {
  id: string;
  nombre: string;
  marca: string | null;
  precio: number | string;
  foto_url: string | null;
  categoria: string | null;
  stock: number | null;
};

const PRODUCT_SELECT = "id, nombre, marca, precio, foto_url, categoria";

function missingStockColumn(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String((error as { message?: string } | null)?.message ?? "");
  return /stock/i.test(message) && /does not exist|schema cache|42703|PGRST204/i.test(message);
}

async function loadActiveProducts(includeStock: boolean): Promise<PosStoredProduct[]> {
  const supabase = getSupabaseAdminClient();
  const products: PosStoredProduct[] = [];
  for (let from = 0; from < MAX; from += PAGE) {
    const query = supabase
      .from("products")
      .select(includeStock ? `${PRODUCT_SELECT}, stock` : PRODUCT_SELECT)
      .eq("activo", true)
      .order("nombre", { ascending: true })
      .range(from, from + PAGE - 1);
    const { data, error } = (await query) as { data: ProductRow[] | null; error: { message?: string } | null };
    if (error) {
      throw error;
    }
    const batch = data ?? [];
    for (const row of batch) {
      products.push({
        id: String(row.id),
        nombre: String(row.nombre ?? ""),
        marca: row.marca ? String(row.marca) : null,
        precio: toMoney(row.precio),
        fotoUrl: row.foto_url ? String(row.foto_url) : null,
        categoria: String(row.categoria ?? ""),
        stockBase: !includeStock || row.stock == null ? null : Math.trunc(Number(row.stock)),
      });
    }
    if (batch.length < PAGE) {
      break;
    }
  }
  return products;
}

const POS_TIENDA = "quick";

async function existenciasDeCaja(ids: string[]): Promise<Map<string, number> | null> {
  const map = new Map<string, number>();
  try {
    for (let from = 0; from < ids.length; from += 200) {
      const parte = await existenciasPorProducto(ids.slice(from, from + 200), POS_TIENDA);
      parte.forEach((row, id) => {
        map.set(id, row.cantidad);
      });
    }
    return map;
  } catch (error) {
    if (schemaInventarioFalta(error)) {
      return null;
    }
    throw error;
  }
}

export async function listPosProducts(): Promise<PosStoredProduct[]> {
  let products: PosStoredProduct[];
  try {
    products = await loadActiveProducts(true);
  } catch (error) {
    if (!missingStockColumn(error)) {
      throw error;
    }
    products = await loadActiveProducts(false);
  }
  const existencias = await existenciasDeCaja(products.map((product) => product.id));
  if (!existencias) {
    return products;
  }
  return products.map((product) => ({
    ...product,
    stockBase: existencias.get(product.id) ?? 0,
  }));
}

export type PosVentaResult = {
  id: string;
  clientId: string;
  total: number;
  cambio: number | null;
  metodoPago: string;
  montoRecibido: number | null;
  stockAdvertencia: boolean;
  alreadySynced: boolean;
};

export async function registrarVentaPos(input: PosVentaInput): Promise<PosVentaResult> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc("registrar_venta_pos", {
    p_client_id: input.clientId,
    p_fecha: input.fecha,
    p_metodo_pago: input.metodoPago,
    p_monto_recibido: input.montoRecibido,
    p_creado_por: input.creadoPor || "staff",
    p_items: input.items.map((item) => ({
      producto_id: item.productoId,
      nombre: item.nombre,
      cantidad: item.cantidad,
      precio_unitario: item.precioUnitario,
    })),
  });
  if (error) {
    throw error;
  }
  if (input.turnoClientId) {
    const linked = await supabase
      .from("ventas_pos")
      .update({ turno_client_id: input.turnoClientId }, { count: "exact" })
      .eq("client_id", input.clientId);
    if (linked.error) {
      throw linked.error;
    }
    if (!linked.count) {
      throw new Error("No se pudo asociar la venta al turno");
    }
  }
  const row = (data ?? {}) as {
    id?: string;
    client_id?: string;
    total?: number | string;
    cambio?: number | string | null;
    metodo_pago?: string;
    monto_recibido?: number | string | null;
    stock_advertencia?: boolean;
    already_synced?: boolean;
  };
  const result: PosVentaResult = {
    id: String(row.id ?? ""),
    clientId: String(row.client_id ?? input.clientId),
    total: toMoney(row.total),
    cambio: row.cambio == null ? null : toMoney(row.cambio),
    metodoPago: String(row.metodo_pago ?? input.metodoPago),
    montoRecibido: row.monto_recibido == null ? null : toMoney(row.monto_recibido),
    stockAdvertencia: Boolean(row.stock_advertencia),
    alreadySynced: Boolean(row.already_synced),
  };
  try {
    const inventario = await aplicarVentaMostrador({
      clientId: result.clientId,
      tienda: POS_TIENDA,
      lineas: input.items.map((item) => ({
        productoId: item.productoId,
        cantidad: item.cantidad,
        nombre: item.nombre,
      })),
    });
    const cortas = inventario.aplicadas.filter((linea) => linea.stockAntes < linea.cantidad);
    if (cortas.length) {
      const detalle = cortas.map((linea) => ({
        producto_id: linea.productoId,
        nombre: linea.nombre,
        cantidad: linea.cantidad,
        stock_antes: linea.stockAntes,
        stock_despues: linea.stockDespues,
        motivo: "stock_insuficiente",
      }));
      const { error: avisoError } = await supabase
        .from("ventas_pos")
        .update({ stock_advertencia: true, stock_detalle: detalle })
        .eq("client_id", result.clientId);
      if (avisoError) {
        throw avisoError;
      }
      result.stockAdvertencia = true;
    }
  } catch (error) {
    if (schemaInventarioFalta(error)) {
      throw new Error("Falta crear las tablas de inventario. Corre la migración en Supabase.");
    }
    throw error;
  }
  return result;
}

type AdvertenciaRow = {
  id: string;
  fecha: string;
  total: number | string;
  metodo_pago: string;
  monto_recibido: number | string | null;
  cambio: number | string | null;
  stock_detalle: unknown;
};

function mapDetalle(value: unknown): PosAdvertencia["detalle"] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((entry) => {
    const row = (entry ?? {}) as Record<string, unknown>;
    const cantidad = typeof row.cantidad === "number" ? row.cantidad : null;
    const stockAntes = typeof row.stock_antes === "number" ? row.stock_antes : null;
    const stockDespues = typeof row.stock_despues === "number" ? row.stock_despues : null;
    return {
      nombre: typeof row.nombre === "string" && row.nombre.trim() ? row.nombre : "Producto",
      motivo: typeof row.motivo === "string" ? row.motivo : "stock_insuficiente",
      cantidad,
      stockAntes,
      stockDespues,
    };
  });
}

export async function listPosAdvertencias(): Promise<PosAdvertencia[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("ventas_pos")
    .select("id, fecha, total, metodo_pago, monto_recibido, cambio, stock_detalle")
    .eq("stock_advertencia", true)
    .order("fecha", { ascending: false })
    .limit(100);
  if (error) {
    throw error;
  }
  return ((data ?? []) as AdvertenciaRow[]).map((row) => ({
    id: String(row.id),
    fecha: String(row.fecha),
    total: toMoney(row.total),
    metodoPago: String(row.metodo_pago),
    montoRecibido: row.monto_recibido == null ? null : toMoney(row.monto_recibido),
    cambio: row.cambio == null ? null : toMoney(row.cambio),
    detalle: mapDetalle(row.stock_detalle),
  }));
}

function dbMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "";
}

function missingTurnosTable(error: unknown): boolean {
  const message = dbMessage(error);
  return /pos_turnos/i.test(message) && /does not exist|schema cache|42P01|PGRST205/i.test(message);
}

type TurnoRow = {
  id: string;
  client_id: string;
  abierto_en: string;
  cerrado_en: string | null;
  fondo_inicial: number | string;
  efectivo_contado: number | string | null;
  efectivo_esperado: number | string | null;
  diferencia: number | string | null;
  total_efectivo: number | string;
  total_tarjeta: number | string;
  total_transferencia: number | string;
  ventas_count: number;
  estado: string;
  abierto_por: string;
  notas: string | null;
};

function mapTurno(row: TurnoRow): PosTurnoResumen {
  return {
    id: String(row.id),
    clientId: String(row.client_id),
    abiertoEn: String(row.abierto_en),
    cerradoEn: row.cerrado_en ? String(row.cerrado_en) : null,
    fondoInicial: toMoney(row.fondo_inicial),
    efectivoContado: row.efectivo_contado == null ? null : toMoney(row.efectivo_contado),
    efectivoEsperado: row.efectivo_esperado == null ? null : toMoney(row.efectivo_esperado),
    diferencia: row.diferencia == null ? null : toMoney(row.diferencia),
    totalEfectivo: toMoney(row.total_efectivo),
    totalTarjeta: toMoney(row.total_tarjeta),
    totalTransferencia: toMoney(row.total_transferencia),
    ventasCount: Number(row.ventas_count) || 0,
    estado: String(row.estado),
    abiertoPor: String(row.abierto_por),
    notas: row.notas ? String(row.notas) : null,
  };
}

export async function abrirTurnoPos(input: PosAbrirTurnoInput): Promise<{ id: string; alreadySynced: boolean }> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc("abrir_turno_pos", {
    p_client_id: input.clientId,
    p_abierto_en: input.abiertoEn,
    p_fondo_inicial: input.fondoInicial,
    p_abierto_por: input.abiertoPor,
  });
  if (error) throw error;
  const row = (data ?? {}) as { id?: string; already_synced?: boolean };
  return { id: String(row.id ?? ""), alreadySynced: Boolean(row.already_synced) };
}

export async function cerrarTurnoPos(input: PosCerrarTurnoInput): Promise<{ id: string; diferencia: number | null }> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc("cerrar_turno_pos", {
    p_client_id: input.clientId,
    p_cerrado_en: input.cerradoEn,
    p_efectivo_contado: input.efectivoContado,
    p_notas: input.notas,
    p_ventas_count: input.ventasCount,
  });
  if (error) throw error;
  const row = (data ?? {}) as { id?: string; diferencia?: number | string | null };
  return { id: String(row.id ?? ""), diferencia: row.diferencia == null ? null : toMoney(row.diferencia) };
}

export async function listPosTurnos(): Promise<PosTurnoResumen[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("pos_turnos")
    .select(
      "id, client_id, abierto_en, cerrado_en, fondo_inicial, efectivo_contado, efectivo_esperado, diferencia, total_efectivo, total_tarjeta, total_transferencia, ventas_count, estado, abierto_por, notas"
    )
    .order("abierto_en", { ascending: false })
    .limit(40);
  if (error) {
    if (missingTurnosTable(error)) {
      throw new Error("Falta aplicar la migración de turnos en Supabase.");
    }
    throw error;
  }
  return ((data ?? []) as TurnoRow[]).map(mapTurno);
}
