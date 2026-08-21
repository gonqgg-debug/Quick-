import { getActiveOrderSession } from "@/lib/catalog";
import { getCustomerForChat } from "@/lib/customers";
import {
  isProductRequestEstado,
  type ProductRequest,
  type ProductRequestEstado,
} from "@/lib/product-requests-shared";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { normalizePhoneNumber } from "@/lib/whatsapp";

const PRODUCT_MAX = 200;
const NOTE_MAX = 500;

type CustomerEmbed = {
  nombre?: unknown;
  apellido?: unknown;
};

type ProductRequestRow = {
  id: unknown;
  customer_id: unknown;
  phone_number: unknown;
  producto_solicitado: unknown;
  nota: unknown;
  nota_admin: unknown;
  estado: unknown;
  created_at: unknown;
  customers?: CustomerEmbed | CustomerEmbed[] | null;
};

function trimText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function customerName(embed: ProductRequestRow["customers"]): string | null {
  const row = Array.isArray(embed) ? embed[0] : embed;
  if (!row) {
    return null;
  }
  const nombre = String(row.nombre ?? "").trim();
  const apellido = String(row.apellido ?? "").trim();
  const full = `${nombre} ${apellido}`.trim();
  return full || null;
}

function mapRequest(row: ProductRequestRow): ProductRequest | null {
  const estado = row.estado;
  if (!isProductRequestEstado(estado)) {
    return null;
  }
  const producto = String(row.producto_solicitado ?? "").trim();
  const phone = String(row.phone_number ?? "").trim();
  if (!producto || !phone) {
    return null;
  }
  return {
    id: String(row.id),
    customerId: row.customer_id ? String(row.customer_id) : null,
    phoneNumber: phone,
    clienteNombre: customerName(row.customers),
    productoSolicitado: producto,
    nota: trimText(row.nota, NOTE_MAX) || null,
    notaAdmin: trimText(row.nota_admin, NOTE_MAX) || null,
    estado,
    createdAt: String(row.created_at ?? ""),
  };
}

const SELECT_FIELDS =
  "id, customer_id, phone_number, producto_solicitado, nota, nota_admin, estado, created_at, customers ( nombre, apellido )";

export async function createProductRequestFromSession(input: {
  sessionId: unknown;
  productoSolicitado: unknown;
  nota?: unknown;
}): Promise<{ ok: true; id: string } | { ok: false; message: string; status: number }> {
  const sessionId = typeof input.sessionId === "string" ? input.sessionId.trim() : "";
  const producto = trimText(input.productoSolicitado, PRODUCT_MAX);
  const nota = trimText(input.nota, NOTE_MAX) || null;

  if (!sessionId) {
    return { ok: false, message: "Falta la sesión.", status: 400 };
  }
  if (producto.length < 2) {
    return { ok: false, message: "Escribe el producto que buscas.", status: 400 };
  }

  const session = await getActiveOrderSession(sessionId);
  if (!session) {
    return { ok: false, message: "La sesión no está activa. Solicita un enlace nuevo por WhatsApp.", status: 409 };
  }

  const supabase = getSupabaseAdminClient();
  const { data: chat, error: chatError } = await supabase
    .from("chats")
    .select("id, phone_number")
    .eq("id", session.chat_id)
    .maybeSingle();

  if (chatError || !chat) {
    return { ok: false, message: "No pudimos identificar tu WhatsApp.", status: 500 };
  }

  const phone = normalizePhoneNumber(String(chat.phone_number ?? ""));
  if (!phone) {
    return { ok: false, message: "No pudimos identificar tu WhatsApp.", status: 500 };
  }

  const customer = await getCustomerForChat(session.chat_id);

  const { data, error } = await supabase
    .from("product_requests")
    .insert({
      customer_id: customer?.id ?? null,
      phone_number: phone,
      producto_solicitado: producto,
      nota,
      estado: "pendiente",
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    console.error("[catalog] product request insert", error);
    return { ok: false, message: "No pudimos enviar la solicitud. Inténtalo de nuevo.", status: 500 };
  }

  return { ok: true, id: String(data.id) };
}

export async function countPendingProductRequests(): Promise<number> {
  const supabase = getSupabaseAdminClient();
  const { count, error } = await supabase
    .from("product_requests")
    .select("id", { count: "exact", head: true })
    .eq("estado", "pendiente");

  if (error) {
    throw error;
  }
  return count ?? 0;
}

export async function listProductRequests(estado: ProductRequestEstado | "todos"): Promise<ProductRequest[]> {
  const supabase = getSupabaseAdminClient();
  let query = supabase.from("product_requests").select(SELECT_FIELDS).order("created_at", { ascending: false });
  if (estado !== "todos") {
    query = query.eq("estado", estado);
  }

  const { data, error } = await query.limit(200);
  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapRequest(row as ProductRequestRow)).filter((row): row is ProductRequest => Boolean(row));
}

export async function resolveProductRequest(input: {
  id: string;
  estado: ProductRequestEstado;
  notaAdmin?: unknown;
}): Promise<{ ok: true } | { ok: false; message: string; status: number }> {
  if (!input.id) {
    return { ok: false, message: "Falta la solicitud.", status: 400 };
  }
  if (input.estado === "pendiente") {
    return { ok: false, message: "Elige Agregado o No disponible.", status: 400 };
  }

  const notaAdmin = trimText(input.notaAdmin, NOTE_MAX) || null;
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("product_requests")
    .update({
      estado: input.estado,
      nota_admin: notaAdmin,
    })
    .eq("id", input.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[admin] product request resolve", error);
    return { ok: false, message: "No pudimos actualizar la solicitud.", status: 500 };
  }
  if (!data?.id) {
    return { ok: false, message: "No encontramos esa solicitud.", status: 404 };
  }
  return { ok: true };
}
