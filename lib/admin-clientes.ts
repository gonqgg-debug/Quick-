import { formatCustomerPhone } from "@/lib/customers";
import { formatPrice, toMoney } from "@/lib/money";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type { OrderEstado } from "@/lib/types";
import type {
  AdminClienteDetalle,
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

type OrderRow = {
  id?: unknown;
  chat_id?: unknown;
  created_at?: unknown;
  total_estimado?: unknown;
  estado?: unknown;
  es_prueba?: unknown;
};

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
    .select("id, chat_id, created_at, total_estimado, estado, es_prueba")
    .eq("chat_id", id)
    .order("created_at", { ascending: false });

  if (ordersError) {
    throw ordersError;
  }

  const orderRows = (orders ?? []) as OrderRow[];
  return {
    ...mapListItem(chat as ChatRow, orderRows),
    pedidos: orderRows.map(mapPedido),
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
