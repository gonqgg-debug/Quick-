import { NextRequest, NextResponse } from "next/server";
import { fetchHistoryPage, parseHistoryFilters } from "@/lib/staff-history";
import { isStaffAuthorized, unauthorized } from "@/lib/staff-auth";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isStaffAuthorized()) {
    return unauthorized();
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
    console.error("[staff] no se pudo leer el historial", error);
    return NextResponse.json({ error: "No pudimos leer el historial" }, { status: 500 });
  }
}
