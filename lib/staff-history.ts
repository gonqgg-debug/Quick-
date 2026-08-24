import type { SupabaseClient } from "@supabase/supabase-js";
import { localDayEndIso, localDayStartIso } from "@/lib/local-day";
import { formatPrice, toMoney } from "@/lib/money";
import { formatElapsedClock } from "@/lib/order-aging";
import { formatOrderNumber, orderStatusLabel } from "@/lib/order-display";
import {
  formatHistoryDateTime,
  isHistoryEstado,
  type HistoryEstado,
  type HistoryFilters,
  type HistoryOrder,
} from "@/lib/staff-history-shared";

export {
  HISTORY_PAGE_SIZE,
  HISTORY_STATES,
  formatHistoryDateTime,
  historyQueryString,
  parseHistoryFilters,
  type HistoryEstado,
  type HistoryFilters,
  type HistoryOrder,
} from "@/lib/staff-history-shared";

export const HISTORY_EXPORT_BATCH = 500;
export const HISTORY_EXPORT_MAX_ROWS = 10_000;

const SELECT = `
  id,
  created_at,
  updated_at,
  estado,
  direccion,
  metodo_pago,
  total_estimado,
  es_prueba,
  chats!orders_chat_id_fkey (
    phone_number,
    nombre
  ),
  customers!orders_customer_id_fkey (
    nombre,
    apellido,
    phone_number
  ),
  order_items (
    id,
    cantidad,
    precio_unitario,
    estado,
    products!order_items_product_id_fkey ( nombre )
  ),
  order_feedback (
    calificacion,
    comentario,
    requiere_atencion
  )
`;

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function uuidPrefixRange(hex: string): { gte: string; lte: string } | null {
  const compact = hex.toLowerCase().replace(/-/g, "");
  const looksLikeOrder =
    hex.includes("-") || compact.length === 32 || /[a-f]/.test(compact);
  if (!looksLikeOrder || !/^[0-9a-f]+$/.test(compact) || compact.length < 4 || compact.length > 32) {
    return null;
  }
  const minHex = compact.padEnd(32, "0");
  const maxHex = compact.padEnd(32, "f");
  const toUuid = (value: string) =>
    `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20, 32)}`;
  return { gte: toUuid(minHex), lte: toUuid(maxHex) };
}

