import { publicOrderProductUrl, publicOrderUrl } from "@/lib/app-url";
import {
  ensureActiveCatalogSession,
  getActiveProductsByIds,
  listCatalogSearchSuggestions,
} from "@/lib/catalog";
import { generateGeminiJson, getGeminiApiKey } from "@/lib/gemini";
import { formatPrice } from "@/lib/money";
import { createProductRequestFromChat } from "@/lib/product-requests";
import type { Product } from "@/lib/types";
import {
  sendChoiceMenu,
  sendInteractiveList,
  sendTextMessage,
  type WhatsAppSendResult,
} from "@/lib/whatsapp";

export const WHATSAPP_AI_INTENTS = [
  "nueva_orden",
  "ver_pedido",
  "modificar",
  "cancelar",
  "estatus",
  "ayuda_humana",
  "buscar_producto",
  "saludo",
  "otro",
] as const;

export type WhatsAppAiIntent = (typeof WHATSAPP_AI_INTENTS)[number];

export type WhatsAppAiClassification = {
  intent: WhatsAppAiIntent;
  query: string | null;
  confidence: number;
};

export const ANOTAR_PRODUCTO_PREFIX = "anotar:";
export const OPEN_PRODUCT_PREFIX = "open_";
export const MIN_AI_CONFIDENCE = 0.7;

const LIST_TITLE_MAX = 24;
const LIST_DESCRIPTION_MAX = 72;
const ANOTAR_QUERY_MAX = 180;

const CLASSIFY_SYSTEM = `Clasificas mensajes de clientes de un mini market por WhatsApp.
Responde SOLO JSON: {"intent":"<uno>","query":"<texto o null>","confidence":<0-1>}.
Intents: ${WHATSAPP_AI_INTENTS.join(", ")}.
query es el nombre de producto limpio para buscar en el catálogo (ej. "leche evaporada"), solo si intent es buscar_producto. Si no, null.
No inventes product ids. No opines sobre stock ni disponibilidad. "¿Tienen X?" es buscar_producto, no un sí/no.
ayuda_humana: quieren una persona. saludo: hola/buenas. otro: no encaja.
confidence baja si el mensaje es ambiguo.`;

function isIntent(value: unknown): value is WhatsAppAiIntent {
  return typeof value === "string" && WHATSAPP_AI_INTENTS.includes(value as WhatsAppAiIntent);
}

function clip(value: string, max: number): string {
  const text = value.trim();
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

function parseClassification(raw: string): WhatsAppAiClassification | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
    if (!isIntent(parsed.intent)) {
      return null;
    }
    const query =
      typeof parsed.query === "string" && parsed.query.trim().length >= 2 ? parsed.query.trim() : null;
    const confidence = typeof parsed.confidence === "number" ? parsed.confidence : Number(parsed.confidence);
    return {
      intent: parsed.intent,
      query: parsed.intent === "buscar_producto" ? query : null,
      confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0,
    };
  } catch {
    return null;
  }
}

export function catalogTakeoverFooter(sessionId: string, productId?: string): string {
  const url = productId ? publicOrderProductUrl(sessionId, productId) : publicOrderUrl(sessionId);
  return `Arma o paga aquí (también te registras en el enlace):\n${url}`;
}

export function parseOpenProductId(buttonId: string | null | undefined): string | null {
  const id = (buttonId ?? "").trim();
  if (!id.toLowerCase().startsWith(OPEN_PRODUCT_PREFIX)) {
    return null;
  }
  const productId = id.slice(OPEN_PRODUCT_PREFIX.length).trim();
  return productId.length > 0 ? productId : null;
}

export function encodeAnotarButtonId(query: string): string {
  const cleaned = query.trim().replace(/\s+/g, " ").slice(0, ANOTAR_QUERY_MAX);
  return `${ANOTAR_PRODUCTO_PREFIX}${encodeURIComponent(cleaned)}`.slice(0, 256);
}

export function parseAnotarQuery(buttonId: string | null | undefined): string | null {
  const id = (buttonId ?? "").trim();
  if (!id.toLowerCase().startsWith(ANOTAR_PRODUCTO_PREFIX)) {
    return null;
  }
  const encoded = id.slice(ANOTAR_PRODUCTO_PREFIX.length).trim();
  if (!encoded) {
    return null;
  }
  try {
    const query = decodeURIComponent(encoded).trim();
    return query.length >= 2 ? query.slice(0, ANOTAR_QUERY_MAX) : null;
  } catch {
    return encoded.length >= 2 ? encoded.slice(0, ANOTAR_QUERY_MAX) : null;
  }
}

