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
  total_estimado,
  chats (
    phone_number,
    nombre
  ),
  order_items (
    cantidad
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
  total_estimado: unknown;
  chats?: unknown;
  order_items?: unknown;
}): HistoryOrder {
  const chat = unwrapOne(
    row.chats as { phone_number?: string; nombre?: string | null } | { phone_number?: string; nombre?: string | null }[] | null
  );
  const items = Array.isArray(row.order_items) ? row.order_items : [];
  const itemCount = items.reduce((sum, item) => {
    const qty = Number((item as { cantidad?: unknown }).cantidad);
    return sum + (Number.isFinite(qty) ? qty : 0);
  }, 0);
  const createdAt = String(row.created_at ?? "");
  const updatedAt = row.updated_at ? String(row.updated_at) : null;
  const durationLabel = updatedAt ? formatElapsedClock(createdAt, new Date(updatedAt).getTime()) : "—";
  const estado = isHistoryEstado(String(row.estado)) ? String(row.estado) : "completada";

  return {
    id: String(row.id),
    createdAt,
    updatedAt,
    estado: estado as HistoryEstado,
    direccion: String(row.direccion ?? ""),
    totalEstimado: toMoney(row.total_estimado),
    totalLabel: formatPrice(row.total_estimado),
    clienteNombre: chat?.nombre ? String(chat.nombre) : null,
    clienteTelefono: chat?.phone_number ? String(chat.phone_number) : "Sin teléfono",
    itemCount,
    durationLabel,
  };
}

export async function fetchHistoryPage(
  supabase: SupabaseClient,
  filters: HistoryFilters
): Promise<{ orders: HistoryOrder[]; total: number }> {
  const from = (filters.page - 1) * filters.pageSize;
  const to = from + filters.pageSize - 1;
  const search = await resolveHistorySearch(supabase, filters.q);
  const { data, error, count } = await buildHistoryQuery(supabase, filters, { count: true }, search).range(from, to);

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
  const search = await resolveHistorySearch(supabase, filters.q);
  const orders: HistoryOrder[] = [];
  let offset = 0;
  while (offset < HISTORY_EXPORT_MAX_ROWS) {
    const to = Math.min(offset + HISTORY_EXPORT_BATCH - 1, HISTORY_EXPORT_MAX_ROWS - 1);
    const { data, error } = await buildHistoryQuery(supabase, filters, { count: false }, search).range(offset, to);
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
  range: { gte: string; lte: string } | null;
};

async function resolveHistorySearch(supabase: SupabaseClient, rawQuery: string): Promise<HistorySearch | null> {
  const needle = rawQuery.toLowerCase();
  if (!needle) {
    return null;
  }

  const { data: chats, error: chatError } = await supabase
    .from("chats")
    .select("id")
    .or(`nombre.ilike.%${needle}%,phone_number.ilike.%${needle}%`)
    .limit(200);
  if (chatError) {
    throw chatError;
  }

  return {
    chatIds: (chats ?? []).map((chat) => String(chat.id)),
    range: uuidPrefixRange(needle),
  };
}

function buildHistoryQuery(
  supabase: SupabaseClient,
  filters: HistoryFilters,
  options: { count: boolean },
  search: HistorySearch | null
) {
  let query = supabase
    .from("orders")
    .select(SELECT, options.count ? { count: "exact" } : undefined)
    .in("estado", filters.estados)
    .order("created_at", { ascending: false });

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
    if (search.range && search.chatIds.length > 0) {
      query = query.or(
        `and(id.gte.${search.range.gte},id.lte.${search.range.lte}),chat_id.in.(${search.chatIds.join(",")})`
      );
    } else if (search.range) {
      query = query.gte("id", search.range.gte).lte("id", search.range.lte);
    } else if (search.chatIds.length > 0) {
      query = query.in("chat_id", search.chatIds);
    } else {
      query = query.eq("id", "00000000-0000-0000-0000-000000000000");
    }
  }

  return query;
}

export function historyExportRows(orders: HistoryOrder[]): (string | number)[][] {
  return orders.map((order) => [
    formatHistoryDateTime(order.createdAt),
    `#${formatOrderNumber(order.id)}`,
    order.clienteNombre || "—",
    order.clienteTelefono,
    order.direccion,
    order.itemCount,
    order.totalEstimado,
    orderStatusLabel(order.estado),
    order.durationLabel,
  ]);
}
