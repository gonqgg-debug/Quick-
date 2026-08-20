const ANTHROPIC_VERSION = "2023-06-01";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-5";
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

type DownloadedImage = {
  index: number;
  url: string;
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  data: string;
};

type PickResult = {
  url: string | null;
  reason: string;
};

export async function pickBestProductImage(options: {
  nombre: string;
  marca: string | null;
  urls: string[];
}): Promise<PickResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Falta ANTHROPIC_API_KEY");
  }
  const images = (
    await Promise.all(options.urls.map((url, index) => downloadAsBase64(url, index + 1)))
  ).filter((image): image is DownloadedImage => image !== null);
  if (images.length === 0) {
    return { url: null, reason: "No se pudieron descargar las candidatas" };
  }

  const content: Array<Record<string, unknown>> = images.flatMap((image) => [
    { type: "text", text: `Candidata ${image.index}:` },
    {
      type: "image",
      source: { type: "base64", media_type: image.mediaType, data: image.data },
    },
  ]);
  content.push({
    type: "text",
    text: `Producto a ilustrar: ${[options.marca, options.nombre].filter(Boolean).join(" — ")}.
Elige como máximo UNA candidata. Criterios: foto de producto profesional, fondo blanco o liso, buena iluminación, sin watermark ni texto promocional grande, y que coincida con ese producto. Si ninguna cumple bien, no elijas.
Responde SOLO JSON: {"choice": <número de candidata o null>, "reason": "<una frase>"}.`,
  });

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 300,
      messages: [{ role: "user", content }],
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    throw new Error(`Anthropic respondió ${response.status}`);
  }
  const body = (await response.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const text = body.content?.find((block) => block.type === "text")?.text ?? "";
  const parsed = parseChoice(text);
  if (parsed.choice == null) {
    return { url: null, reason: parsed.reason };
  }
  const chosen = images.find((image) => image.index === parsed.choice);
  if (!chosen) {
    return { url: null, reason: parsed.reason || "La IA eligió un índice inválido" };
  }
  return { url: chosen.url, reason: parsed.reason };
}

async function downloadAsBase64(url: string, index: number): Promise<DownloadedImage | null> {
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "image/*",
        "User-Agent": "QuickMiniMarket/1.0 (quickminimarkets@gmail.com)",
      },
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      return null;
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength < 1024 || bytes.byteLength > MAX_IMAGE_BYTES) {
      return null;
    }
    const mime = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const mediaType = sniffMediaType(bytes, mime);
    if (!mediaType) {
      return null;
    }
    return { index, url, mediaType, data: bytes.toString("base64") };
  } catch {
    return null;
  }
}

function sniffMediaType(bytes: Buffer, mime: string): DownloadedImage["mediaType"] | null {
  const fromHeader = normalizeMediaType(mime);
  if (fromHeader) {
    return fromHeader;
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    return "image/jpeg";
  }
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return "image/gif";
  }
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  return null;
}

function normalizeMediaType(mime: string): DownloadedImage["mediaType"] | null {
  if (mime === "image/jpg" || mime === "image/jpeg") {
    return "image/jpeg";
  }
  if (mime === "image/png" || mime === "image/gif" || mime === "image/webp") {
    return mime;
  }
  return null;
}

function parseChoice(raw: string): { choice: number | null; reason: string } {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { choice: null, reason: "La IA no devolvió JSON" };
  }
  try {
    const parsed = JSON.parse(jsonMatch[0]) as { choice?: unknown; reason?: unknown };
    const rawChoice = parsed.choice;
    const asNumber =
      typeof rawChoice === "number"
        ? rawChoice
        : typeof rawChoice === "string" && /^\d+$/.test(rawChoice)
          ? Number(rawChoice)
          : null;
    const choice = asNumber != null && Number.isInteger(asNumber) ? asNumber : null;
    const reason = typeof parsed.reason === "string" ? parsed.reason : "";
    return { choice, reason };
  } catch {
    return { choice: null, reason: "No se pudo leer la respuesta de la IA" };
  }
}