export async function classifyWhatsAppIntent(input: {
  text: string;
  customerName: string | null;
  activeOrderEstado: string | null;
}): Promise<WhatsAppAiClassification | null> {
  if (!getGeminiApiKey()) {
    return null;
  }
  const text = input.text.trim();
  if (!text) {
    return null;
  }

  const context = [
    `Cliente: ${input.customerName?.trim() || "desconocido"}`,
    `Pedido activo: ${input.activeOrderEstado?.trim() || "ninguno"}`,
    `Mensaje: ${text.slice(0, 500)}`,
  ].join("\n");

  try {
    const raw = await generateGeminiJson({
      system: CLASSIFY_SYSTEM,
      user: context,
      maxOutputTokens: 80,
    });
    if (!raw) {
      return null;
    }
    return parseClassification(raw);
  } catch (error) {
    console.error("[whatsapp-ai] classify:fail", error);
    return null;
  }
}

export async function sendCatalogSearchResults(input: {
  phoneNumber: string;
  chatId: string;
  query: string;
}): Promise<void> {
  const sessionId = await ensureActiveCatalogSession(input.chatId);
  const query = input.query.trim();
  const products = query.length >= 2 ? await listCatalogSearchSuggestions(query) : [];

  if (products.length === 0) {
    await sendCatalogMissPrompt(input.phoneNumber, sessionId, query);
    return;
  }

  await sendProductMatchList(input.phoneNumber, sessionId, products, query);
}

async function sendProductMatchList(
  phoneNumber: string,
  sessionId: string,
  products: Product[],
  query: string
): Promise<WhatsAppSendResult> {
  const shown = products.slice(0, 8);
  const rows = shown.map((product) => ({
    id: `${OPEN_PRODUCT_PREFIX}${product.id}`,
    title: clip(product.nombre, LIST_TITLE_MAX),
    description: clip(
      [formatPrice(product.precio), product.marca].filter(Boolean).join(" · "),
      LIST_DESCRIPTION_MAX
    ),
  }));

  const label = query.trim().slice(0, 40);
  const preview = shown
    .slice(0, 4)
    .map((product) => `• ${product.nombre} — ${formatPrice(product.precio)}`)
    .join("\n");
  const extra = shown.length > 4 ? `\n• …y ${shown.length - 4} más en la lista` : "";

  const body = [
    `En el catálogo aparece esto para «${label}». El equipo confirma al preparar el pedido.`,
    `${preview}${extra}`,
    catalogTakeoverFooter(sessionId),
  ].join("\n\n");

  return sendInteractiveList(phoneNumber, body, rows, "Ver productos", "[ai:buscar_producto] ");
}

async function sendCatalogMissPrompt(
  phoneNumber: string,
  sessionId: string,
  query: string
): Promise<WhatsAppSendResult> {
  const body = [
    `No lo veo en el catálogo ahora para «${query.trim().slice(0, 40)}».`,
    catalogTakeoverFooter(sessionId),
  ].join("\n\n");

  return sendChoiceMenu(
    phoneNumber,
    body,
    [{ id: encodeAnotarButtonId(query), title: "Anotarlo" }],
    "[ai:buscar_producto:miss] "
  );
}

export async function sendProductDeepLink(input: {
  phoneNumber: string;
  chatId: string;
  productId: string;
}): Promise<void> {
  const sessionId = await ensureActiveCatalogSession(input.chatId);
  const [product] = await listProductsById(input.productId);
  const headline = product
    ? `${product.nombre} — ${formatPrice(product.precio)}`
    : "Ábrelo en el catálogo.";
  await sendTextMessage(
    input.phoneNumber,
    `${headline}\n\n${catalogTakeoverFooter(sessionId, input.productId)}`,
    "[ai:open_producto] "
  );
}

async function listProductsById(productId: string): Promise<Product[]> {
  return getActiveProductsByIds([productId]);
}

export async function handleAnotarProducto(input: {
  phoneNumber: string;
  chatId: string;
  query: string;
  originalText?: string | null;
}): Promise<void> {
  const sessionId = await ensureActiveCatalogSession(input.chatId);
  const notaSource = input.originalText?.trim() || input.query;
  const result = await createProductRequestFromChat({
    chatId: input.chatId,
    productoSolicitado: input.query,
    nota: `WhatsApp: ${notaSource}`.slice(0, 500),
  });

  if (!result.ok) {
    await sendTextMessage(
      input.phoneNumber,
      `No pudimos anotarlo. Inténtalo de nuevo o ábrelo aquí:\n${publicOrderUrl(sessionId)}`,
      "[ai:anotar_producto] "
    );
    return;
  }

  const thanks = result.deduped
    ? "Ya lo teníamos anotado."
    : "Lo anotamos. Si lo conseguimos, te lo armamos en el catálogo.";
  await sendTextMessage(
    input.phoneNumber,
    `${thanks}\n\n${catalogTakeoverFooter(sessionId)}`,
    "[ai:anotar_producto] "
  );
}
