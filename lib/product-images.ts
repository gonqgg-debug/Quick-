import { getSupabaseAdminClient } from "@/lib/supabase";
import { normalizeBarcode } from "@/lib/barcode";
import { fetchOpenFoodFactsImage } from "@/lib/open-food-facts";
import { pickBestProductImage } from "@/lib/anthropic-product-image";
import { buildProductImageQuery, searchSerperProductImages } from "@/lib/serper-images";
import type { CatalogImageQueueItem, CatalogImageStats } from "@/lib/product-images-shared";

export type { CatalogImageQueueItem, CatalogImageStats } from "@/lib/product-images-shared";

export const PRODUCT_PHOTOS_BUCKET = "product-photos";
export const PRODUCT_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
const SUGGEST_BATCH = 12;
const WEB_BATCH = 3;
const OFF_GAP_MS = 350;
const WEB_GAP_MS = 800;

let bucketReady: Promise<void> | null = null;

async function ensureProductPhotosBucket(): Promise<void> {
  if (!bucketReady) {
    bucketReady = (async () => {
      const supabase = getSupabaseAdminClient();
      const { data } = await supabase.storage.listBuckets();
      if (data?.some((bucket) => bucket.id === PRODUCT_PHOTOS_BUCKET)) {
        return;
      }
      const { error } = await supabase.storage.createBucket(PRODUCT_PHOTOS_BUCKET, {
        public: true,
        fileSizeLimit: PRODUCT_PHOTO_MAX_BYTES,
      });
      if (error && !/already exists/i.test(error.message)) {
        throw error;
      }
    })();
  }
  await bucketReady;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getCatalogImageStats(): Promise<CatalogImageStats> {
  const supabase = getSupabaseAdminClient();
  const { data: pendingRows } = await supabase
    .from("product_image_suggestions")
    .select("product_id")
    .eq("status", "pending");
  const pendingIds = (pendingRows ?? []).map((row) => String(row.product_id));

  const [
    { count: total },
    { count: confirmed },
    { count: withBarcode },
    { count: pendingReview },
    { count: awaitingOff },
    { count: withoutBarcode },
  ] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("foto_confirmada", true),
    supabase.from("products").select("id", { count: "exact", head: true }).not("codigo_barras", "is", null),
    supabase.from("product_image_suggestions").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("foto_confirmada", false)
      .not("codigo_barras", "is", null)
      .is("off_consultado_en", null),
    supabase.from("products").select("id", { count: "exact", head: true }).is("codigo_barras", null),
  ]);

  let awaitingWebQuery = supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("foto_confirmada", false)
    .is("web_consultado_en", null)
    .or("codigo_barras.is.null,off_consultado_en.not.is.null");
  if (pendingIds.length > 0) {
    awaitingWebQuery = awaitingWebQuery.not("id", "in", `(${pendingIds.join(",")})`);
  }
  const { count: awaitingWeb } = await awaitingWebQuery;

  return {
    total: total ?? 0,
    confirmed: confirmed ?? 0,
    withBarcode: withBarcode ?? 0,
    pendingReview: pendingReview ?? 0,
    awaitingOff: awaitingOff ?? 0,
    awaitingWeb: awaitingWeb ?? 0,
    withoutBarcode: withoutBarcode ?? 0,
  };
}

export async function listCatalogImageQueue(limit = 40): Promise<CatalogImageQueueItem[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, nombre, marca, categoria, codigo_barras, foto_url, product_image_suggestions(id, image_url, source, status, created_at)"
    )
    .eq("foto_confirmada", false)
    .order("nombre", { ascending: true })
    .limit(limit);
  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => {
    const suggestions = Array.isArray(row.product_image_suggestions) ? row.product_image_suggestions : [];
    const pending = suggestions.find((item) => item.status === "pending") ?? null;
    return {
      id: String(row.id),
      nombre: String(row.nombre),
      marca: row.marca ? String(row.marca) : null,
      categoria: String(row.categoria ?? ""),
      codigoBarras: row.codigo_barras ? String(row.codigo_barras) : null,
      fotoUrl: row.foto_url ? String(row.foto_url) : null,
      suggestion: pending
        ? {
            id: String(pending.id),
            imageUrl: String(pending.image_url),
            source: pending.source as "open_food_facts" | "web" | "upload",
          }
        : null,
    };
  });
}

export type ImageSuggestDetail = {
  nombre: string;
  found: boolean;
  reason: string;
};

export type ImageSuggestResult = {
  scanned: number;
  found: number;
  missed: number;
  remaining: number;
  details?: ImageSuggestDetail[];
};

