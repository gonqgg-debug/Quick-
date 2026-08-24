import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { loadAdminDashboard } from "@/lib/admin-dashboard";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const dashboard = await loadAdminDashboard();
    return NextResponse.json(dashboard);
  } catch (error) {
    console.error("[admin] dashboard", error);
    return NextResponse.json({ error: "No pudimos cargar el dashboard" }, { status: 500 });
  }
}
