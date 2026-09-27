import type { NextRequest } from "next/server";
import type { CompraCapturaFile } from "@/lib/compra-captura";
import { CAPTURA_MAX_BYTES, decodeCapturaBase64, parseCapturaBytes } from "@/lib/compra-fiscal";

export type CompraRequestBody = {
  proveedorId?: unknown;
  proveedorNombre?: unknown;
  monto?: unknown;
  fecha?: unknown;
  dueDate?: unknown;
  pagado?: unknown;
  pagadoEn?: unknown;
  rnc?: unknown;
  ncf?: unknown;
  captura?: CompraCapturaFile;
};

function coercePagado(value: unknown): boolean {
  if (value === true || value === "true") {
    return true;
  }
  if (value === false || value === "false") {
    return false;
  }
  throw new Error("El estado de pago no es válido");
}

function capturaFromBytes(bytes: Uint8Array): CompraCapturaFile {
  const parsed = parseCapturaBytes(bytes);
  if (!parsed.ok) {
    throw new Error(parsed.message);
  }
  return { bytes, mime: parsed.mime };
}

function capturaFromEncoded(value: string): CompraCapturaFile {
  const bytes = decodeCapturaBase64(value);
  if (!bytes) {
    throw new Error("La captura no se pudo leer");
  }
  return capturaFromBytes(bytes);
}

async function readMultipart(request: NextRequest): Promise<CompraRequestBody> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new Error("El formulario no es válido");
  }
  const body: CompraRequestBody = {};
  const text = (key: "proveedorId" | "proveedorNombre" | "monto" | "fecha" | "dueDate" | "pagadoEn" | "rnc" | "ncf") => {
    const value = form.get(key);
    if (typeof value === "string") {
      body[key] = value;
    }
  };
  text("proveedorId");
  text("proveedorNombre");
  text("monto");
  text("fecha");
  text("dueDate");
  text("pagadoEn");
  text("rnc");
  text("ncf");
  if (form.has("pagado")) {
    body.pagado = coercePagado(form.get("pagado"));
  }
  const file = form.get("captura");
  if (file instanceof File && file.size > 0) {
    if (file.size > CAPTURA_MAX_BYTES) {
      throw new Error("La captura no puede pasar de 4 MB");
    }
    body.captura = capturaFromBytes(new Uint8Array(await file.arrayBuffer()));
  }
  return body;
}

export async function readCompraBody(request: NextRequest): Promise<CompraRequestBody> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    return readMultipart(request);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    throw new Error("El cuerpo no es un JSON válido.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("El cuerpo no es un JSON válido.");
  }

  const encoded =
    typeof body.capturaBase64 === "string"
      ? body.capturaBase64
      : typeof body.captura === "string"
        ? body.captura
        : "";
  const requestBody: CompraRequestBody = {};
  const copy = (key: "proveedorId" | "proveedorNombre" | "monto" | "fecha" | "dueDate" | "pagadoEn" | "rnc" | "ncf") => {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      requestBody[key] = body[key];
    }
  };
  copy("proveedorId");
  copy("proveedorNombre");
  copy("monto");
  copy("fecha");
  copy("dueDate");
  copy("pagadoEn");
  copy("rnc");
  copy("ncf");
  if (Object.prototype.hasOwnProperty.call(body, "pagado")) {
    requestBody.pagado = coercePagado(body.pagado);
  }
  if (encoded.trim()) {
    requestBody.captura = capturaFromEncoded(encoded);
  }
  return requestBody;
}