export function mapHistoryOrder(row: {
  id: unknown;
  created_at: unknown;
  updated_at: unknown;
  estado: unknown;
  direccion: unknown;
  metodo_pago?: unknown;
  total_estimado: unknown;
  es_prueba?: unknown;
  chats?: unknown;
  customers?: unknown;
  order_items?: unknown;
  order_feedback?: unknown;
}): HistoryOrder {
  const chat = unwrapOne(
    row.chats as { phone_number?: string; nombre?: string | null } | { phone_number?: string; nombre?: string | null }[] | null
  );
  const customer = unwrapOne(
    row.customers as
      | { nombre?: string | null; apellido?: string | null; phone_number?: string | null }
      | { nombre?: string | null; apellido?: string | null; phone_number?: string | null }[]
      | null
  );
  const rawItems = Array.isArray(row.order_items) ? row.order_items : [];
  const items = rawItems.map((item) => {
    const product = unwrapOne(
      (item as { products?: { nombre: string } | { nombre: string }[] | null }).products
    );
    const cantidad = Number((item as { cantidad?: unknown }).cantidad);
    const precio = toMoney((item as { precio_unitario?: unknown }).precio_unitario);
    const qty = Number.isFinite(cantidad) ? cantidad : 0;
    return {
      id: String((item as { id?: unknown }).id ?? ""),
      nombre: product?.nombre ? String(product.nombre) : "Producto",
      cantidad: qty,
      precioLabel: formatPrice(precio * qty),
      estado: String((item as { estado?: unknown }).estado ?? "ok"),
    };
  });
  const itemCount = items.reduce((sum, item) => sum + item.cantidad, 0);
  const createdAt = String(row.created_at ?? "");
  const updatedAt = row.updated_at ? String(row.updated_at) : null;
  const durationLabel = updatedAt ? formatElapsedClock(createdAt, new Date(updatedAt).getTime()) : "—";
  const estado = isHistoryEstado(String(row.estado)) ? String(row.estado) : "completada";
  const customerName = [customer?.nombre, customer?.apellido]
    .map((part) => (part ? String(part).trim() : ""))
    .filter(Boolean)
    .join(" ");

  const feedbackRow = unwrapOne(
    row.order_feedback as
      | { calificacion?: unknown; comentario?: unknown; requiere_atencion?: unknown }
      | { calificacion?: unknown; comentario?: unknown; requiere_atencion?: unknown }[]
      | null
  );
  const calificacion = feedbackRow ? Number(feedbackRow.calificacion) : NaN;
  const feedback =
    feedbackRow && Number.isInteger(calificacion) && calificacion >= 1 && calificacion <= 5
      ? {
          calificacion,
          comentario: typeof feedbackRow.comentario === "string" ? feedbackRow.comentario : null,
          requiereAtencion: Boolean(feedbackRow.requiere_atencion),
        }
      : null;

  return {
    id: String(row.id),
    createdAt,
    updatedAt,
    estado: estado as HistoryEstado,
    direccion: String(row.direccion ?? ""),
    metodoPago: String(row.metodo_pago ?? ""),
    totalEstimado: toMoney(row.total_estimado),
    totalLabel: formatPrice(row.total_estimado),
    clienteNombre: customerName || (chat?.nombre ? String(chat.nombre) : null),
    clienteTelefono: customer?.phone_number
      ? String(customer.phone_number)
      : chat?.phone_number
        ? String(chat.phone_number)
        : "Sin teléfono",
    itemCount,
    durationLabel,
    items,
    esPrueba: Boolean(row.es_prueba),
    feedback,
  };
}

