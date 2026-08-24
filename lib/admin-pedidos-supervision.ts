import { localDayStartIso, todayDayKey } from "@/lib/local-day";
import { toMoney } from "@/lib/money";
import {
  elapsedMinutes,
  orderAgingLevel,
} from "@/lib/order-aging";
import { formatOrderNumber } from "@/lib/order-display";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type { OrderEstado } from "@/lib/types";
import {
  SUPERVISION_STUCK_AFTER_MINUTES,
  type SupervisionAlertaEstancado,
  type SupervisionData,
  type SupervisionPedidoActivo,
} from "@/lib/admin-pedidos-supervision-shared";

const ACTIVE_STATES: OrderEstado[] = [
  "nueva",
  "en_proceso",
  "faltante_reportado",
  "confirmada",
  "despachada",
];

const EN_PROCESO_STATES: OrderEstado[] = ["en_proceso", "faltante_reportado", "confirmada"];
const STUCK_STATES: OrderEstado[] = ["nueva", "en_proceso"];
const QUERY_LIMIT = 1000;

const ORDER_SELECT = `
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
  customers!orders_customer_id_fkey (
    nombre,
    apellido,
    phone_number
  )
`;

type ChatEmbed = { phone_number?: unknown; nombre?: unknown } | { phone_number?: unknown; nombre?: unknown }[] | null;
type CustomerEmbed =
  | { nombre?: unknown; apellido?: unknown; phone_number?: unknown }
  | { nombre?: unknown; apellido?: unknown; phone_number?: unknown }[]
  | null;

type TodayRow = {
  id?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
  estado?: unknown;
  total_estimado?: unknown;
};

