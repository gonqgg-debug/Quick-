import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { rejectSuggestedImage } from "@/lib/product-images";

export const dynamic = "force-dynamic";

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
    await rejectSuggestedImage(suggestionId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin] catalog images reject", error);
    return NextResponse.json({ error: "No pudimos descartar la sugerencia" }, { status: 400 });
  }
}
