import { formatCustomerPhone } from "@/lib/customers";
import { formatPrice, toMoney } from "@/lib/money";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type { OrderEstado } from "@/lib/types";
import { metodoPagoLabel } from "@/lib/customer-orders-shared";
import type {
  AdminClienteDetalle,
  AdminClienteFavorito,
  AdminClienteListItem,
  AdminClientePedido,
} from "@/lib/admin-clientes-shared";

const PAGE_SIZE = 1000;
const CHAT_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CHAT_SELECT = `
  id,
  phone_number,
  nombre,
  created_at,
  acepta_marketing,
  customers!chats_customer_id_fkey ( nombre, apellido )
`;

type CustomerEmbed =
  | { nombre?: unknown; apellido?: unknown }
  | { nombre?: unknown; apellido?: unknown }[]
  | null;

type ChatRow = {
  id?: unknown;
  phone_number?: unknown;
  nombre?: unknown;
  created_at?: unknown;
  acepta_marketing?: unknown;
  customers?: CustomerEmbed;
};

type ItemRow = {
  id?: unknown;
  product_id?: unknown;
  cantidad?: unknown;
  estado?: unknown;
  products?: { nombre?: unknown } | { nombre?: unknown }[] | null;
};

type OrderRow = {
  id?: unknown;
  chat_id?: unknown;
  created_at?: unknown;
  total_estimado?: unknown;
  estado?: unknown;
  es_prueba?: unknown;
  metodo_pago?: unknown;
  order_items?: ItemRow[] | null;
};

