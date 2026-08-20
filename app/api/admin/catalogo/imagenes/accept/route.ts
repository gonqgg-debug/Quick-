import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { acceptSuggestedImage } from "@/lib/product-images";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  let suggestionId = "";
  try {
    const body = (await request.json()) as { suggestionId?: unknown };
    suggestionId = typeof body.suggestionId === "string" ? body.suggestionId : "";
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!suggestionId) {
    return NextResponse.json({ error: "Falta la sugerencia" }, { status: 400 });
  }

  try {
    await acceptSuggestedImage(suggestionId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos guardar la foto";
    console.error("[admin] catalog images accept", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
