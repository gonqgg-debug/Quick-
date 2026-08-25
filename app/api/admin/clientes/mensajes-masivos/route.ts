import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import {
  parseBroadcastMessage,
  parseMassMessageFilter,
  previewMarketingAudience,
  sendMarketingBroadcast,
} from "@/lib/admin-mensajes-masivos";
import type { MassMessageProgressEvent } from "@/lib/admin-mensajes-masivos-shared";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function filterFromSearchParams(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  return parseMassMessageFilter({
    ultimoPedidoDesde: params.get("ultimoPedidoDesde") ?? "",
    ultimoPedidoHasta: params.get("ultimoPedidoHasta") ?? "",
  });
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const parsed = filterFromSearchParams(request);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.message }, { status: 400 });
  }

  try {
    const preview = await previewMarketingAudience(parsed.filter);
    return NextResponse.json(preview);
  } catch (error) {
    console.error("[admin] mensajes masivos preview", error);
    return NextResponse.json({ error: "No pudimos calcular la audiencia" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  let body: {
    confirmar?: unknown;
    mensaje?: unknown;
    ultimoPedidoDesde?: unknown;
    ultimoPedidoHasta?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "El cuerpo no es un JSON válido." }, { status: 400 });
  }

  if (body.confirmar !== true) {
    return NextResponse.json({ error: "Confirma el envío antes de mandar el mensaje." }, { status: 400 });
  }

  const parsedFilter = parseMassMessageFilter(body);
  if (!parsedFilter.ok) {
    return NextResponse.json({ error: parsedFilter.message }, { status: 400 });
  }

  const parsedMessage = parseBroadcastMessage(body.mensaje);
  if (!parsedMessage.ok) {
    return NextResponse.json({ error: parsedMessage.message }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: MassMessageProgressEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      try {
        await sendMarketingBroadcast(parsedFilter.filter, parsedMessage.message, emit);
      } catch (error) {
        console.error("[admin] mensajes masivos send", error);
        emit({
          type: "error",
          error: error instanceof Error ? error.message : "No pudimos enviar los mensajes",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
