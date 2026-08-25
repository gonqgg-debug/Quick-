import { isDayKey, localDayKey } from "@/lib/local-day";
import {
  MASS_MESSAGE_PAUSE_MS,
  WHATSAPP_TEXT_MAX,
  type MassMessageFilter,
  type MassMessagePreview,
  type MassMessageProgressEvent,
} from "@/lib/admin-mensajes-masivos-shared";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { sendTextMessage } from "@/lib/whatsapp";

const PAGE_SIZE = 1000;

type ChatRow = {
  id?: unknown;
  phone_number?: unknown;
  acepta_marketing?: unknown;
};

type OrderRow = {
  chat_id?: unknown;
  created_at?: unknown;
  es_prueba?: unknown;
};

export type MassMessageRecipient = {
  chatId: string;
  phoneNumber: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isTestPhone(phoneNumber: string): boolean {
  return phoneNumber.trim().toLowerCase().startsWith("prueba");
}

export function parseDayFilter(value: unknown): string | null {
  if (value == null || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return isDayKey(trimmed) ? trimmed : null;
}

export function parseMassMessageFilter(input: {
  ultimoPedidoDesde?: unknown;
  ultimoPedidoHasta?: unknown;
}): { ok: true; filter: MassMessageFilter } | { ok: false; message: string } {
  const desdeRaw = input.ultimoPedidoDesde;
  const hastaRaw = input.ultimoPedidoHasta;
  const hasDesde = !(desdeRaw == null || desdeRaw === "");
  const hasHasta = !(hastaRaw == null || hastaRaw === "");
  const ultimoPedidoDesde = hasDesde ? parseDayFilter(desdeRaw) : null;
  const ultimoPedidoHasta = hasHasta ? parseDayFilter(hastaRaw) : null;
  if (hasDesde && !ultimoPedidoDesde) {
    return { ok: false, message: "La fecha inicial del último pedido no es válida." };
  }
  if (hasHasta && !ultimoPedidoHasta) {
    return { ok: false, message: "La fecha final del último pedido no es válida." };
  }
  if (ultimoPedidoDesde && ultimoPedidoHasta && ultimoPedidoDesde > ultimoPedidoHasta) {
    return { ok: false, message: "La fecha inicial no puede ser posterior a la final." };
  }
  return { ok: true, filter: { ultimoPedidoDesde, ultimoPedidoHasta } };
}

export function parseBroadcastMessage(value: unknown): { ok: true; message: string } | { ok: false; message: string } {
  if (typeof value !== "string") {
    return { ok: false, message: "Escribe el mensaje." };
  }
  const message = value.trim();
  if (!message) {
    return { ok: false, message: "Escribe el mensaje." };
  }
  if (message.length > WHATSAPP_TEXT_MAX) {
    return { ok: false, message: `El mensaje no puede pasar de ${WHATSAPP_TEXT_MAX} caracteres.` };
  }
  return { ok: true, message };
}

async function fetchMarketingChats(): Promise<ChatRow[]> {
  const supabase = getSupabaseAdminClient();
  const rows: ChatRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("chats")
      .select("id, phone_number, acepta_marketing")
      .eq("acepta_marketing", true)
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
  return rows.filter((row) => Boolean(row.acepta_marketing));
}

async function lastOrderDayByChat(): Promise<Map<string, string>> {
  const supabase = getSupabaseAdminClient();
  const lastDay = new Map<string, string>();
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("orders")
      .select("chat_id, created_at, es_prueba")
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      throw error;
    }
    const page = (data ?? []) as OrderRow[];
    for (const row of page) {
      if (Boolean(row.es_prueba)) {
        continue;
      }
      const chatId = String(row.chat_id ?? "");
      const createdAt = String(row.created_at ?? "");
      if (!chatId || !createdAt || lastDay.has(chatId)) {
        continue;
      }
      const day = localDayKey(createdAt);
      if (day) {
        lastDay.set(chatId, day);
      }
    }
    if (page.length < PAGE_SIZE) {
      break;
    }
  }
  return lastDay;
}

function inLastOrderRange(lastDay: string | undefined, filter: MassMessageFilter): boolean {
  const hasRange = Boolean(filter.ultimoPedidoDesde || filter.ultimoPedidoHasta);
  if (!hasRange) {
    return true;
  }
  if (!lastDay) {
    return false;
  }
  if (filter.ultimoPedidoDesde && lastDay < filter.ultimoPedidoDesde) {
    return false;
  }
  if (filter.ultimoPedidoHasta && lastDay > filter.ultimoPedidoHasta) {
    return false;
  }
  return true;
}

function recipientsFrom(
  chats: ChatRow[],
  lastDays: Map<string, string>,
  filter: MassMessageFilter
): MassMessageRecipient[] {
  const recipients: MassMessageRecipient[] = [];
  for (const chat of chats) {
    if (!Boolean(chat.acepta_marketing)) {
      continue;
    }
    const chatId = String(chat.id ?? "");
    const phoneNumber = String(chat.phone_number ?? "").trim();
    if (!chatId || !phoneNumber || isTestPhone(phoneNumber)) {
      continue;
    }
    if (!inLastOrderRange(lastDays.get(chatId), filter)) {
      continue;
    }
    recipients.push({ chatId, phoneNumber });
  }
  return recipients;
}

export async function listMarketingAudience(filter: MassMessageFilter): Promise<MassMessageRecipient[]> {
  const [chats, lastDays] = await Promise.all([fetchMarketingChats(), lastOrderDayByChat()]);
  return recipientsFrom(chats, lastDays, filter);
}

export async function previewMarketingAudience(filter: MassMessageFilter): Promise<MassMessagePreview> {
  const [chats, lastDays] = await Promise.all([fetchMarketingChats(), lastOrderDayByChat()]);
  const emptyFilter: MassMessageFilter = { ultimoPedidoDesde: null, ultimoPedidoHasta: null };
  return {
    count: recipientsFrom(chats, lastDays, filter).length,
    totalMarketing: recipientsFrom(chats, lastDays, emptyFilter).length,
  };
}

async function stillAcceptsMarketing(chatId: string): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("chats")
    .select("acepta_marketing")
    .eq("id", chatId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return Boolean(data?.acepta_marketing);
}

export async function sendMarketingBroadcast(
  filter: MassMessageFilter,
  message: string,
  onEvent: (event: MassMessageProgressEvent) => void
): Promise<void> {
  const recipients = await listMarketingAudience(filter);
  const total = recipients.length;
  onEvent({ type: "start", total });

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (let index = 0; index < recipients.length; index += 1) {
    const recipient = recipients[index];
    try {
      const accepts = await stillAcceptsMarketing(recipient.chatId);
      if (!accepts) {
        skipped += 1;
      } else {
        await sendTextMessage(recipient.phoneNumber, message);
        sent += 1;
      }
    } catch (error) {
      failed += 1;
      console.error("[admin] mensaje masivo falló", recipient.chatId, error);
    }
    onEvent({ type: "progress", sent, failed, skipped, total });
    if (index < recipients.length - 1) {
      await sleep(MASS_MESSAGE_PAUSE_MS);
    }
  }

  onEvent({ type: "done", sent, failed, skipped, total });
}
