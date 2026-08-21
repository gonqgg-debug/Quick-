import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { applyRemoteProductPhoto } from "@/lib/product-images";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  try {
    const body = (await request.json()) as { productId?: unknown; imageUrl?: unknown };
    const productId = typeof body.productId === "string" ? body.productId : "";
    const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl : "";
    const fotoUrl = await applyRemoteProductPhoto(productId, imageUrl);
    return NextResponse.json({ ok: true, fotoUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos usar esa foto";
    console.error("[admin] catalog images apply", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
