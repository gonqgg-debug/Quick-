import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import {
  getCatalogImageStats,
  suggestNacionalImagesBatch,
  suggestOpenFoodFactsBatch,
  suggestWebImagesBatch,
} from "@/lib/product-images";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  let layer: "off" | "nacional" | "web" | "auto" = "auto";
  let limit: number | undefined;
  let productId: string | undefined;
  try {
    const body = (await request.json().catch(() => ({}))) as {
      layer?: unknown;
      limit?: unknown;
      productId?: unknown;
    };
    if (body.layer === "off" || body.layer === "nacional" || body.layer === "web" || body.layer === "auto") {
      layer = body.layer;
    }
    if (typeof body.limit === "number" && Number.isFinite(body.limit)) {
      limit = body.limit;
    }
    if (typeof body.productId === "string" && body.productId) {
      productId = body.productId;
    }
  } catch {
    layer = "auto";
  }

  try {
    if (productId) {
      const nacional = await suggestNacionalImagesBatch({ productId, limit: 1 });
      if (nacional.found > 0 || nacional.scanned === 0) {
        return NextResponse.json({ layer: "nacional", ...nacional });
      }
      try {
        const web = await suggestWebImagesBatch({ productId, limit: 1 });
        return NextResponse.json({ layer: "web", ...web });
      } catch {
        return NextResponse.json({ layer: "nacional", ...nacional });
      }
    }
    if (layer === "auto") {
      const stats = await getCatalogImageStats();
      layer = stats.awaitingNacional > 0 ? "nacional" : stats.awaitingOff > 0 ? "off" : "web";
    }
    const result =
      layer === "off"
        ? await suggestOpenFoodFactsBatch()
        : layer === "nacional"
          ? await suggestNacionalImagesBatch({ limit: limit ?? 8 })
          : await suggestWebImagesBatch({ limit: limit ?? 3 });
    return NextResponse.json({ layer, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos buscar sugerencias";
    console.error("[admin] catalog images suggest", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
