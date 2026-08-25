import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { listAdminClientes } from "@/lib/admin-clientes";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const clientes = await listAdminClientes();
    return NextResponse.json({ clientes });
  } catch (error) {
    console.error("[admin] clientes list", error);
    return NextResponse.json({ error: "No pudimos cargar los clientes" }, { status: 500 });
  }
}
