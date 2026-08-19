import { NextRequest, NextResponse } from "next/server";
import { formatPrice } from "@/lib/money";
import { isStaffAuthorized, unauthorized } from "@/lib/staff-auth";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { sendImageMessage, sendTextMessage } from "@/lib/whatsapp";
import {
  isAllowedStaffImage,
  normalizeStaffImageMime,
  signedWhatsAppMediaUrl,
  STAFF_IMAGE_MAX_BYTES,
  storeOutgoingWhatsAppImage,
} from "@/lib/whatsapp-media";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const OPEN_ORDER_STATES = [
  "nueva",
  "en_proceso",
  "faltante_reportado",
  "confirmada",
  "despachada",
] as const;

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

type PostBody = {
  mensaje?: unknown;
};

type PatchBody = {
  resuelto?: unknown;
  visto?: unknown;
};

export async function GET(
  _request: NextRequest,
  { params }: { params: { chatId: string } }
) {
  if (!isStaffAuthorized()) {
    return unauthorized();
  }

  const chatId = params.chatId?.trim();
  if (!chatId) {
    return NextResponse.json({ error: "Falta el chat" }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const { data: chat, error: chatError } = await supabase
    .from("chats")
    .select("id, phone_number, nombre, esperando_humano")
    .eq("id", chatId)
    .maybeSingle();

  if (chatError) {
    console.error("[staff] no se pudo leer el chat", chatError);
    return NextResponse.json({ error: "No pudimos leer el chat" }, { status: 500 });
  }

  if (!chat) {
    return NextResponse.json({ error: "No encontramos ese chat" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("whatsapp_log")
    .select("id, chat_id, direccion, contenido, created_at, tipo_contenido, media_url")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });

  const logRows = error
    ? await supabase
        .from("whatsapp_log")
        .select("id, chat_id, direccion, contenido, created_at")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true })
    : { data, error };

  if (logRows.error) {
    console.error("[staff] no se pudo leer el historial de WhatsApp", logRows.error);
    return NextResponse.json({ error: "No pudimos leer la conversación" }, { status: 500 });
  }

  const messages = await Promise.all(
    (logRows.data ?? []).map(async (row) => ({
      id: row.id as string,
      chatId: row.chat_id as string,
      direccion: String(row.direccion),
      contenido: String(row.contenido ?? ""),
      createdAt: String(row.created_at),
      tipoContenido: String(("tipo_contenido" in row ? row.tipo_contenido : null) ?? "texto"),
      mediaUrl: await signedWhatsAppMediaUrl(
        "media_url" in row && row.media_url ? String(row.media_url) : null
      ),
    }))
  );

  const { data: orderRows, error: orderError } = await supabase
    .from("orders")
    .select(
      `
      id,
      created_at,
      estado,
      direccion,
      total_estimado,
      order_items (
        cantidad,
        products!order_items_product_id_fkey ( nombre )
      )
    `
    )
    .eq("chat_id", chatId)
    .in("estado", [...OPEN_ORDER_STATES])
    .order("created_at", { ascending: false });

  if (orderError) {
    console.error("[staff] no se pudieron leer los pedidos del chat", orderError);
  }

  const orders = (orderRows ?? []).map((order) => {
    const items = Array.isArray(order.order_items) ? order.order_items : [];
    return {
      id: order.id as string,
      createdAt: String(order.created_at),
      estado: String(order.estado),
      direccion: String(order.direccion ?? ""),
      totalLabel: formatPrice(order.total_estimado),
      items: items.map((item) => {
        const product = unwrapOne(item.products as { nombre: string } | { nombre: string }[] | null);
        return {
          cantidad: Number(item.cantidad),
          nombre: product?.nombre ? String(product.nombre) : "Producto",
        };
      }),
    };
  });

  return NextResponse.json({
    chat: {
      id: chat.id as string,
      phoneNumber: String(chat.phone_number ?? ""),
      nombre: chat.nombre ? String(chat.nombre) : null,
      esperandoHumano: Boolean(chat.esperando_humano),
    },
    orders,
    messages,
  });
}

async function loadStaffChat(chatId: string) {
  const supabase = getSupabaseAdminClient();
  const { data: chat, error: chatError } = await supabase
    .from("chats")
    .select("id, phone_number")
    .eq("id", chatId)
    .maybeSingle();

  if (chatError) {
    console.error("[staff] no se pudo leer el chat para responder", chatError);
    return { ok: false as const, response: NextResponse.json({ error: "No pudimos leer el chat" }, { status: 500 }) };
  }

  if (!chat?.phone_number) {
    return { ok: false as const, response: NextResponse.json({ error: "No encontramos ese chat" }, { status: 404 }) };
  }

  return { ok: true as const, chat };
}

async function clearPendingFlag(chatId: string) {
  const supabase = getSupabaseAdminClient();
  await supabase.from("chats").update({ mensaje_pendiente: false }).eq("id", chatId);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { chatId: string } }
) {
  if (!isStaffAuthorized()) {
    return unauthorized();
  }

  const chatId = params.chatId?.trim();
  if (!chatId) {
    return NextResponse.json({ error: "Falta el chat" }, { status: 400 });
  }

  const loaded = await loadStaffChat(chatId);
  if (!loaded.ok) {
    return loaded.response;
  }
  const phoneNumber = String(loaded.chat.phone_number);
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("imagen");
    const captionValue = form.get("mensaje");
    const caption = typeof captionValue === "string" ? captionValue.trim() : "";

    if (!file || typeof file === "string" || typeof file.arrayBuffer !== "function" || file.size === 0) {
      return NextResponse.json({ error: "Falta la imagen" }, { status: 400 });
    }

    const rawType = "type" in file && typeof file.type === "string" ? file.type : "";
    const mimeType = normalizeStaffImageMime(rawType || "image/jpeg");
    if (!isAllowedStaffImage(mimeType)) {
      return NextResponse.json(
        { error: "Usa una foto JPG o PNG (máximo 5 MB)." },
        { status: 400 }
      );
    }
    if (file.size > STAFF_IMAGE_MAX_BYTES) {
      return NextResponse.json({ error: "La foto no puede superar 5 MB." }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const filename =
      "name" in file && typeof file.name === "string" && file.name.trim()
        ? file.name.trim()
        : `foto.${mimeType === "image/png" ? "png" : "jpg"}`;

    let storagePath: string;
    try {
      storagePath = await storeOutgoingWhatsAppImage(chatId, bytes, mimeType, filename);
    } catch (error) {
      console.error("[staff] no se pudo guardar la imagen de staff", error);
      return NextResponse.json(
        { error: "No pudimos guardar la imagen. Intenta de nuevo." },
        { status: 500 }
      );
    }

    try {
      await sendImageMessage(phoneNumber, {
        bytes,
        mimeType,
        filename,
        caption,
        storagePath,
      });
      await clearPendingFlag(chatId);
    } catch (error) {
      console.error("[staff] no se pudo enviar la imagen de WhatsApp", error);
      const message =
        error instanceof Error ? error.message : "No pudimos enviar la foto al cliente. Intenta de nuevo.";
      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const mensaje = typeof body.mensaje === "string" ? body.mensaje.trim() : "";
  if (!mensaje) {
    return NextResponse.json({ error: "El mensaje no puede estar vacío" }, { status: 400 });
  }

  try {
    await sendTextMessage(phoneNumber, mensaje);
    await clearPendingFlag(chatId);
  } catch (error) {
    console.error("[staff] no se pudo enviar el mensaje de WhatsApp", error);
    return NextResponse.json({ error: "No pudimos enviar el mensaje" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { chatId: string } }
) {
  if (!isStaffAuthorized()) {
    return unauthorized();
  }

  const chatId = params.chatId?.trim();
  if (!chatId) {
    return NextResponse.json({ error: "Falta el chat" }, { status: 400 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const markSeen = body.visto === true;
  const markResolved = body.resuelto === true;
  if (!markSeen && !markResolved) {
    return NextResponse.json({ error: "Debes enviar { visto: true } o { resuelto: true }" }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const patch: { mensaje_pendiente?: boolean; esperando_humano?: boolean } = {};
  if (markSeen || markResolved) {
    patch.mensaje_pendiente = false;
  }
  if (markResolved) {
    patch.esperando_humano = false;
  }

  const { data, error } = await supabase
    .from("chats")
    .update(patch)
    .eq("id", chatId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[staff] no se pudo resolver el chat", error);
    return NextResponse.json({ error: "No pudimos marcar el chat como resuelto" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "No encontramos ese chat" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
