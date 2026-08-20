import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-auth";
import { IMPORT_MAX_BYTES, buildImportPreview, fetchImportProducts } from "@/lib/catalog-import";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function readImportFile(request: NextRequest): Promise<{ buffer: Buffer; fileName: string } | NextResponse> {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Sube un archivo .xlsx o .csv" }, { status: 400 });
  }
  if (file.size > IMPORT_MAX_BYTES) {
    return NextResponse.json({ error: "El archivo pesa más de 4 MB" }, { status: 400 });
  }
  const fileName = file.name || "catalogo.xlsx";
  const buffer = Buffer.from(await file.arrayBuffer());
  return { buffer, fileName };
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const uploaded = await readImportFile(request);
  if (uploaded instanceof NextResponse) {
    return uploaded;
  }

  try {
    const supabase = getSupabaseAdminClient();
    const existing = await fetchImportProducts(supabase);
    const preview = buildImportPreview(uploaded.buffer, uploaded.fileName, existing);
    return NextResponse.json(preview);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos leer el archivo";
    console.error("[admin] preview import", error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