export async function suggestOpenFoodFactsBatch(): Promise<ImageSuggestResult> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, codigo_barras")
    .eq("foto_confirmada", false)
    .not("codigo_barras", "is", null)
    .is("off_consultado_en", null)
    .order("nombre", { ascending: true })
    .limit(SUGGEST_BATCH);
  if (error) {
    throw error;
  }

  const products = data ?? [];
  let found = 0;
  let missed = 0;

  for (const product of products) {
    const barcode = normalizeBarcode(String(product.codigo_barras ?? ""));
    const now = new Date().toISOString();
    if (!barcode) {
      missed += 1;
      await supabase.from("products").update({ off_consultado_en: now }).eq("id", product.id);
      continue;
    }

    try {
      const match = await fetchOpenFoodFactsImage(barcode);
      if (match) {
        const { error: insertError } = await supabase.from("product_image_suggestions").insert({
          product_id: product.id,
          source: "open_food_facts",
          image_url: match.imageUrl,
          status: "pending",
        });
        if (insertError && !/duplicate|unique/i.test(insertError.message)) {
          throw insertError;
        }
        found += 1;
      } else {
        missed += 1;
      }
    } catch (offError) {
      console.error("[admin] Open Food Facts", offError);
      missed += 1;
    }

    await supabase.from("products").update({ off_consultado_en: now }).eq("id", product.id);
    await sleep(OFF_GAP_MS);
  }

  const { count: remaining } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("foto_confirmada", false)
    .not("codigo_barras", "is", null)
    .is("off_consultado_en", null);

  return {
    scanned: products.length,
    found,
    missed,
    remaining: remaining ?? 0,
  };
}

type WebProduct = {
  id: string;
  nombre: string;
  marca: string | null;
  categoria: string;
};

export async function suggestWebImagesBatch(options?: {
  limit?: number;
  productId?: string;
}): Promise<ImageSuggestResult> {
  if (!process.env.SERPER_API_KEY?.trim()) {
    throw new Error("Falta SERPER_API_KEY");
  }
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    throw new Error("Falta ANTHROPIC_API_KEY");
  }

  const supabase = getSupabaseAdminClient();
  const limit = Math.min(Math.max(options?.limit ?? WEB_BATCH, 1), 8);
  const products = options?.productId
    ? await fetchWebProductById(options.productId)
    : await fetchWebCandidates(limit);

  let found = 0;
  let missed = 0;
  const details: ImageSuggestDetail[] = [];

  for (const product of products) {
    const now = new Date().toISOString();
    try {
      const query = buildProductImageQuery(product.nombre, product.marca, product.categoria);
      const candidates = await searchSerperProductImages(query, 5);
      const picked =
        candidates.length > 0
          ? await pickBestProductImage({
              nombre: product.nombre,
              marca: product.marca,
              urls: candidates.map((item) => item.url),
            })
          : { url: null, reason: "Serper no devolvió imágenes" };
      if (picked.url) {
        await supabase
          .from("product_image_suggestions")
          .update({ status: "rejected" })
          .eq("product_id", product.id)
          .eq("status", "pending");
        const { error: insertError } = await supabase.from("product_image_suggestions").insert({
          product_id: product.id,
          source: "web",
          image_url: picked.url,
          status: "pending",
        });
        if (insertError && !/duplicate|unique/i.test(insertError.message)) {
          throw insertError;
        }
        found += 1;
        details.push({ nombre: product.nombre, found: true, reason: picked.reason || query });
      } else {
        missed += 1;
        details.push({ nombre: product.nombre, found: false, reason: picked.reason || query });
      }
    } catch (webError) {
      console.error("[admin] web image search", product.id, webError);
      missed += 1;
      details.push({
        nombre: product.nombre,
        found: false,
        reason: webError instanceof Error ? webError.message : "Error de red o timeout",
      });
    }
    await supabase.from("products").update({ web_consultado_en: now }).eq("id", product.id);
    await sleep(WEB_GAP_MS);
  }

  const stats = await getCatalogImageStats();
  return {
    scanned: products.length,
    found,
    missed,
    remaining: stats.awaitingWeb,
    details,
  };
}

async function fetchWebProductById(productId: string): Promise<WebProduct[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, nombre, marca, categoria")
    .eq("id", productId)
    .eq("foto_confirmada", false)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data ? [data as WebProduct] : [];
}

async function fetchWebCandidates(limit: number): Promise<WebProduct[]> {
  const supabase = getSupabaseAdminClient();
  const { data: pendingRows } = await supabase
    .from("product_image_suggestions")
    .select("product_id")
    .eq("status", "pending");
  const pendingIds = (pendingRows ?? []).map((row) => String(row.product_id));

  let query = supabase
    .from("products")
    .select("id, nombre, marca, categoria")
    .eq("foto_confirmada", false)
    .is("web_consultado_en", null)
    .or("codigo_barras.is.null,off_consultado_en.not.is.null")
    .order("nombre", { ascending: true })
    .limit(limit);
  if (pendingIds.length > 0) {
    query = query.not("id", "in", `(${pendingIds.join(",")})`);
  }
  const { data, error } = await query;
  if (error) {
    throw error;
  }
  return ((data ?? []) as WebProduct[]).slice(0, limit);
}

