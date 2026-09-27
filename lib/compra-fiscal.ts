export const CAPTURA_MAX_BYTES = 4 * 1024 * 1024;

export const COMPRA_NCF_DUPLICADO = "Ya existe una factura con ese NCF para ese RNC";

export type CapturaMime = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

const MIME_EXTENSION: Record<CapturaMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export function parseRnc(value: unknown): { ok: true; rnc: string } | { ok: false; message: string } {
  if (typeof value === "number") {
    return { ok: false, message: "Manda el RNC como texto para no perder los ceros" };
  }
  if (typeof value !== "string" || value.trim() === "") {
    return { ok: false, message: "El RNC es obligatorio" };
  }
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 9 && digits.length !== 11) {
    return { ok: false, message: "El RNC tiene que tener 9 u 11 dígitos" };
  }
  return { ok: true, rnc: digits };
}

export function parseNcf(value: unknown): { ok: true; ncf: string } | { ok: false; message: string } {
  if (typeof value !== "string" || value.trim() === "") {
    return { ok: false, message: "El NCF es obligatorio" };
  }
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!/^[A-Z][0-9]{10}$/.test(compact) && !/^E[0-9]{12}$/.test(compact)) {
    return { ok: false, message: "El NCF no es válido. Usa el formato B0100000001 o E310000000001" };
  }
  return { ok: true, ncf: compact };
}

export function sniffCaptura(bytes: Uint8Array): CapturaMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d) {
    return "application/pdf";
  }
  return null;
}

export function extensionForCaptura(mime: CapturaMime): string {
  return MIME_EXTENSION[mime];
}

export function capturaFilename(ncf: string | null, mime: CapturaMime): string {
  const base = ncf && /^[A-Z0-9]+$/.test(ncf) ? ncf : "factura";
  return `factura-${base}.${MIME_EXTENSION[mime]}`;
}

export function mimeForCapturaPath(path: string): CapturaMime | null {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "jpg" || ext === "jpeg") {
    return "image/jpeg";
  }
  if (ext === "png") {
    return "image/png";
  }
  if (ext === "webp") {
    return "image/webp";
  }
  if (ext === "pdf") {
    return "application/pdf";
  }
  return null;
}

export function parseCapturaBytes(bytes: Uint8Array): { ok: true; mime: CapturaMime } | { ok: false; message: string } {
  if (bytes.byteLength === 0) {
    return { ok: false, message: "La captura está vacía" };
  }
  if (bytes.byteLength > CAPTURA_MAX_BYTES) {
    return { ok: false, message: "La captura no puede pasar de 4 MB" };
  }
  const mime = sniffCaptura(bytes);
  if (!mime) {
    return { ok: false, message: "La captura tiene que ser JPG, PNG, WebP o PDF" };
  }
  return { ok: true, mime };
}

export function decodeCapturaBase64(value: string): Uint8Array | null {
  const trimmed = value.trim();
  const payload = trimmed.includes(",") ? trimmed.slice(trimmed.indexOf(",") + 1) : trimmed;
  const compact = payload.replace(/\s/g, "");
  if (!compact || compact.length > Math.ceil(CAPTURA_MAX_BYTES * 4 / 3) + 32) {
    return null;
  }
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(compact)) {
    return null;
  }
  const buffer = Buffer.from(compact, "base64");
  if (buffer.byteLength === 0) {
    return null;
  }
  return new Uint8Array(buffer);
}
