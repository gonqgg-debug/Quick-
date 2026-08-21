import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { localDayKey } from "@/lib/local-day";
import { buildXlsx } from "@/lib/simple-xlsx";
import {
  catalogExportRows,
  fetchAdminCatalogProductsForExport,
  parseCatalogProductFilters,
} from "@/lib/admin-catalog-products";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const HEADERS = ["Foto", "Nombre", "Marca", "Categoría", "Precio", "Cód. Odoo", "Barras", "Estado"];

async function idsFromRequest(request: NextRequest): Promise<string[] | undefined> {
  if (request.method !== "POST") {
    return undefined;
  }
  const body = (await request.json().catch(() => null)) as { ids?: unknown } | null;
  if (!Array.isArray(body?.ids)) {
    return undefined;
  }
  return body.ids.filter((id): id is string => typeof id === "string" && Boolean(id));
}

async function exportWorkbook(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const filters = parseCatalogProductFilters(request.nextUrl.searchParams);
    const ids = await idsFromRequest(request);
    const products = await fetchAdminCatalogProductsForExport(filters, ids);
    if (products.length === 0) {
      return NextResponse.json({ error: "No hay productos para exportar" }, { status: 400 });
    }
    const buffer = buildXlsx(HEADERS, catalogExportRows(products), "Productos");
    const filename = `catalogo-productos-${localDayKey(new Date().toISOString())}.xlsx`;
    return new NextResponse(Uint8Array.from(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("[admin] catalog products export", error);
    return NextResponse.json({ error: "No pudimos exportar el catálogo" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return exportWorkbook(request);
}

export async function POST(request: NextRequest) {
  return exportWorkbook(request);
}
