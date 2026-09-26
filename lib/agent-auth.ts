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

export function requireAgentApi(request: NextRequest): NextResponse | null {
  const token = process.env.AGENT_API_TOKEN?.trim() ?? "";
  if (!token) {
    return NextResponse.json({ error: "La API del agente no está configurada" }, { status: 503 });
  }
  if (!bearerMatches(request.headers.get("authorization"), token)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return null;
}
