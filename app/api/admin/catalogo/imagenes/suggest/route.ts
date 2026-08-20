import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { suggestOpenFoodFactsBatch } from "@/lib/product-images";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const result = await suggestOpenFoodFactsBatch();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[admin] catalog images suggest", error);
    return NextResponse.json({ error: "No pudimos consultar Open Food Facts" }, { status: 500 });
  }
}