const FAVORITOS_LIMIT = 10;
const DETAIL_ORDER_SELECT = `
  id,
  chat_id,
  created_at,
  total_estimado,
  estado,
  es_prueba,
  metodo_pago,
  order_items (
    id,
    product_id,
    cantidad,
    estado,
    products!order_items_product_id_fkey ( nombre )
  )
`;

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function isOrderEstado(value: string): value is OrderEstado {
  return (
    value === "nueva" ||
    value === "en_proceso" ||
    value === "faltante_reportado" ||
    value === "confirmada" ||
    value === "despachada" ||
    value === "completada" ||
    value === "cancelada"
  );
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat("es-DO", {
    timeZone: "America/Santo_Domingo",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat("es-DO", {
    timeZone: "America/Santo_Domingo",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function displayNombre(chat: ChatRow): string {
  const customer = unwrapOne(chat.customers);
  const fromCustomer = [customer?.nombre, customer?.apellido]
    .map((part) => (part ? String(part).trim() : ""))
    .filter(Boolean)
    .join(" ");
  if (fromCustomer) {
    return fromCustomer;
  }
  const fromChat = typeof chat.nombre === "string" ? chat.nombre.trim() : "";
  return fromChat || "Sin nombre";
}

function countsTowardSpend(row: OrderRow): boolean {
  if (Boolean(row.es_prueba)) {
    return false;
  }
  return String(row.estado ?? "") !== "cancelada";
}

function metricsFromOrders(orders: OrderRow[]): Pick<
  AdminClienteListItem,
  | "pedidosCount"
  | "totalGastado"
  | "totalGastadoLabel"
  | "ticketPromedio"
  | "ticketPromedioLabel"
  | "ultimoPedidoAt"
  | "ultimoPedidoLabel"
> {
  const real = orders.filter((row) => !Boolean(row.es_prueba));
  const spent = real.filter(countsTowardSpend);
  const totalGastado = spent.reduce((sum, row) => sum + toMoney(row.total_estimado), 0);
  const pedidosCount = real.length;
  const ticketPromedio = spent.length > 0 ? totalGastado / spent.length : 0;
  const last = real.reduce<OrderRow | null>((current, row) => {
    const at = String(row.created_at ?? "");
    if (!at) {
      return current;
    }
    if (!current) {
      return row;
    }
    return String(current.created_at ?? "") >= at ? current : row;
  }, null);
  const ultimoPedidoAt = last?.created_at ? String(last.created_at) : null;

  return {
    pedidosCount,
    totalGastado,
    totalGastadoLabel: formatPrice(totalGastado),
    ticketPromedio,
    ticketPromedioLabel: formatPrice(ticketPromedio),
    ultimoPedidoAt,
    ultimoPedidoLabel: ultimoPedidoAt ? formatDateTime(ultimoPedidoAt) : "—",
  };
}

function mapListItem(chat: ChatRow, orders: OrderRow[]): AdminClienteListItem {
  const telefono = String(chat.phone_number ?? "").trim();
  const clienteDesde = String(chat.created_at ?? "");
  return {
    chatId: String(chat.id ?? ""),
    nombre: displayNombre(chat),
    telefono,
    telefonoLabel: formatCustomerPhone(telefono),
    aceptaMarketing: Boolean(chat.acepta_marketing),
    clienteDesde,
    clienteDesdeLabel: clienteDesde ? formatDate(clienteDesde) : "—",
    ...metricsFromOrders(orders),
  };
}

function mapPedido(row: OrderRow): AdminClientePedido {
  const estadoRaw = String(row.estado ?? "");
  const createdAt = String(row.created_at ?? "");
  return {
    id: String(row.id ?? ""),
    createdAt,
    createdAtLabel: createdAt ? formatDateTime(createdAt) : "—",
    total: toMoney(row.total_estimado),
    totalLabel: formatPrice(row.total_estimado),
    estado: isOrderEstado(estadoRaw) ? estadoRaw : "nueva",
    esPrueba: Boolean(row.es_prueba),
  };
}

function isPreferenceOrder(row: OrderRow): boolean {
  if (Boolean(row.es_prueba)) {
    return false;
  }
  return String(row.estado ?? "") !== "cancelada";
}

function averageDaysBetween(isoDates: string[]): number | null {
  const times = isoDates
    .map((iso) => new Date(iso).getTime())
    .filter((time) => Number.isFinite(time))
    .sort((left, right) => left - right);
  if (times.length < 2) {
    return null;
  }
  let sum = 0;
  for (let index = 1; index < times.length; index += 1) {
    sum += (times[index] - times[index - 1]) / 86_400_000;
  }
  return sum / (times.length - 1);
}

function formatFrecuencia(days: number | null): string {
  if (days == null) {
    return "—";
  }
  if (days < 1) {
    return "Menos de 1 día";
  }
  const rounded = days >= 10 ? Math.round(days) : Math.round(days * 10) / 10;
  return rounded === 1 ? "Cada 1 día" : `Cada ${rounded} días`;
}

function preferenceStats(orders: OrderRow[]): Pick<
  AdminClienteDetalle,
  | "frecuenciaCompraDias"
  | "frecuenciaCompraLabel"
  | "metodoPagoPreferido"
  | "metodoPagoPreferidoLabel"
> {
  const usable = orders.filter(isPreferenceOrder);
  const frecuenciaCompraDias = averageDaysBetween(usable.map((row) => String(row.created_at ?? "")));
  const counts: Record<"efectivo" | "tarjeta", number> = { efectivo: 0, tarjeta: 0 };
  let latestAt = "";
  let latestMethod: "efectivo" | "tarjeta" | null = null;
  for (const row of usable) {
    const metodo = String(row.metodo_pago ?? "");
    if (metodo !== "efectivo" && metodo !== "tarjeta") {
      continue;
    }
    counts[metodo] += 1;
    const createdAt = String(row.created_at ?? "");
    if (createdAt && createdAt >= latestAt) {
      latestAt = createdAt;
      latestMethod = metodo;
    }
  }
  let metodoPagoPreferido: "efectivo" | "tarjeta" | null = null;
  if (counts.efectivo > counts.tarjeta) {
    metodoPagoPreferido = "efectivo";
  } else if (counts.tarjeta > counts.efectivo) {
    metodoPagoPreferido = "tarjeta";
  } else {
    metodoPagoPreferido = latestMethod;
  }

  return {
    frecuenciaCompraDias,
    frecuenciaCompraLabel: formatFrecuencia(frecuenciaCompraDias),
    metodoPagoPreferido,
    metodoPagoPreferidoLabel: metodoPagoPreferido ? metodoPagoLabel(metodoPagoPreferido) : "—",
  };
}

function favoriteProducts(orders: OrderRow[]): AdminClienteFavorito[] {
  const grouped = new Map<
    string,
    { nombre: string; veces: number; cantidadTotal: number; ultimoPedidoAt: string }
  >();

  for (const order of orders) {
    if (!isPreferenceOrder(order)) {
      continue;
    }
    const createdAt = String(order.created_at ?? "");
    const items = Array.isArray(order.order_items) ? order.order_items : [];
    for (const item of items) {
      if (String(item.estado ?? "ok") === "eliminado") {
        continue;
      }
      const productId = String(item.product_id ?? "");
      if (!productId) {
        continue;
      }
      const product = unwrapOne(item.products);
      const nombre = product?.nombre ? String(product.nombre) : "Producto";
      const cantidad = Number(item.cantidad);
      const qty = Number.isFinite(cantidad) ? cantidad : 0;
      const current = grouped.get(productId);
      if (!current) {
        grouped.set(productId, {
          nombre,
          veces: 1,
          cantidadTotal: qty,
          ultimoPedidoAt: createdAt,
        });
        continue;
      }
      current.veces += 1;
      current.cantidadTotal += qty;
      if (createdAt > current.ultimoPedidoAt) {
        current.ultimoPedidoAt = createdAt;
        current.nombre = nombre;
      }
    }
  }

  return Array.from(grouped.entries())
    .map(([productId, row]) => ({
      productId,
      nombre: row.nombre,
      veces: row.veces,
      cantidadTotal: row.cantidadTotal,
      ultimoPedidoAt: row.ultimoPedidoAt,
      ultimoPedidoLabel: row.ultimoPedidoAt ? formatDate(row.ultimoPedidoAt) : "—",
    }))
    .sort((left, right) => right.cantidadTotal - left.cantidadTotal || right.veces - left.veces)
    .slice(0, FAVORITOS_LIMIT);
}

async function fetchAllChats(): Promise<ChatRow[]> {
  const supabase = getSupabaseAdminClient();
  const rows: ChatRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("chats")
      .select(CHAT_SELECT)
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      throw error;
    }
    const page = (data ?? []) as ChatRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) {
      break;
    }
  }
  return rows;
}

async function fetchAllOrders(): Promise<OrderRow[]> {
  const supabase = getSupabaseAdminClient();
  const rows: OrderRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("orders")
      .select("id, chat_id, created_at, total_estimado, estado, es_prueba")
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      throw error;
    }
    const page = (data ?? []) as OrderRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) {
      break;
    }
  }
  return rows;
}

