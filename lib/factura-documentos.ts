import { createHash, randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { extensionForCaptura, decodeCapturaBase64, parseCapturaBytes, type CapturaMime } from "@/lib/compra-fiscal";
import { isUuid } from "@/lib/facturas-shared";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const FACTURAS_BUCKET = "facturas-phillip";

export type DocumentoEntrada = {
  nombre: string | null;
  pagina: number | null;
  bytes: Uint8Array;
  mime: CapturaMime;
  sha256: string;
};

const FILE_FIELDS = ["foto", "fotos", "documento", "documentos", "captura", "capturas"] as const;

let bucketReady: Promise<void> | null = null;

function mensajeFoto(message: string): string {
  return message.replace(/captura/gi, "foto");
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function paginaDe(value: unknown): number | null {
  if (value == null || value === "") {
    return null;
  }
  const numero = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isInteger(numero) || numero < 1 || numero > 200) {
    throw new Error("La página de la foto tiene que ser un entero desde 1");
  }
  return numero;
}

function nombreDe(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const text = value.trim().slice(0, 180);
  return text || null;
}

function desdeBytes(bytes: Uint8Array, nombre: string | null, pagina: number | null): DocumentoEntrada {
  const parsed = parseCapturaBytes(bytes);
  if (!parsed.ok) {
    throw new Error(mensajeFoto(parsed.message));
  }
  return { nombre, pagina, bytes, mime: parsed.mime, sha256: sha256(bytes) };
}

function desdeTexto(value: string, nombre: string | null, pagina: number | null): DocumentoEntrada {
  const bytes = decodeCapturaBase64(value);
  if (!bytes) {
    throw new Error("La foto no se pudo leer");
  }
  return desdeBytes(bytes, nombre, pagina);
}

function textoCampo(raw: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return "";
}

export function documentosDesdeValor(value: unknown): DocumentoEntrada[] {
  if (value == null || value === "") {
    return [];
  }
  const list = Array.isArray(value) ? value : [value];
  const docs: DocumentoEntrada[] = [];
  for (const item of list) {
    if (typeof item === "string") {
      if (item.trim()) {
        docs.push(desdeTexto(item, null, null));
      }
      continue;
    }
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error("Cada foto tiene que traer el archivo");
    }
    const raw = item as Record<string, unknown>;
    const encoded = textoCampo(raw, ["base64", "data", "fotoBase64", "capturaBase64", "contenido"]);
    if (!encoded) {
      continue;
    }
    docs.push(desdeTexto(encoded, nombreDe(raw.nombre ?? raw.filename), paginaDe(raw.pagina ?? raw.page)));
  }
  return docs;
}

export function documentosDesdeCuerpo(body: Record<string, unknown>): DocumentoEntrada[] {
  const docs = [
    ...documentosDesdeValor(body.documentos),
    ...documentosDesdeValor(body.documento),
    ...documentosDesdeValor(body.fotoBase64),
    ...documentosDesdeValor(body.capturaBase64),
    ...documentosDesdeValor(body.foto),
  ];
  const seen = new Set<string>();
  return docs.filter((doc) => {
    if (seen.has(doc.sha256)) {
      return false;
    }
    seen.add(doc.sha256);
    return true;
  });
}

async function archivosDeFormulario(form: FormData): Promise<DocumentoEntrada[]> {
  const docs: DocumentoEntrada[] = [];
  let pagina = 1;
  for (const field of FILE_FIELDS) {
    for (const entry of form.getAll(field)) {
      if (!(entry instanceof File) || entry.size <= 0) {
        continue;
      }
      docs.push(desdeBytes(new Uint8Array(await entry.arrayBuffer()), entry.name || null, pagina));
      pagina += 1;
    }
  }
  return docs;
}

function cuerpoDesdeFormulario(form: FormData): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  const jsonKeys = new Set(["lineas", "productos", "validaciones", "preguntas", "documentos"]);
  for (const [key, value] of Array.from(form.entries())) {
    if (typeof value !== "string") {
      continue;
    }
    if (jsonKeys.has(key)) {
      try {
        body[key] = JSON.parse(value);
      } catch {
        throw new Error(`El campo ${key} tiene que ser JSON`);
      }
      continue;
    }
    body[key] = value;
  }
  return body;
}

