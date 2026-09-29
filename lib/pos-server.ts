import { toMoney } from "@/lib/money";
import type { PosAdvertencia, PosStoredProduct, PosVentaInput } from "@/lib/pos";
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

export async function listPosProducts(): Promise<PosStoredProduct[]> {
  const supabase = getSupabaseAdminClient();
  const products: PosStoredProduct[] = [];
  for (let from = 0; from < MAX; from += PAGE) {
    const { data, error } = await supabase
      .from("products")
      .select("id, nombre, marca, precio, foto_url, categoria, stock")
      .eq("activo", true)
      .order("nombre", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) {
      throw error;
    }
    const batch = (data ?? []) as ProductRow[];
    for (const row of batch) {
      products.push({
        id: String(row.id),
        nombre: String(row.nombre ?? ""),
        marca: row.marca ? String(row.marca) : null,
        precio: toMoney(row.precio),
        fotoUrl: row.foto_url ? String(row.foto_url) : null,
        categoria: String(row.categoria ?? ""),
        stockBase: row.stock == null ? null : Math.trunc(Number(row.stock)),
      });
    }
    if (batch.length < PAGE) {
      break;
    }
  }
  return products;
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
    p_creado_por: "staff",
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
  return {
    id: String(row.id ?? ""),
    clientId: String(row.client_id ?? input.clientId),
    total: toMoney(row.total),
    cambio: row.cambio == null ? null : toMoney(row.cambio),
    metodoPago: String(row.metodo_pago ?? input.metodoPago),
    montoRecibido: row.monto_recibido == null ? null : toMoney(row.monto_recibido),
    stockAdvertencia: Boolean(row.stock_advertencia),
    alreadySynced: Boolean(row.already_synced),
  };
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