function groupOrdersByChat(orders: OrderRow[]): Map<string, OrderRow[]> {
  const grouped = new Map<string, OrderRow[]>();
  for (const row of orders) {
    const chatId = String(row.chat_id ?? "");
    if (!chatId) {
      continue;
    }
    const list = grouped.get(chatId);
    if (list) {
      list.push(row);
    } else {
      grouped.set(chatId, [row]);
    }
  }
  return grouped;
}

export async function listAdminClientes(): Promise<AdminClienteListItem[]> {
  const [chats, orders] = await Promise.all([fetchAllChats(), fetchAllOrders()]);
  const byChat = groupOrdersByChat(orders);
  return chats.map((chat) => mapListItem(chat, byChat.get(String(chat.id ?? "")) ?? []));
}

export async function getAdminCliente(chatId: string): Promise<AdminClienteDetalle | null> {
  const id = chatId.trim();
  if (!CHAT_ID_RE.test(id)) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  const { data: chat, error: chatError } = await supabase
    .from("chats")
    .select(CHAT_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (chatError) {
    throw chatError;
  }
  if (!chat) {
    return null;
  }

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select(DETAIL_ORDER_SELECT)
    .eq("chat_id", id)
    .order("created_at", { ascending: false });

  if (ordersError) {
    throw ordersError;
  }

  const orderRows = (orders ?? []) as OrderRow[];
  return {
    ...mapListItem(chat as ChatRow, orderRows),
    pedidos: orderRows.map(mapPedido),
    favoritos: favoriteProducts(orderRows),
    ...preferenceStats(orderRows),
  };
}

export async function updateAceptaMarketing(
  chatId: string,
  aceptaMarketing: boolean
): Promise<AdminClienteListItem | null> {
  const id = chatId.trim();
  if (!CHAT_ID_RE.test(id)) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("chats")
    .update({ acepta_marketing: aceptaMarketing })
    .eq("id", id)
    .select(CHAT_SELECT)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id, chat_id, created_at, total_estimado, estado, es_prueba")
    .eq("chat_id", id);

  if (ordersError) {
    throw ordersError;
  }

  return mapListItem(data as ChatRow, (orders ?? []) as OrderRow[]);
}

export function parseAceptaMarketing(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }
  return null;
}
