import { createHmac, randomUUID } from "node:crypto";

export const AGENT_EVENT_TYPES = [
  "venta.guardada",
  "compra.creada",
  "compra.actualizada",
  "proveedor.creado",
  "proveedor.actualizado",
  "turno.creado",
  "turno.actualizado",
  "ledger.creado",
  "ledger.actualizado",
  "ledger.eliminado",
  "producto.actualizado",
  "productos.actualizados",
  "catalogo.importado",
  "meta.guardada",
  "parametros.actualizados",
  "factura.recordatorio",
  "factura.descartada",
  "linea.confirmada",
] as const;

export type AgentEventType = (typeof AGENT_EVENT_TYPES)[number];

const TIMEOUT_MS = 5000;
const MIN_SECRET_LENGTH = 16;

export function signAgentPayload(secret: string, timestamp: number, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export const AGENT_SIGNATURE_HEADER = "X-Quick-Signature";

export function agentSignatureHeader(secret: string, timestamp: number, body: string): string {
  return `t=${timestamp},v1=${signAgentPayload(secret, timestamp, body)}`;
}

export function agentWebhookRequest(input: {
  url: string;
  secret: string;
  bearer: string;
  tipo: AgentEventType;
  recurso: Record<string, unknown>;
  id: string;
  ocurridoEn: string;
  timestamp: number;
}): { url: string; body: string; headers: Record<string, string> } {
  const body = JSON.stringify({
    version: 1,
    id: input.id,
    tipo: input.tipo,
    ocurridoEn: input.ocurridoEn,
    mes: mesFromRecurso(input.recurso),
    recurso: input.recurso,
  });
  const firma = agentSignatureHeader(input.secret, input.timestamp, body);
  if (!firma.startsWith("t=") || !firma.includes(",v1=")) {
    throw new Error("La firma del webhook no se armó");
  }
  return {
    url: input.url,
    body,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.bearer}`,
      "User-Agent": "Quick-Agent-Webhook",
      [AGENT_SIGNATURE_HEADER]: firma,
    },
  };
}

function mesFromRecurso(recurso: Record<string, unknown>): string | null {
  const raw = typeof recurso.fecha === "string" ? recurso.fecha : typeof recurso.mes === "string" ? recurso.mes : "";
  const match = /^(\d{4}-\d{2})/.exec(raw);
  return match ? match[1] : null;
}

function webhookTarget(): { url: string; secret: string; bearer: string } | null {
  const rawUrl = process.env.AGENT_WEBHOOK_URL?.trim() ?? "";
  const secret = process.env.AGENT_WEBHOOK_SECRET?.trim() ?? "";
  const bearer = process.env.AGENT_WEBHOOK_KEY?.trim() ?? "";
  if (!rawUrl) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    console.error("[agent] AGENT_WEBHOOK_URL no es una URL válida");
    return null;
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  const allowed = url.protocol === "https:" || (process.env.NODE_ENV !== "production" && url.protocol === "http:" && local);
  if (!allowed) {
    console.error("[agent] AGENT_WEBHOOK_URL tiene que ser https");
    return null;
  }
  if (secret.length < MIN_SECRET_LENGTH) {
    console.error("[agent] AGENT_WEBHOOK_SECRET falta o es demasiado corta; no se envió el evento");
    return null;
  }
  if (!bearer) {
    console.error("[agent] AGENT_WEBHOOK_KEY falta; no se envió el evento");
    return null;
  }
  return { url: url.toString(), secret, bearer };
}

/** Notifies the configured agent URL. Failures never break the admin save. */
export async function publishAgentEvent(tipo: AgentEventType, recurso: Record<string, unknown>): Promise<void> {
  const target = webhookTarget();
  if (!target) {
    return;
  }
  const preparado = agentWebhookRequest({
    url: target.url,
    secret: target.secret,
    bearer: target.bearer,
    tipo,
    recurso,
    id: randomUUID(),
    ocurridoEn: new Date().toISOString(),
    timestamp: Math.floor(Date.now() / 1000),
  });
  if (!preparado.headers[AGENT_SIGNATURE_HEADER]) {
    console.error("[agent] el webhook no trae X-Quick-Signature; no se envió", tipo);
    return;
  }
  try {
    const response = await fetch(preparado.url, {
      method: "POST",
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: preparado.headers,
      body: preparado.body,
    });
    if (response.status < 200 || response.status >= 300) {
      console.error("[agent] webhook respondió", response.status, tipo);
    }
  } catch (error) {
    console.error("[agent] no se pudo entregar", tipo, error);
  }
}
