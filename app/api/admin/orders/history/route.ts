import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { fetchHistoryPage, parseHistoryFilters } from "@/lib/staff-history";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const filters = parseHistoryFilters(request.nextUrl.searchParams);

  try {
    const supabase = getSupabaseAdminClient();
    const { orders, total } = await fetchHistoryPage(supabase, filters);
    return NextResponse.json({
      orders,
      total,
      page: filters.page,
      pageSize: filters.pageSize,
    });
  } catch (error) {
    console.error("[admin] no se pudo leer el historial", error);
    return NextResponse.json({ error: "No pudimos leer el historial" }, { status: 500 });
  }
}