export async function fetchHistoryPage(
  supabase: SupabaseClient,
  filters: HistoryFilters
): Promise<{ orders: HistoryOrder[]; total: number }> {
  const attentionIds = await attentionOrderIds(supabase, filters);
  if (attentionIds && attentionIds.length === 0) {
    return { orders: [], total: 0 };
  }

  const from = (filters.page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;
  const search = await resolveHistorySearch(supabase, filters.q);
  const { data, error, count } = await buildHistoryQuery(
    supabase,
    filters,
    { count: true },
    search,
    attentionIds
  ).range(from, to);

  if (error) {
    throw error;
  }

  return {
    orders: (data ?? []).map(mapHistoryOrder),
    total: count ?? 0,
  };
}

export async function fetchHistoryForExport(
  supabase: SupabaseClient,
  filters: HistoryFilters
): Promise<HistoryOrder[]> {
  const attentionIds = await attentionOrderIds(supabase, filters);
  if (attentionIds && attentionIds.length === 0) {
    return [];
  }

  const search = await resolveHistorySearch(supabase, filters.q);
  const orders: HistoryOrder[] = [];
  let offset = 0;
  while (offset < HISTORY_EXPORT_MAX_ROWS) {
    const to = Math.min(offset + HISTORY_EXPORT_BATCH - 1, HISTORY_EXPORT_MAX_ROWS - 1);
    const { data, error } = await buildHistoryQuery(
      supabase,
      filters,
      { count: false },
      search,
      attentionIds
    ).range(offset, to);
    if (error) {
      throw error;
    }
    const batch = data ?? [];
    if (batch.length === 0) {
      break;
    }
    for (const row of batch) {
      orders.push(mapHistoryOrder(row));
    }
    if (batch.length < HISTORY_EXPORT_BATCH) {
      break;
    }
    offset += HISTORY_EXPORT_BATCH;
  }
  return orders;
}

type HistorySearch = {
  chatIds: string[];
  customerIds: string[];
  range: { gte: string; lte: string } | null;
};

async function attentionOrderIds(
  supabase: SupabaseClient,
  filters: HistoryFilters
): Promise<string[] | null> {
  if (!filters.requiereAtencion) {
    return null;
  }
  const { data, error } = await supabase
    .from("order_feedback")
    .select("order_id")
    .eq("requiere_atencion", true)
    .limit(2000);
  if (error) {
    throw error;
  }
  return Array.from(new Set((data ?? []).map((row) => String(row.order_id))));
}

async function resolveHistorySearch(supabase: SupabaseClient, rawQuery: string): Promise<HistorySearch | null> {
  const needle = rawQuery.toLowerCase();
  if (!needle) {
    return null;
  }

  const [{ data: chats, error: chatError }, { data: customers, error: customerError }] = await Promise.all([
    supabase.from("chats").select("id").or(`nombre.ilike.%${needle}%,phone_number.ilike.%${needle}%`).limit(200),
    supabase
      .from("customers")
      .select("id")
      .or(`nombre.ilike.%${needle}%,apellido.ilike.%${needle}%,phone_number.ilike.%${needle}%`)
      .limit(200),
  ]);
  if (chatError) {
    throw chatError;
  }
  if (customerError) {
    throw customerError;
  }

  return {
    chatIds: (chats ?? []).map((chat) => String(chat.id)),
    customerIds: (customers ?? []).map((customer) => String(customer.id)),
    range: uuidPrefixRange(needle),
  };
}

function buildHistoryQuery(
  supabase: SupabaseClient,
  filters: HistoryFilters,
  options: { count: boolean },
  search: HistorySearch | null,
  attentionIds: string[] | null
) {
  let query = supabase
    .from("orders")
    .select(SELECT, options.count ? { count: "exact" } : undefined)
    .in("estado", filters.estados)
    .order("created_at", { ascending: false });

  if (attentionIds) {
    query = query.in("id", attentionIds);
  }

  if (!filters.includePruebas) {
    query = query.eq("es_prueba", false);
  }

  const fromDay = filters.from && filters.to && filters.from > filters.to ? filters.to : filters.from;
  const toDay = filters.from && filters.to && filters.from > filters.to ? filters.from : filters.to;
  if (fromDay) {
    query = query.gte("created_at", localDayStartIso(fromDay));
  }
  if (toDay) {
    query = query.lte("created_at", localDayEndIso(toDay));
  }

  let minTotal = filters.minTotal;
  let maxTotal = filters.maxTotal;
  if (minTotal != null && maxTotal != null && minTotal > maxTotal) {
    const swap = minTotal;
    minTotal = maxTotal;
    maxTotal = swap;
  }
  if (minTotal != null) {
    query = query.gte("total_estimado", minTotal);
  }
  if (maxTotal != null) {
    query = query.lte("total_estimado", maxTotal);
  }

  if (search) {
    const orParts: string[] = [];
    if (search.range) {
      orParts.push(`and(id.gte.${search.range.gte},id.lte.${search.range.lte})`);
    }
    if (search.chatIds.length > 0) {
      orParts.push(`chat_id.in.(${search.chatIds.join(",")})`);
    }
    if (search.customerIds.length > 0) {
      orParts.push(`customer_id.in.(${search.customerIds.join(",")})`);
    }
    if (orParts.length === 0) {
      query = query.eq("id", "00000000-0000-0000-0000-000000000000");
    } else if (orParts.length === 1 && search.range && search.chatIds.length === 0 && search.customerIds.length === 0) {
      query = query.gte("id", search.range.gte).lte("id", search.range.lte);
    } else {
      query = query.or(orParts.join(","));
    }
  }

  return query;
}

export function historyExportRows(orders: HistoryOrder[]): (string | number)[][] {
  return orders.map((order) => [
    formatHistoryDateTime(order.createdAt),
    `#${formatOrderNumber(order.id)}${order.esPrueba ? " PRUEBA" : ""}`,
    order.clienteNombre || "—",
    order.clienteTelefono,
    order.direccion,
    order.itemCount,
    order.totalEstimado,
    orderStatusLabel(order.estado),
    order.durationLabel,
    order.feedback ? `${order.feedback.calificacion}/5` : "",
    order.feedback?.requiereAtencion ? "Sí" : "",
    order.feedback?.comentario || "",
  ]);
}