type OrderRow = {
  id?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
  estado?: unknown;
  direccion?: unknown;
  total_estimado?: unknown;
  chats?: ChatEmbed;
  customers?: CustomerEmbed;
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

function isoOrEmpty(value: unknown): string {
  const raw = typeof value === "string" ? value : value instanceof Date ? value.toISOString() : "";
  const time = new Date(raw).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : "";
}

function clienteDe(row: OrderRow): { nombre: string | null; telefono: string } {
  const chat = unwrapOne(row.chats);
  const customer = unwrapOne(row.customers);
  const customerName = [customer?.nombre, customer?.apellido]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(" ");
  const chatName = typeof chat?.nombre === "string" ? chat.nombre.trim() : "";
  const telefono =
    (typeof customer?.phone_number === "string" && customer.phone_number.trim()) ||
    (typeof chat?.phone_number === "string" && chat.phone_number.trim()) ||
    "Sin teléfono";
  return { nombre: customerName || chatName || null, telefono };
}

function mapActive(row: OrderRow, now: number): SupervisionPedidoActivo | null {
  const id = String(row.id ?? "");
  const createdAt = isoOrEmpty(row.created_at);
  const estadoRaw = String(row.estado ?? "");
  if (!id || !createdAt || !isOrderEstado(estadoRaw) || !ACTIVE_STATES.includes(estadoRaw)) {
    return null;
  }
  const updatedAt = isoOrEmpty(row.updated_at) || createdAt;
  const cliente = clienteDe(row);
  return {
    id,
    numero: formatOrderNumber(id),
    clienteNombre: cliente.nombre,
    clienteTelefono: cliente.telefono,
    direccion: String(row.direccion ?? "").trim() || "Sin dirección",
    estado: estadoRaw,
    totalEstimado: toMoney(row.total_estimado),
    createdAt,
    updatedAt,
    agingLevel: orderAgingLevel(elapsedMinutes(createdAt, now)),
  };
}

export async function loadPedidosSupervision(now = Date.now()): Promise<SupervisionData> {
  const supabase = getSupabaseAdminClient();
  const todayStart = localDayStartIso(todayDayKey(now));

  const [activeResult, createdTodayResult, updatedTodayResult] = await Promise.all([
    supabase
      .from("orders")
      .select(ORDER_SELECT)
      .in("estado", ACTIVE_STATES)
      .eq("es_prueba", false)
      .order("created_at", { ascending: true })
      .limit(QUERY_LIMIT),
    supabase
      .from("orders")
      .select("id, created_at, updated_at, estado, total_estimado")
      .eq("es_prueba", false)
      .gte("created_at", todayStart)
      .limit(QUERY_LIMIT),
    supabase
      .from("orders")
      .select("id, created_at, updated_at, estado, total_estimado")
      .eq("es_prueba", false)
      .gte("updated_at", todayStart)
      .limit(QUERY_LIMIT),
  ]);

  if (activeResult.error) {
    throw activeResult.error;
  }
  if (createdTodayResult.error) {
    throw createdTodayResult.error;
  }
  if (updatedTodayResult.error) {
    throw updatedTodayResult.error;
  }

  const cola = (activeResult.data ?? [])
    .map((row) => mapActive(row as OrderRow, now))
    .filter((row): row is SupervisionPedidoActivo => Boolean(row));

  const todayById = new Map<string, TodayRow>();
  for (const row of [...(createdTodayResult.data ?? []), ...(updatedTodayResult.data ?? [])] as TodayRow[]) {
    const id = String(row.id ?? "");
    if (id) {
      todayById.set(id, row);
    }
  }
  const todayRows = Array.from(todayById.values());

  const createdToday = todayRows.filter((row) => isoOrEmpty(row.created_at) >= todayStart);
  const updatedToday = (estado: OrderEstado) =>
    todayRows.filter((row) => String(row.estado) === estado && isoOrEmpty(row.updated_at) >= todayStart);

  const despachadosHoy = updatedToday("despachada");
  const completadosHoy = updatedToday("completada");
  const canceladosHoy = updatedToday("cancelada");
  const canceladosCreadosHoy = createdToday.filter((row) => String(row.estado) === "cancelada");

  let sumaDespachoMin = 0;
  let nDespacho = 0;
  for (const row of despachadosHoy) {
    const created = new Date(isoOrEmpty(row.created_at)).getTime();
    const updated = new Date(isoOrEmpty(row.updated_at)).getTime();
    if (!Number.isFinite(created) || !Number.isFinite(updated) || updated < created) {
      continue;
    }
    sumaDespachoMin += (updated - created) / 60_000;
    nDespacho += 1;
  }

  const ticketSuma = createdToday.reduce((sum, row) => sum + toMoney(row.total_estimado), 0);

  const estancados: SupervisionAlertaEstancado[] = cola
    .filter((pedido) => STUCK_STATES.includes(pedido.estado))
    .map((pedido) => ({
      id: pedido.id,
      numero: pedido.numero,
      clienteNombre: pedido.clienteNombre,
      clienteTelefono: pedido.clienteTelefono,
      estado: pedido.estado,
      updatedAt: pedido.updatedAt,
      minutosSinAvance: elapsedMinutes(pedido.updatedAt, now),
    }))
    .filter((pedido) => pedido.minutosSinAvance >= SUPERVISION_STUCK_AFTER_MINUTES)
    .sort((left, right) => right.minutosSinAvance - left.minutosSinAvance);

  return {
    generatedAt: new Date(now).toISOString(),
    resumen: {
      nuevosSinAtender: cola.filter((pedido) => pedido.estado === "nueva").length,
      enProceso: cola.filter((pedido) => EN_PROCESO_STATES.includes(pedido.estado)).length,
      despachadosHoy: despachadosHoy.length,
      completadosHoy: completadosHoy.length,
      canceladosHoy: canceladosHoy.length,
    },
    cola,
    estancados,
    metricas: {
      pedidosCreadosHoy: createdToday.length,
      ticketPromedio: createdToday.length > 0 ? ticketSuma / createdToday.length : 0,
      tiempoPromedioDespachoMinutos: nDespacho > 0 ? sumaDespachoMin / nDespacho : null,
      tasaCancelacion: createdToday.length > 0 ? canceladosCreadosHoy.length / createdToday.length : 0,
    },
  };
}
