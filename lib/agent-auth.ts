import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

export function bearerMatches(header: string | null, token: string): boolean {
  const expected = `Bearer ${token}`;
  const received = header?.trim() ?? "";
  return timingSafeEqual(digest(received), digest(expected));
}

export const AGENT_ROLES = ["lectura", "rodrigo", "phillip", "boris", "fred", "hans", "matt", "troy", "robert"] as const;

export type AgentRol = (typeof AGENT_ROLES)[number];

const ROLE_ENV: Record<Exclude<AgentRol, "lectura">, string> = {
  rodrigo: "AGENT_TOKEN_RODRIGO",
  phillip: "AGENT_TOKEN_PHILLIP",
  boris: "AGENT_TOKEN_BORIS",
  fred: "AGENT_TOKEN_FRED",
  hans: "AGENT_TOKEN_HANS",
  matt: "AGENT_TOKEN_MATT",
  troy: "AGENT_TOKEN_TROY",
  robert: "AGENT_TOKEN_ROBERT",
};

export function agentApiConfigurada(): boolean {
  if (process.env.AGENT_API_TOKEN?.trim()) {
    return true;
  }
  return Object.values(ROLE_ENV).some((key) => Boolean(process.env[key]?.trim()));
}

export function agentRolFromRequest(request: NextRequest): AgentRol | null {
  const header = request.headers.get("authorization");
  const pairs: Array<[AgentRol, string]> = [];
  for (const [rol, envName] of Object.entries(ROLE_ENV) as Array<[Exclude<AgentRol, "lectura">, string]>) {
    const token = process.env[envName]?.trim();
    if (token) {
      pairs.push([rol, token]);
    }
  }
  const lectura = process.env.AGENT_API_TOKEN?.trim();
  if (lectura) {
    pairs.push(["lectura", lectura]);
  }
  for (const [rol, token] of pairs) {
    if (bearerMatches(header, token)) {
      return rol;
    }
  }
  return null;
}

export function requireAgentApi(request: NextRequest): NextResponse | null {
  if (!agentApiConfigurada()) {
    return NextResponse.json({ error: "La API del agente no está configurada" }, { status: 503 });
  }
  if (!agentRolFromRequest(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return null;
}

export function requireAgentRol(request: NextRequest, allowed: readonly AgentRol[]): AgentRol | NextResponse {
  const denied = requireAgentApi(request);
  if (denied) {
    return denied;
  }
  const rol = agentRolFromRequest(request);
  if (!rol || !allowed.includes(rol)) {
    return NextResponse.json({ error: "Este acceso no puede escribir esa parte" }, { status: 403 });
  }
  return rol;
}
