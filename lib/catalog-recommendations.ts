import { toMoney } from "@/lib/money";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type { Product } from "@/lib/types";

const BEST_SELLER_LIMIT = 12;
const FAVORITE_LIMIT = 8;

export type RepeatOrderItem = {
  productId: string;
  nombre: string;
  cantidad: number;
  available: boolean;
};

export type RepeatLastOrder = {
  orderId: string;
  createdAt: string;
  items: RepeatOrderItem[];
};

export type CatalogRecommendations = {
  bestSellers: Product[];
  lastOrder: RepeatLastOrder | null;
  favorites: Product[];
};

function mapProduct(row: {
  id: unknown;
  nombre: unknown;
  marca?: unknown;
  descripcion?: unknown;
  precio: unknown;
  foto_url?: unknown;
  categoria: unknown;
}): Product {
  return {
    id: String(row.id),
    nombre: String(row.nombre ?? ""),
    marca: row.marca ? String(row.marca) : null,
    descripcion: row.descripcion ? String(row.descripcion) : null,
    precio: toMoney(row.precio),
    foto_url: row.foto_url ? String(row.foto_url) : null,
    categoria: String(row.categoria ?? ""),
  };
}

export async function getBestSellers(): Promise<Product[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("sales_history_import")
    .select("codigo_odoo, cantidad_vendida");

  if (error || !data?.length) {
    return [];
  }

  const totals = new Map<string, number>();
  for (const row of data) {
    const code = String(row.codigo_odoo ?? "").trim();
    if (!code) {
      continue;
    }
    totals.set(code, (totals.get(code) ?? 0) + toMoney(row.cantidad_vendida));
  }

  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, BEST_SELLER_LIMIT * 2);
  if (ranked.length === 0) {
    return [];
  }

  const { data: products, error: productError } = await supabase
    .from("products")
    .select("id, nombre, marca, descripcion, precio, foto_url, categoria, codigo_odoo")
    .eq("activo", true)
    .in(
      "codigo_odoo",
      ranked.map(([code]) => code)
    );

  if (productError || !products?.length) {
    return [];
  }

  const byCode = new Map(products.map((row) => [String(row.codigo_odoo), mapProduct(row)]));
  return ranked
    .map(([code]) => byCode.get(code))
    .filter((product): product is Product => Boolean(product))
    .slice(0, BEST_SELLER_LIMIT);
}

export async function getRepeatLastOrder(customerId: string): Promise<RepeatLastOrder | null> {
  const supabase = getSupabaseAdminClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select("id, created_at")
    .eq("customer_id", customerId)
    .eq("estado", "completada")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !order) {
    return null;
  }

  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("product_id, cantidad, estado")
    .eq("order_id", order.id);

  if (itemsError || !items?.length) {
    return null;
  }

  const kept = items.filter((item) => String(item.estado ?? "ok") !== "eliminado");
  const productIds = [...new Set(kept.map((item) => String(item.product_id)))];
  const { data: products } = await supabase
    .from("products")
    .select("id, nombre, activo")
    .in("id", productIds);

  const byId = new Map((products ?? []).map((row) => [String(row.id), row]));
  const mapped: RepeatOrderItem[] = kept
    .map((item) => {
      const product = byId.get(String(item.product_id));
      const cantidad = Number(item.cantidad);
      if (!Number.isInteger(cantidad) || cantidad <= 0) {
        return null;
      }
      return {
        productId: String(item.product_id),
        nombre: product?.nombre ? String(product.nombre) : "Producto",
        cantidad,
        available: Boolean(product?.activo),
      };
    })
    .filter((item): item is RepeatOrderItem => Boolean(item));

  if (mapped.length === 0) {
    return null;
  }

  return {
    orderId: String(order.id),
    createdAt: String(order.created_at ?? ""),
    items: mapped,
  };
}

export async function getFavoriteProducts(customerId: string): Promise<Product[]> {
  const supabase = getSupabaseAdminClient();
  const { data: orders, error } = await supabase
    .from("orders")
    .select("id")
    .eq("customer_id", customerId)
    .eq("estado", "completada");

  if (error || !orders?.length) {
    return [];
  }

  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("product_id, cantidad, estado")
    .in(
      "order_id",
      orders.map((order) => order.id)
    );

  if (itemsError || !items?.length) {
    return [];
  }

  const frequency = new Map<string, { times: number; units: number }>();
  for (const item of items) {
    if (String(item.estado ?? "ok") === "eliminado") {
      continue;
    }
    const productId = String(item.product_id ?? "");
    const cantidad = Number(item.cantidad);
    if (!productId || !Number.isFinite(cantidad) || cantidad <= 0) {
      continue;
    }
    const current = frequency.get(productId) ?? { times: 0, units: 0 };
    current.times += 1;
    current.units += cantidad;
    frequency.set(productId, current);
  }

  const ranked = [...frequency.entries()]
    .sort((a, b) => b[1].times - a[1].times || b[1].units - a[1].units)
    .slice(0, FAVORITE_LIMIT);

  if (ranked.length === 0) {
    return [];
  }

  const { data: products, error: productError } = await supabase
    .from("products")
    .select("id, nombre, marca, descripcion, precio, foto_url, categoria")
    .eq("activo", true)
    .in(
      "id",
      ranked.map(([id]) => id)
    );

  if (productError || !products?.length) {
    return [];
  }

  const byId = new Map(products.map((row) => [String(row.id), mapProduct(row)]));
  return ranked.map(([id]) => byId.get(id)).filter((product): product is Product => Boolean(product));
}

export async function getCatalogRecommendations(customerId: string | null): Promise<CatalogRecommendations> {
  const bestSellers = await getBestSellers();
  if (!customerId) {
    return { bestSellers, lastOrder: null, favorites: [] };
  }

  const [lastOrder, favorites] = await Promise.all([
    getRepeatLastOrder(customerId),
    getFavoriteProducts(customerId),
  ]);

  return { bestSellers, lastOrder, favorites };
}
