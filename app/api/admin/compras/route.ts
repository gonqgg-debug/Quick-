import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { createCompra, listCompras, parsePagadoParam } from "@/lib/admin-compras";
import { isDayKey } from "@/lib/local-day";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const params = request.nextUrl.searchParams;
  const proveedorId = params.get("proveedorId")?.trim() || null;
  const fromRaw = params.get("from")?.trim() ?? "";
  const toRaw = params.get("to")?.trim() ?? "";

  try {
    const result = await listCompras({
      pagado: parsePagadoParam(params.get("pagado")),
      proveedorId,
      from: isDayKey(fromRaw) ? fromRaw : null,
      to: isDayKey(toRaw) ? toRaw : null,
      page: Math.max(1, Number(params.get("page") ?? "1") || 1),
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[admin] compras list", error);
    return NextResponse.json({ error: "No pudimos cargar las compras" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  let body: {
    proveedorId?: unknown;
    proveedorNombre?: unknown;
    monto?: unknown;
    fecha?: unknown;
    dueDate?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "El cuerpo no es un JSON válido." }, { status: 400 });
  }

  try {
    const compra = await createCompra(body);
    return NextResponse.json({ compra }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos registrar la compra";
    console.error("[admin] compras create", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
