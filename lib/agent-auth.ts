import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { rolPorTokenHash } from "@/lib/miles-store";

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

export function bearerMatches(header: string | null, token: string): boolean {
  const expected = `Bearer ${token}`;
  const received = header?.trim() ?? "";
  return timingSafeEqual(digest(received), digest(expected));
}

export const AGENT_ROLES = ["lectura", "rodrigo", "phillip", "boris", "fred", "hans", "matt", "troy", "robert", "miles"] as const;

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
  miles: "AGENT_TOKEN_MILES",
};

export function agentApiConfigurada(): boolean {
  if (process.env.AGENT_API_TOKEN?.trim()) {
    return true;
  }
  return Object.values(ROLE_ENV).some((key) => Boolean(process.env[key]?.trim()));
}

export async function agentRolFromRequest(request: NextRequest): Promise<AgentRol | null> {
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
  const received = header?.trim() ?? "";
  if (!received.toLowerCase().startsWith("bearer ")) {
    return null;
  }
  const token = received.slice(7).trim();
  if (!token) {
    return null;
  }
  try {
    return await rolPorTokenHash(token);
  } catch {
    return null;
  }
}

export async function requireAgentApi(request: NextRequest): Promise<NextResponse | null> {
  if (!agentApiConfigurada()) {
    const miles = await agentRolFromRequest(request);
    if (miles !== "miles") {
      return NextResponse.json({ error: "La API del agente no está configurada" }, { status: 503 });
    }
  }
  if (!(await agentRolFromRequest(request))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return null;
}

export async function requireAgentRol(request: NextRequest, allowed: readonly AgentRol[]): Promise<AgentRol | NextResponse> {
  const rol = await agentRolFromRequest(request);
  if (!rol) {
    if (!agentApiConfigurada()) {
      return NextResponse.json({ error: "La API del agente no está configurada" }, { status: 503 });
    }
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!allowed.includes(rol)) {
    return NextResponse.json({ error: "Este acceso no puede escribir esa parte" }, { status: 403 });
  }
  return rol;
}
