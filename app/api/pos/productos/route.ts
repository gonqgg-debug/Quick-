import { NextResponse } from "next/server";
import { listPosProducts } from "@/lib/pos-server";
import { isStaffAuthorized, unauthorized } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isStaffAuthorized()) {
    return unauthorized();
  }
  try {
    const products = await listPosProducts();
    return NextResponse.json({ products });
  } catch (error) {
    console.error("[pos] no se pudo leer el catálogo", error);
    return NextResponse.json({ error: "No pudimos cargar el catálogo" }, { status: 500 });
  }
}
