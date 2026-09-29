import { parsePosSaleRequest, type PosAdvertencia, type PosProduct, type PosSaleRequest } from "@/lib/pos-shared";
import { toMoney } from "@/lib/money";
import { getSupabaseAdminClient } from "@/lib/supabase";

type ProductRow = {
  id: string;
  nombre: string;
  precio: number | string;
  foto_url: string | null;
  categoria: string;
  stock: number | null;
};

export async function listPosProducts(): Promise<PosProduct[]> {
  const supabase = getSupabaseAdminClient();
  const pageSize = 1000;
  const products: PosProduct[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await supabase
      .from("products")
      .select("id, nombre, precio, foto_url, categoria, stock")
      .eq("activo", true)
      .order("nombre", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) {
      throw new Error(error.message);
    }
    const rows = (data ?? []) as ProductRow[];
    for (const row of rows) {
      products.push({
        id: row.id,
        nombre: row.nombre,
        precio: toMoney(row.precio),
        fotoUrl: row.foto_url,
        categoria: row.categoria,
        stock: row.stock == null ? null : Number(row.stock),
      });
    }
    if (rows.length < pageSize) {
      break;
    }
    from += pageSize;
  }

  return products;
}

export type PosSaleResult = {
  id: string;
  clientId: string;
  total: number;
  cambio: number | null;
  stockAdvertencia: boolean;
  alreadySynced: boolean;
};

export async function registrarVentaPos(request: PosSaleRequest): Promise<PosSaleResult> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc("registrar_venta_pos", {
    p_client_id: request.clientId,
    p_metodo_pago: request.metodoPago,
    p_monto_recibido: request.montoRecibido,
    p_creado_por: "staff",
    p_items: request.items.map((item) => ({
      producto_id: item.productoId,
      cantidad: item.cantidad,
      precio_unitario: item.precioUnitario,
    })),
  });
  if (error) {
    throw new Error(error.message);
  }
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    id: String(row.id ?? ""),
    clientId: String(row.clientId ?? request.clientId),
    total: toMoney(row.total),
    cambio: row.cambio == null ? null : toMoney(row.cambio),
    stockAdvertencia: Boolean(row.stockAdvertencia),
    alreadySynced: Boolean(row.alreadySynced),
  };
}

export function posSaleErrorStatus(message: string): number {
  if (
    /client_id_requerido|metodo_pago_invalido|items_requeridos|demasiados_items|cantidad_invalida|precio_invalido|monto_insuficiente|producto_no_existe|invalid input syntax/i.test(
      message
    )
  ) {
    return 400;
  }
  return 500;
}

export { parsePosSaleRequest };

export async function listPosAdvertencias(): Promise<PosAdvertencia[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("ventas_pos")
    .select("id, created_at, total, metodo_pago, stock_advertencia_detalle")
    .eq("stock_advertencia", true)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    throw new Error(error.message);
  }
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    createdAt: String(row.created_at),
    total: toMoney(row.total),
    metodoPago: String(row.metodo_pago),
    detalle: row.stock_advertencia_detalle ? String(row.stock_advertencia_detalle) : null,
  }));
}
