import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { getCatalogImageStats, listCatalogImageQueue } from "@/lib/product-images";

export const dynamic = "force-dynamic";

const DEFAULT_PAGE_SIZE = 48;

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const pageSize = Math.min(
    Math.max(Number(request.nextUrl.searchParams.get("pageSize") ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE, 1),
    100
  );
  const requestedPage = Math.max(Number(request.nextUrl.searchParams.get("page") ?? 1) || 1, 1);
  const letterParam = request.nextUrl.searchParams.get("letter")?.trim().toUpperCase() ?? "";
  const letter = letterParam === "#" || /^[A-Z]$/.test(letterParam) ? letterParam : null;

  try {
    const [stats, firstPage] = await Promise.all([
      getCatalogImageStats(),
      listCatalogImageQueue({
        limit: pageSize,
        offset: (requestedPage - 1) * pageSize,
        letter,
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(firstPage.total / pageSize));
    const page = Math.min(requestedPage, totalPages);
    const queue =
      page === requestedPage
        ? firstPage
        : await listCatalogImageQueue({
            limit: pageSize,
            offset: (page - 1) * pageSize,
            letter,
          });

    return NextResponse.json({
      stats,
      queue: queue.items,
      total: queue.total,
      page,
      pageSize,
      totalPages,
      letter,
    });
  } catch (error) {
    console.error("[admin] catalog images list", error);
    return NextResponse.json({ error: "No pudimos cargar las imágenes" }, { status: 500 });
  }
}
