import { getSupabaseAdminClient } from "@/lib/supabase";

const GRAPH_API_VERSION = "v20.0";
const GRAPH_API_BASE = "https://graph.facebook.com";
export const WHATSAPP_MEDIA_BUCKET = "whatsapp-media";
const MAX_MEDIA_BYTES = 16 * 1024 * 1024;

export type WhatsAppMediaKind = "imagen" | "video" | "documento";

export type IncomingWhatsAppMedia = {
  kind: WhatsAppMediaKind;
  id: string;
  mimeType: string;
  caption: string;
  filename: string | null;
};

let bucketReady: Promise<void> | null = null;

function getWhatsAppAccessToken(): string {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) {
    throw new Error("Falta la variable de entorno WHATSAPP_ACCESS_TOKEN");
  }
  return token;
}

function getWhatsAppPhoneNumberId(): string {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!phoneNumberId) {
    throw new Error("Falta la variable de entorno WHATSAPP_PHONE_NUMBER_ID");
  }
  return phoneNumberId;
}

export const STAFF_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const STAFF_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png"];

export function normalizeStaffImageMime(mimeType: string): string {
  if (mimeType === "image/jpg") {
    return "image/jpeg";
  }
  return mimeType;
}

export function isAllowedStaffImage(mimeType: string): boolean {
  return STAFF_IMAGE_TYPES.includes(mimeType) || mimeType === "image/jpeg";
}

function extensionFor(mimeType: string, filename: string | null): string {
  if (filename && filename.includes(".")) {
    const ext = filename.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
    if (ext) {
      return ext.slice(0, 8);
    }
  }
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/3gpp": "3gp",
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  };
  return map[mimeType] || "bin";
}

async function ensureBucket(): Promise<void> {
  if (!bucketReady) {
    bucketReady = (async () => {
      const supabase = getSupabaseAdminClient();
      const { data } = await supabase.storage.listBuckets();
      if (data?.some((bucket) => bucket.id === WHATSAPP_MEDIA_BUCKET)) {
        return;
      }
      const { error } = await supabase.storage.createBucket(WHATSAPP_MEDIA_BUCKET, {
        public: false,
        fileSizeLimit: MAX_MEDIA_BYTES,
      });
      if (error && !/already exists/i.test(error.message)) {
        console.error("[whatsapp] no se pudo crear el bucket de media", error);
      }
    })();
  }
  await bucketReady;
}

async function downloadWhatsAppMedia(mediaId: string): Promise<{ bytes: Uint8Array; mimeType: string } | null> {
  const token = getWhatsAppAccessToken();
  const metaResponse = await fetch(`${GRAPH_API_BASE}/${GRAPH_API_VERSION}/${encodeURIComponent(mediaId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const meta = (await metaResponse.json().catch(() => null)) as { url?: unknown; mime_type?: unknown } | null;
  const sourceUrl = typeof meta?.url === "string" ? meta.url : "";
  if (!metaResponse.ok || !sourceUrl) {
    console.error("[whatsapp] no se pudo leer metadata de media", { status: metaResponse.status });
    return null;
  }

  const fileResponse = await fetch(sourceUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!fileResponse.ok) {
    console.error("[whatsapp] no se pudo descargar media", { status: fileResponse.status });
    return null;
  }

  const mimeType =
    (typeof meta?.mime_type === "string" && meta.mime_type) ||
    fileResponse.headers.get("content-type") ||
    "application/octet-stream";
  const bytes = new Uint8Array(await fileResponse.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_MEDIA_BYTES) {
    console.error("[whatsapp] media vacía o demasiado grande", { bytes: bytes.byteLength });
    return null;
  }
  return { bytes, mimeType };
}

export async function storeIncomingWhatsAppMedia(
  chatId: string,
  media: IncomingWhatsAppMedia
): Promise<string | null> {
  const downloaded = await downloadWhatsAppMedia(media.id);
  if (!downloaded) {
    return null;
  }

  await ensureBucket();
  const day = new Date().toISOString().slice(0, 10);
  const ext = extensionFor(downloaded.mimeType || media.mimeType, media.filename);
  const path = `${chatId}/${day}/${media.id}.${ext}`;
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.storage.from(WHATSAPP_MEDIA_BUCKET).upload(path, downloaded.bytes, {
    contentType: downloaded.mimeType || media.mimeType,
    upsert: false,
  });

  if (error && !/already exists|duplicate/i.test(error.message)) {
    console.error("[whatsapp] no se pudo subir media a storage", error);
    return null;
  }

  return path;
}

export async function storeOutgoingWhatsAppImage(
  chatId: string,
  bytes: Uint8Array,
  mimeType: string,
  filename: string | null
): Promise<string> {
  await ensureBucket();
  const day = new Date().toISOString().slice(0, 10);
  const ext = extensionFor(mimeType, filename);
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const path = `${chatId}/${day}/staff-${unique}.${ext}`;
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.storage.from(WHATSAPP_MEDIA_BUCKET).upload(path, bytes, {
    contentType: mimeType,
    upsert: false,
  });
  if (error) {
    console.error("[whatsapp] no se pudo subir imagen de staff a storage", error);
    throw new Error("No pudimos guardar la imagen");
  }
  return path;
}

export async function uploadMediaToWhatsApp(
  bytes: Uint8Array,
  mimeType: string,
  filename: string
): Promise<string> {
  const token = getWhatsAppAccessToken();
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", mimeType);
  const blob = new Blob([Buffer.from(bytes)], { type: mimeType });
  form.append("file", blob, filename);

  const response = await fetch(
    `${GRAPH_API_BASE}/${GRAPH_API_VERSION}/${getWhatsAppPhoneNumberId()}/media`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }
  );
  const data = (await response.json().catch(() => null)) as { id?: unknown; error?: { message?: unknown } } | null;
  const graphMessage = data?.error?.message;
  const mediaId = typeof data?.id === "string" ? data.id : "";
  if (!response.ok || !mediaId) {
    const message = typeof graphMessage === "string" ? graphMessage : "No pudimos subir la imagen a WhatsApp";
    console.error("[whatsapp] upload:media:fail", { status: response.status, error: message });
    throw new Error(message);
  }
  return mediaId;
}

export async function signedWhatsAppMediaUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) {
    return null;
  }
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(WHATSAPP_MEDIA_BUCKET).createSignedUrl(path, 60 * 60);
  if (error || !data?.signedUrl) {
    console.error("[whatsapp] no se pudo firmar URL de media", error);
    return null;
  }
  return data.signedUrl;
}

export function mediaPlaceholder(kind: WhatsAppMediaKind, filename: string | null): string {
  if (kind === "imagen") {
    return "Imagen";
  }
  if (kind === "video") {
    return "Video";
  }
  return filename ? `Documento: ${filename}` : "Documento";
}

export function mediaAckMessage(kind: WhatsAppMediaKind): string {
  if (kind === "imagen") {
    return "Recibí tu imagen, ¿en qué te ayudamos?";
  }
  if (kind === "video") {
    return "Recibí tu video, ¿en qué te ayudamos?";
  }
  return "Recibí tu archivo, ¿en qué te ayudamos?";
}