export async function leerPeticionFactura(request: NextRequest): Promise<{ body: Record<string, unknown>; documentos: DocumentoEntrada[] }> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new Error("El formulario no es válido");
    }
    const body = cuerpoDesdeFormulario(form);
    const archivos = await archivosDeFormulario(form);
    if (archivos.length === 1 && form.get("pagina") != null && String(form.get("pagina") ?? "").trim()) {
      archivos[0] = { ...archivos[0], pagina: paginaDe(form.get("pagina")) };
    }
    return { body, documentos: unicos([...archivos, ...documentosDesdeCuerpo(body)]) };
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new Error("El cuerpo no es un JSON válido");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("El cuerpo tiene que ser un objeto JSON");
  }
  const record = body as Record<string, unknown>;
  return { body: record, documentos: documentosDesdeCuerpo(record) };
}

function unicos(docs: DocumentoEntrada[]): DocumentoEntrada[] {
  const seen = new Set<string>();
  return docs.filter((doc) => {
    if (seen.has(doc.sha256)) {
      return false;
    }
    seen.add(doc.sha256);
    return true;
  });
}

async function ensureBucket(): Promise<void> {
  if (!bucketReady) {
    bucketReady = (async () => {
      const supabase = getSupabaseAdminClient();
      const { data } = await supabase.storage.listBuckets();
      if (data?.some((bucket) => bucket.id === FACTURAS_BUCKET)) {
        return;
      }
      const { error } = await supabase.storage.createBucket(FACTURAS_BUCKET, {
        public: false,
        fileSizeLimit: 4 * 1024 * 1024,
      });
      if (error && !/already exists/i.test(error.message)) {
        console.error("[facturas] no se pudo crear el bucket", error);
        throw new Error("No pudimos guardar la foto");
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

export async function borrarArchivos(paths: string[]): Promise<void> {
  if (!paths.length) {
    return;
  }
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.storage.from(FACTURAS_BUCKET).remove(paths);
  if (error) {
    console.error("[facturas] no se pudieron borrar fotos temporales", error);
  }
}

export async function guardarDocumentos(facturaId: string, docs: DocumentoEntrada[]): Promise<number> {
  if (!docs.length) {
    return 0;
  }
  await ensureBucket();
  const supabase = getSupabaseAdminClient();
  let agregados = 0;
  for (const doc of docs) {
    const path = `${facturaId}/${randomUUID()}.${extensionForCaptura(doc.mime)}`;
    const { error: uploadError } = await supabase.storage.from(FACTURAS_BUCKET).upload(path, doc.bytes, {
      contentType: doc.mime,
      upsert: false,
    });
    if (uploadError) {
      console.error("[facturas] no se pudo subir la foto", uploadError);
      throw new Error("No pudimos guardar la foto");
    }
    const { error } = await supabase.from("factura_documentos").insert({
      factura_id: facturaId,
      storage_path: path,
      mime: doc.mime,
      nombre: doc.nombre,
      pagina: doc.pagina,
      sha256: doc.sha256,
    });
    if (error) {
      await borrarArchivos([path]);
      if (error.code === "23505") {
        continue;
      }
      throw error;
    }
    agregados += 1;
  }
  return agregados;
}

export function nombreDescarga(nombre: string | null, mime: CapturaMime, pagina: number | null): string {
  const ext = extensionForCaptura(mime);
  const base = (nombre ?? (pagina ? `pagina-${pagina}` : "factura")).replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  if (!base) {
    return `factura.${ext}`;
  }
  return base.toLowerCase().endsWith(`.${ext}`) ? base : `${base}.${ext}`;
}

export async function abrirDocumento(
  facturaId: string,
  documentoId: string
): Promise<{ bytes: Uint8Array; mime: CapturaMime; filename: string } | null> {
  if (!isUuid(facturaId) || !isUuid(documentoId)) {
    return null;
  }
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("factura_documentos")
    .select("storage_path, mime, nombre, pagina")
    .eq("id", documentoId)
    .eq("factura_id", facturaId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  const path = typeof data?.storage_path === "string" ? data.storage_path : "";
  const mime = data?.mime === "image/jpeg" || data?.mime === "image/png" || data?.mime === "image/webp" || data?.mime === "application/pdf" ? data.mime : null;
  if (!path || !mime) {
    return null;
  }
  const { data: file, error: downloadError } = await supabase.storage.from(FACTURAS_BUCKET).download(path);
  if (downloadError || !file) {
    console.error("[facturas] no se pudo leer la foto", downloadError);
    return null;
  }
  const pagina = typeof data?.pagina === "number" ? data.pagina : null;
  return {
    bytes: new Uint8Array(await file.arrayBuffer()),
    mime,
    filename: nombreDescarga(typeof data?.nombre === "string" ? data.nombre : null, mime, pagina),
  };
}
