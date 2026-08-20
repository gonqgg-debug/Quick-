import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { PRODUCT_PHOTO_MAX_BYTES, uploadProductPhoto } from "@/lib/product-images";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const ALLOWED = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const form = await request.formData();
  const productId = String(form.get("productId") ?? "");
  const file = form.get("file");
  if (!productId || !(file instanceof File)) {
    return NextResponse.json({ error: "Falta el producto o el archivo" }, { status: 400 });
  }
  if (file.size > PRODUCT_PHOTO_MAX_BYTES) {
    return NextResponse.json({ error: "La imagen pesa más de 5 MB" }, { status: 400 });
  }
  const mimeType = file.type === "image/jpg" ? "image/jpeg" : file.type;
  if (!ALLOWED.has(mimeType)) {
    return NextResponse.json({ error: "Usa JPG, PNG o WebP" }, { status: 400 });
  }

  try {
    await uploadProductPhoto(productId, new Uint8Array(await file.arrayBuffer()), mimeType);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin] catalog images upload", error);
    return NextResponse.json({ error: "No pudimos subir la imagen" }, { status: 400 });
  }
}
