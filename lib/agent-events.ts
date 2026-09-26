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
] as const;

export type AgentEventType = (typeof AGENT_EVENT_TYPES)[number];

const TIMEOUT_MS = 5000;
const MIN_SECRET_LENGTH = 16;

export function signAgentPayload(secret: string, timestamp: number, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export function agentSignatureHeader(secret: string, timestamp: number, body: string): string {
  return `t=${timestamp},v1=${signAgentPayload(secret, timestamp, body)}`;
}

function mesFromRecurso(recurso: Record<string, unknown>): string | null {
  const raw = typeof recurso.fecha === "string" ? recurso.fecha : typeof recurso.mes === "string" ? recurso.mes : "";
  const match = /^(\d{4}-\d{2})/.exec(raw);
  return match ? match[1] : null;
}

function webhookTarget(): { url: string; secret: string } | null {
  const rawUrl = process.env.AGENT_WEBHOOK_URL?.trim() ?? "";
  const secret = process.env.AGENT_WEBHOOK_SECRET?.trim() ?? "";
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
  return { url: url.toString(), secret };
}

/** Notifies the configured agent URL. Failures never break the admin save. */
export async function publishAgentEvent(tipo: AgentEventType, recurso: Record<string, unknown>): Promise<void> {
  const target = webhookTarget();
  if (!target) {
    return;
  }
  const body = JSON.stringify({
    version: 1,
    id: randomUUID(),
    tipo,
    ocurridoEn: new Date().toISOString(),
    mes: mesFromRecurso(recurso),
    recurso,
  });
  const timestamp = Math.floor(Date.now() / 1000);
  try {
    const response = await fetch(target.url, {
      method: "POST",
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Quick-Agent-Webhook",
        "X-Quick-Signature": agentSignatureHeader(target.secret, timestamp, body),
      },
      body,
    });
    if (response.status < 200 || response.status >= 300) {
      console.error("[agent] webhook respondió", response.status, tipo);
    }
  } catch (error) {
    console.error("[agent] no se pudo entregar", tipo, error);
  }
}
