import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { compraFailure, createCompra, listCompras, parsePagadoParam } from "@/lib/contabilidad/compras";
import { readCompraBody } from "@/lib/contabilidad/compra-request";
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

  try {
    const compra = await createCompra(await readCompraBody(request));
    return NextResponse.json({ compra }, { status: 201 });
  } catch (error) {
    console.error("[admin] compras create", error);
    const failure = compraFailure(error, "No pudimos registrar la compra");
    return NextResponse.json({ error: failure.error, compra: failure.compra }, { status: failure.status });
  }
}