export async function acceptSuggestedImage(suggestionId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { data: suggestion, error } = await supabase
    .from("product_image_suggestions")
    .select("id, product_id, image_url, status")
    .eq("id", suggestionId)
    .maybeSingle();
  if (error || !suggestion || suggestion.status !== "pending") {
    throw new Error("No hay una sugerencia pendiente");
  }

  const publicUrl = await storeRemoteImage(String(suggestion.product_id), String(suggestion.image_url));
  const { error: updateError } = await supabase
    .from("products")
    .update({ foto_url: publicUrl, foto_confirmada: true })
    .eq("id", suggestion.product_id);
  if (updateError) {
    throw updateError;
  }
  await supabase.from("product_image_suggestions").update({ status: "accepted" }).eq("id", suggestionId);
  await supabase
    .from("product_image_suggestions")
    .update({ status: "rejected" })
    .eq("product_id", suggestion.product_id)
    .eq("status", "pending");
}

export async function rejectSuggestedImage(suggestionId: string): Promise<{ productId: string }> {
  const supabase = getSupabaseAdminClient();
  const { data: suggestion, error: readError } = await supabase
    .from("product_image_suggestions")
    .select("id, product_id")
    .eq("id", suggestionId)
    .eq("status", "pending")
    .maybeSingle();
  if (readError || !suggestion) {
    throw new Error("No hay una sugerencia pendiente");
  }
  const { error } = await supabase
    .from("product_image_suggestions")
    .update({ status: "rejected" })
    .eq("id", suggestionId)
    .eq("status", "pending");
  if (error) {
    throw error;
  }
  await supabase.from("products").update({ web_consultado_en: null }).eq("id", suggestion.product_id);
  return { productId: String(suggestion.product_id) };
}

export async function searchCatalogImageCandidates(query: string): Promise<Array<{ url: string; title: string }>> {
  const q = query.trim().slice(0, 180);
  if (q.length < 2) {
    throw new Error("Escribe un término de búsqueda");
  }
  const results = await searchSerperProductImages(q, 5);
  return results.map((item) => ({ url: item.url, title: item.title }));
}

export async function applyRemoteProductPhoto(productId: string, imageUrl: string): Promise<string> {
  if (!productId || !/^https?:\/\//i.test(imageUrl.trim())) {
    throw new Error("Falta el producto o la URL");
  }
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("products").select("id").eq("id", productId).maybeSingle();
  if (error || !data) {
    throw new Error("No encontramos el producto");
  }
  const publicUrl = await storeRemoteImage(productId, imageUrl.trim());
  const { error: updateError } = await supabase
    .from("products")
    .update({ foto_url: publicUrl, foto_confirmada: true })
    .eq("id", productId);
  if (updateError) {
    throw updateError;
  }
  await supabase
    .from("product_image_suggestions")
    .update({ status: "rejected" })
    .eq("product_id", productId)
    .eq("status", "pending");
  return publicUrl;
}

export async function uploadProductPhoto(productId: string, bytes: Uint8Array, mimeType: string): Promise<string> {
  const publicUrl = await storeBytes(productId, bytes, mimeType);
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("products")
    .update({ foto_url: publicUrl, foto_confirmada: true })
    .eq("id", productId);
  if (error) {
    throw error;
  }
  await supabase
    .from("product_image_suggestions")
    .update({ status: "rejected" })
    .eq("product_id", productId)
    .eq("status", "pending");
  return publicUrl;
}

async function storeRemoteImage(productId: string, imageUrl: string): Promise<string> {
  const response = await fetch(imageUrl, {
    headers: { Accept: "image/*", "User-Agent": "QuickMiniMarket/1.0 (quickminimarkets@gmail.com)" },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("No pudimos descargar la imagen sugerida");
  }
  const mimeType = response.headers.get("content-type") || "image/jpeg";
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > PRODUCT_PHOTO_MAX_BYTES) {
    throw new Error("La imagen está vacía o pesa demasiado");
  }
  return storeBytes(productId, bytes, mimeType);
}

async function storeBytes(productId: string, bytes: Uint8Array, mimeType: string): Promise<string> {
  await ensureProductPhotosBucket();
  const ext = mimeType.includes("png") ? "png" : mimeType.includes("webp") ? "webp" : "jpg";
  const path = `${productId}/${Date.now()}.${ext}`;
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.storage.from(PRODUCT_PHOTOS_BUCKET).upload(path, bytes, {
    contentType: mimeType.startsWith("image/") ? mimeType : "image/jpeg",
    upsert: true,
  });
  if (error) {
    throw error;
  }
  const { data } = supabase.storage.from(PRODUCT_PHOTOS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
