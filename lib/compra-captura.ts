import { randomUUID } from "node:crypto";
import { capturaFilename, extensionForCaptura, mimeForCapturaPath, type CapturaMime } from "@/lib/compra-fiscal";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const COMPRAS_CAPTURA_BUCKET = "compras-capturas";

export type CompraCapturaFile = {
  bytes: Uint8Array;
  mime: CapturaMime;
};

let bucketReady: Promise<void> | null = null;

async function ensureBucket(): Promise<void> {
  if (!bucketReady) {
    bucketReady = (async () => {
      const supabase = getSupabaseAdminClient();
      const { data } = await supabase.storage.listBuckets();
      if (data?.some((bucket) => bucket.id === COMPRAS_CAPTURA_BUCKET)) {
        return;
      }
      const { error } = await supabase.storage.createBucket(COMPRAS_CAPTURA_BUCKET, {
        public: false,
        fileSizeLimit: 4 * 1024 * 1024,
      });
      if (error && !/already exists/i.test(error.message)) {
        console.error("[compras] no se pudo crear el bucket de capturas", error);
        throw new Error("No pudimos guardar la captura de la factura");
      }
    })();
  }
  try {
    await bucketReady;
  } catch (error) {
    bucketReady = null;
    throw error;
  }
}

export async function storeCompraCaptura(file: CompraCapturaFile): Promise<string> {
  await ensureBucket();
  const path = `facturas/${randomUUID()}.${extensionForCaptura(file.mime)}`;
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.storage.from(COMPRAS_CAPTURA_BUCKET).upload(path, file.bytes, {
    contentType: file.mime,
    upsert: false,
  });
  if (error) {
    console.error("[compras] no se pudo subir la captura", error);
    throw new Error("No pudimos guardar la captura de la factura");
  }
  return path;
}

export async function removeCompraCaptura(path: string | null): Promise<void> {
  if (!path) {
    return;
  }
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.storage.from(COMPRAS_CAPTURA_BUCKET).remove([path]);
  if (error) {
    console.error("[compras] no se pudo borrar la captura", error);
  }
}

const COMPRA_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function loadCompraCaptura(id: string): Promise<{ bytes: Uint8Array; mime: CapturaMime; filename: string } | null> {
  if (!COMPRA_ID.test(id)) {
    return null;
  }
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("compras").select("ncf, captura_path").eq("id", id).maybeSingle();
  if (error) {
    throw error;
  }
  const path = typeof data?.captura_path === "string" ? data.captura_path : "";
  const mime = mimeForCapturaPath(path);
  if (!path || !mime) {
    return null;
  }
  const bytes = await downloadCompraCaptura(path);
  if (!bytes) {
    return null;
  }
  const ncf = typeof data?.ncf === "string" ? data.ncf : null;
  return { bytes, mime, filename: capturaFilename(ncf, mime) };
}

export async function downloadCompraCaptura(path: string): Promise<Uint8Array | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(COMPRAS_CAPTURA_BUCKET).download(path);
  if (error || !data) {
    console.error("[compras] no se pudo leer la captura", error);
    return null;
  }
  return new Uint8Array(await data.arrayBuffer());
}
