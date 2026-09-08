const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-2.5-flash-lite";
const DEFAULT_TIMEOUT_MS = 4000;

export function getGeminiApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  return key || null;
}

export function getGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
}

export async function generateGeminiJson(options: {
  system: string;
  user: string;
  maxOutputTokens?: number;
  timeoutMs?: number;
}): Promise<string | null> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return null;
  }

  const model = getGeminiModel();
  const generationConfig: Record<string, unknown> = {
    temperature: 0,
    maxOutputTokens: options.maxOutputTokens ?? 80,
    responseMimeType: "application/json",
    thinkingConfig: { thinkingBudget: 0 },
  };

  const response = await postGemini(apiKey, model, options, generationConfig);
  if (response.ok) {
    return readGeminiText(response.body);
  }

  if (response.status === 400 && "thinkingConfig" in generationConfig) {
    delete generationConfig.thinkingConfig;
    const retry = await postGemini(apiKey, model, options, generationConfig);
    if (retry.ok) {
      return readGeminiText(retry.body);
    }
    throw new Error(`Gemini respondió ${retry.status}${retry.detail ? `: ${retry.detail}` : ""}`);
  }

  throw new Error(`Gemini respondió ${response.status}${response.detail ? `: ${response.detail}` : ""}`);
}

async function postGemini(
  apiKey: string,
  model: string,
  options: { system: string; user: string; timeoutMs?: number },
  generationConfig: Record<string, unknown>
): Promise<{ ok: true; body: unknown } | { ok: false; status: number; detail: string }> {
  const response = await fetch(`${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: options.system }] },
      contents: [{ role: "user", parts: [{ text: options.user }] }],
      generationConfig,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  });

  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 180);
    return { ok: false, status: response.status, detail };
  }

  return { ok: true, body: await response.json() };
}

function readGeminiText(body: unknown): string | null {
  const record =
    body && typeof body === "object"
      ? (body as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })
      : null;
  const text = record?.candidates?.[0]?.content?.parts?.find((part) => part.text)?.text ?? "";
  return text.trim() || null;
}
