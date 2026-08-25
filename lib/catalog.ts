import {
  CATALOG_PRODUCT_IDS_MAX,
  CATALOG_PRODUCT_PAGE_MAX,
  CATALOG_PRODUCT_PAGE_SIZE,
  type CatalogCategoryChip,
  type CatalogProductsPage,
} from "@/lib/catalog-products-shared";
import { rankSearchSuggestions, SEARCH_SUGGESTION_LIMIT, SEARCH_SUGGESTION_MIN_CHARS } from "@/lib/catalog-search";
import { toMoney } from "@/lib/money";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { isPharmaCategory } from "@/lib/theme";
import type { MetodoPago, OrderDraft, OrderSession, Product } from "@/lib/types";

export {
  CATALOG_PRODUCT_PAGE_SIZE,
  type CatalogCategoryChip,
  type CatalogProductsPage,
} from "@/lib/catalog-products-shared";

const PRODUCT_SELECT = "id, nombre, marca, descripcion, precio, foto_url, categoria";

type ProductRow = {
  id: unknown;
  nombre: unknown;
  marca?: unknown;
  descripcion?: unknown;
  precio: unknown;
  foto_url?: unknown;
  categoria: unknown;
};

function mapCatalogProduct(row: ProductRow): Product {
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

export class CatalogCursorError extends Error {
  constructor() {
    super("El cursor de paginación no es válido.");
    this.name = "CatalogCursorError";
  }
}

function sanitizeCatalogSearch(raw: string): string {
  return raw
    .trim()
    .replace(/[%_,()]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

function encodeCatalogCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ o: offset }), "utf8").toString("base64url");
}

function decodeCatalogCursor(raw: string | null | undefined): number {
  if (!raw) {
    return 0;
  }
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as { o?: unknown };
    const offset = typeof parsed.o === "number" ? parsed.o : Number(parsed.o);
    if (!Number.isInteger(offset) || offset < 0 || offset > 100_000) {
      return -1;
    }
    return offset;
  } catch {
    return -1;
  }
}

export async function getActiveOrderSession(
  sessionId: string
): Promise<OrderSession | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("order_sessions")
    .select("id, chat_id, estado, expira_en, edit_order_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const session = data as OrderSession;
  if (session.estado !== "activa") {
    return null;
  }

  if (new Date(session.expira_en).getTime() <= Date.now()) {
    return null;
  }

  return {
    ...session,
    edit_order_id: (data.edit_order_id as string | null) ?? null,
  };
}

const CATALOG_SESSION_TTL_MS = 2 * 60 * 60 * 1000;

export async function createCatalogSession(chatId: string): Promise<string> {
  const supabase = getSupabaseAdminClient();

  await supabase
    .from("order_sessions")
    .update({ estado: "expirada" })
    .eq("chat_id", chatId)
    .eq("estado", "activa");

  const { data: session, error } = await supabase
    .from("order_sessions")
    .insert({
      chat_id: chatId,
      estado: "activa",
      expira_en: new Date(Date.now() + CATALOG_SESSION_TTL_MS).toISOString(),
    })
    .select("id")
    .single();

  if (error || !session) {
    throw new Error("No pudimos crear la sesión de pedido");
  }

  return session.id as string;
}

export async function ensureActiveCatalogSession(chatId: string): Promise<string> {
  const supabase = getSupabaseAdminClient();
  const { data: existing } = await supabase
    .from("order_sessions")
    .select("id, expira_en, edit_order_id")
    .eq("chat_id", chatId)
    .eq("estado", "activa")
    .order("expira_en", { ascending: false })
    .limit(8);

  const reusable = (existing ?? []).find((row) => {
    const notExpired = new Date(String(row.expira_en)).getTime() > Date.now();
    const notEdit = !row.edit_order_id;
    return notExpired && notEdit;
  });

  if (reusable?.id) {
    return String(reusable.id);
  }

  return createCatalogSession(chatId);
}

