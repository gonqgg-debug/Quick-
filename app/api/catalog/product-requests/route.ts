import { NextRequest } from "next/server";
import { jsonError } from "@/lib/order-request";
import { createProductRequestFromSession } from "@/lib/product-requests";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: { sessionId?: unknown; productoSolicitado?: unknown; nota?: unknown };
  try {
    body = (await request.json()) as { sessionId?: unknown; productoSolicitado?: unknown; nota?: unknown };
  } catch {
    return jsonError("El cuerpo de la solicitud no es un JSON válido.", 400);
  }

  const result = await createProductRequestFromSession({
    sessionId: body.sessionId,
    productoSolicitado: body.productoSolicitado,
    nota: body.nota,
  });

  if (!result.ok) {
    return jsonError(result.message, result.status);
  }

  return Response.json({ success: true, id: result.id });
}
