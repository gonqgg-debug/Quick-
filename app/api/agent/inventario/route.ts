import { NextRequest, NextResponse } from "next/server";
import { requireAgentApi } from "@/lib/agent-auth";
import { inventarioError } from "@/lib/inventario/http";
import { listarExistencias } from "@/lib/inventario/movimientos";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const denied = requireAgentApi(request);
  if (denied) {
    return denied;
  }
  try {
    const params = request.nextUrl.searchParams;
    const page = await listarExistencias({
      tienda: params.get("tienda") ?? "quick",
      q: params.get("q") ?? "",
      bajoMinimo: params.get("bajoMinimo") === "true" || params.get("bajoMinimo") === "1",
      cursor: params.get("cursor") ?? "",
    });
    return NextResponse.json(page);
  } catch (error) {
    return inventarioError(error, "No pudimos leer el inventario", "[agent] inventario");
  }
}
