import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import {
  IMPORT_MAX_BYTES,
  applyImportPreview,
  buildImportPreview,
  fetchImportProducts,
} from "@/lib/catalog-import";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Sube un archivo .xlsx o .csv" }, { status: 400 });
  }
  if (file.size > IMPORT_MAX_BYTES) {
    return NextResponse.json({ error: "El archivo pesa más de 4 MB" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdminClient();
    const existing = await fetchImportProducts(supabase);
    const preview = buildImportPreview(Buffer.from(await file.arrayBuffer()), file.name || "catalogo.xlsx", existing);
    if (preview.created.length === 0 && preview.updated.length === 0) {
      return NextResponse.json({
        created: 0,
        updated: 0,
        unchanged: preview.unchanged.length,
        missing: preview.missing,
        totals: preview.totals,
      });
    }
    const result = await applyImportPreview(supabase, preview);
    return NextResponse.json({
      ...result,
      missing: preview.missing,
      totals: preview.totals,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos importar el catálogo";
    console.error("[admin] confirm import", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
