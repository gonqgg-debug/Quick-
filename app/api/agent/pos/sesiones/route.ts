import { NextRequest, NextResponse } from "next/server";
import { requireAgentApi, requireAgentRol } from "@/lib/agent-auth";
import { isDayKey } from "@/lib/local-day";
import { parseLimit, parsePosIngestBody } from "@/lib/pos-domain";
import { respuestaPos } from "@/lib/pos-http";
import { ingestarPosSesion, listarSesionesCargadas } from "@/lib/pos-ingesta";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = requireAgentApi(request);
  if (denied) {
    return denied;
  }
  const desde = request.nextUrl.searchParams.get("desde");
  if (desde && !isDayKey(desde)) {
    return NextResponse.json({ error: "desde no es una fecha válida" }, { status: 422 });
  }
  const cursorRaw = request.nextUrl.searchParams.get("cursor");
  const cursor = cursorRaw && Number.isInteger(Number(cursorRaw)) ? Number(cursorRaw) : null;
  try {
    const body = await listarSesionesCargadas({
      desde,
      cursor,
      limit: parseLimit(request.nextUrl.searchParams.get("limit")),
    });
    return NextResponse.json(body);
  } catch (error) {
    return respuestaPos(error, "[agent] pos sesiones list");
  }
}

export async function POST(request: NextRequest) {
  const rol = requireAgentRol(request, ["rodrigo"]);
  if (rol instanceof NextResponse) {
    return rol;
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "El cuerpo no es un JSON válido." }, { status: 400 });
  }
  const parsed = parsePosIngestBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }
  try {
    const resultado = await ingestarPosSesion(parsed.payload);
    return NextResponse.json(resultado);
  } catch (error) {
    return respuestaPos(error, "[agent] pos sesiones ingest");
  }
}
