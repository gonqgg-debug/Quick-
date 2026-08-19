import { NextResponse } from "next/server";
import { isStaffAuthorized, unauthorized } from "@/lib/staff-auth";
import { getSupabaseAdminClient } from "@/lib/supabase";
import type { OrderEstado } from "@/lib/types";

export const dynamic = "force-dynamic";

const OPEN_ORDER_STATES: OrderEstado[] = [
  "nueva",
  "en_proceso",
  "faltante_reportado",
  "confirmada",
  "despachada",
];

type ChatRow = {
  id: string;
  phone_number: string | null;
  nombre: string | null;
  esperando_humano: boolean | null;
  esperando_humano_desde: string | null;
};

type OrderRow = {
  id: string;
  chat_id: string;
  direccion: string | null;
  estado: string;
  created_at: string;
};

type LogRow = {
  chat_id: string;
  contenido: string | null;
  created_at: string;
  tipo_contenido?: string | null;
};

function lastMessagePreview(row: LogRow | undefined): string | null {
  if (!row) {
    return null;
  }
  const tipo = String(row.tipo_contenido ?? "texto");
  const contenido = String(row.contenido ?? "").replace(/\s+/g, " ").trim();
  if (tipo === "imagen") {
    return contenido && contenido !== "Imagen" ? contenido : "Imagen";
  }
  if (tipo === "video") {
    return contenido && contenido !== "Video" ? contenido : "Video";
  }
  if (tipo === "documento") {
    return contenido || "Documento";
  }
  return contenido ? contenido.slice(0, 80) : null;
}

function pickOrderForChat(orders: OrderRow[]): OrderRow | null {
  const open = orders.find((order) => OPEN_ORDER_STATES.includes(order.estado as OrderEstado));
  return open ?? orders[0] ?? null;
}

export async function GET() {
  if (!isStaffAuthorized()) {
    return unauthorized();
  }

  const supabase = getSupabaseAdminClient();

  const { data: openChatRows, error: openError } = await supabase
    .from("chats")
    .select("id, phone_number, nombre, esperando_humano, esperando_humano_desde")
    .eq("esperando_humano", true);

  if (openError) {
    console.error("[staff] no se pudieron leer los chats abiertos", openError);
    return NextResponse.json({ error: "No pudimos leer los chats" }, { status: 500 });
  }

  const recentLogQuery = await supabase
    .from("whatsapp_log")
    .select("chat_id, contenido, created_at, tipo_contenido")
    .order("created_at", { ascending: false })
    .limit(250);
  const recentLogs = recentLogQuery.error
    ? (
        await supabase
          .from("whatsapp_log")
          .select("chat_id, contenido, created_at")
          .order("created_at", { ascending: false })
          .limit(250)
      ).data
    : recentLogQuery.data;
  if (recentLogQuery.error) {
    console.error("[staff] no se pudo leer el historial reciente", recentLogQuery.error);
  }

  const chatById = new Map<string, ChatRow>();
  for (const row of openChatRows ?? []) {
    chatById.set(row.id as string, row as ChatRow);
  }

  const recentChatIds = Array.from(
    new Set((recentLogs ?? []).map((row) => String(row.chat_id)).filter(Boolean))
  );
  const missingIds = recentChatIds.filter((id) => !chatById.has(id));
  if (missingIds.length > 0) {
    const { data: extraChats, error: extraError } = await supabase
      .from("chats")
      .select("id, phone_number, nombre, esperando_humano, esperando_humano_desde")
      .in("id", missingIds);
    if (extraError) {
      console.error("[staff] no se pudieron leer chats recientes", extraError);
    }
    for (const row of extraChats ?? []) {
      chatById.set(row.id as string, row as ChatRow);
    }
  }

  const chats = Array.from(chatById.values());
  const chatIds = chats.map((chat) => chat.id);

  const lastLogByChat = new Map<string, LogRow>();
  for (const row of (recentLogs ?? []) as LogRow[]) {
    const id = String(row.chat_id);
    if (!lastLogByChat.has(id)) {
      lastLogByChat.set(id, row);
    }
  }

  const missingLogs = chatIds.filter((id) => !lastLogByChat.has(id));
  if (missingLogs.length > 0) {
    const { data: extraLogs, error: extraLogsError } = await supabase
      .from("whatsapp_log")
      .select("chat_id, contenido, created_at, tipo_contenido")
      .in("chat_id", missingLogs)
      .order("created_at", { ascending: false })
      .limit(500);
    if (extraLogsError) {
      console.error("[staff] no se pudieron leer últimos mensajes", extraLogsError);
    }
    for (const row of (extraLogs ?? []) as LogRow[]) {
      const id = String(row.chat_id);
      if (!lastLogByChat.has(id)) {
        lastLogByChat.set(id, row);
      }
    }
  }

  const ordersByChat = new Map<string, OrderRow[]>();
  if (chatIds.length > 0) {
    const { data: orderRows, error: orderError } = await supabase
      .from("orders")
      .select("id, chat_id, direccion, estado, created_at")
      .in("chat_id", chatIds)
      .order("created_at", { ascending: false });
    if (orderError) {
      console.error("[staff] no se pudieron leer pedidos de los chats", orderError);
    }
    for (const row of (orderRows ?? []) as OrderRow[]) {
      const id = String(row.chat_id);
      const list = ordersByChat.get(id) ?? [];
      list.push(row);
      ordersByChat.set(id, list);
    }
  }

  const payload = chats.map((chat) => {
    const log = lastLogByChat.get(chat.id);
    const order = pickOrderForChat(ordersByChat.get(chat.id) ?? []);
    return {
      id: chat.id,
      phoneNumber: String(chat.phone_number ?? ""),
      nombre: chat.nombre ? String(chat.nombre) : null,
      esperandoHumano: Boolean(chat.esperando_humano),
      esperandoHumanoDesde: chat.esperando_humano_desde
        ? String(chat.esperando_humano_desde)
        : null,
      lastMessageAt: log?.created_at ? String(log.created_at) : null,
      lastMessage: lastMessagePreview(log),
      order: order
        ? {
            id: order.id,
            direccion: String(order.direccion ?? "").trim(),
            createdAt: String(order.created_at),
            estado: String(order.estado) as OrderEstado,
          }
        : null,
    };
  });

  const { count: pendingMessageCount, error: pendingError } = await supabase
    .from("chats")
    .select("id", { count: "exact", head: true })
    .eq("mensaje_pendiente", true);

  if (pendingError) {
    console.error("[staff] no se pudo contar mensajes pendientes", pendingError);
  }

  return NextResponse.json({ chats: payload, pendingMessageCount: pendingMessageCount ?? 0 });
}