export async function getOrderDraft(orderId: string): Promise<OrderDraft | null> {
  const supabase = getSupabaseAdminClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      direccion,
      metodo_pago,
      order_items (
        product_id,
        cantidad,
        estado
      )
    `
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error || !order) {
    return null;
  }

  const metodo = String(order.metodo_pago ?? "");
  const metodoPago: MetodoPago | null =
    metodo === "efectivo" || metodo === "tarjeta" ? metodo : null;

  const rawItems = Array.isArray(order.order_items) ? order.order_items : [];
  const items = rawItems
    .filter((item) => String(item.estado ?? "ok") !== "eliminado")
    .map((item) => ({
      productId: String(item.product_id),
      cantidad: Number(item.cantidad),
    }))
    .filter((item) => item.productId && Number.isInteger(item.cantidad) && item.cantidad > 0);

  return {
    orderId: order.id as string,
    direccion: String(order.direccion ?? ""),
    metodoPago,
    items,
  };
}

export async function getActiveProducts(): Promise<Product[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("activo", true)
    .order("categoria", { ascending: true })
    .order("nombre", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map((row) => mapCatalogProduct(row));
}

export async function listActiveCatalogCategories(): Promise<CatalogCategoryChip[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("products").select("categoria").eq("activo", true);

  if (error || !data) {
    return [];
  }

  const counts = new Map<string, number>();
  for (const row of data) {
    const name = String(row.categoria ?? "").trim();
    if (!name) {
      continue;
    }
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  const chips = Array.from(counts.entries()).map(([name, count]) => ({ name, count }));
  const byName = (left: CatalogCategoryChip, right: CatalogCategoryChip) =>
    left.name.localeCompare(right.name, "es");
  return [
    ...chips.filter((chip) => !isPharmaCategory(chip.name)).sort(byName),
    ...chips.filter((chip) => isPharmaCategory(chip.name)).sort(byName),
  ];
}

export async function getActiveProductsByIds(ids: string[]): Promise<Product[]> {
  const unique = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean))).slice(
    0,
    CATALOG_PRODUCT_IDS_MAX
  );
  if (unique.length === 0) {
    return [];
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("activo", true)
    .in("id", unique);

  if (error || !data) {
    return [];
  }

  const byId = new Map(data.map((row) => [String(row.id), mapCatalogProduct(row)]));
  return unique.map((id) => byId.get(id)).filter((product): product is Product => Boolean(product));
}

export async function listActiveProductsPage(options: {
  cursor?: string | null;
  limit?: number;
  categoria?: string | null;
  q?: string | null;
}): Promise<CatalogProductsPage> {
  const requested = options.limit ?? CATALOG_PRODUCT_PAGE_SIZE;
  const limit = Number.isInteger(requested)
    ? Math.min(Math.max(requested, 1), CATALOG_PRODUCT_PAGE_MAX)
    : CATALOG_PRODUCT_PAGE_SIZE;
  const offset = decodeCatalogCursor(options.cursor);
  if (offset < 0) {
    throw new CatalogCursorError();
  }

  const supabase = getSupabaseAdminClient();
  let query = supabase.from("products").select(PRODUCT_SELECT).eq("activo", true);

  const categoria = options.categoria?.trim() ?? "";
  if (categoria) {
    query = query.eq("categoria", categoria);
  }

  const q = sanitizeCatalogSearch(options.q ?? "");
  if (q) {
    query = query.or(
      `nombre.ilike.%${q}%,marca.ilike.%${q}%,categoria.ilike.%${q}%,descripcion.ilike.%${q}%`
    );
  }

  const { data, error } = await query
    .order("categoria", { ascending: true })
    .order("nombre", { ascending: true })
    .order("id", { ascending: true })
    .range(offset, offset + limit);

  if (error) {
    throw error;
  }

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  return {
    products: page.map((row) => mapCatalogProduct(row)),
    hasMore,
    nextCursor: hasMore ? encodeCatalogCursor(offset + limit) : null,
  };
}

export async function listCatalogSearchSuggestions(q: string): Promise<Product[]> {
  const sanitized = sanitizeCatalogSearch(q);
  if (sanitized.length < SEARCH_SUGGESTION_MIN_CHARS) {
    return [];
  }

  const page = await listActiveProductsPage({
    q: sanitized,
    limit: CATALOG_PRODUCT_PAGE_MAX,
  });
  return rankSearchSuggestions(page.products, sanitized, SEARCH_SUGGESTION_LIMIT);
}
