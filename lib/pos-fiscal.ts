import { parseRnc } from "@/lib/contabilidad/compra-fiscal";

export const NCF_TIPOS = ["B02", "E32"] as const;

export type NcfTipo = (typeof NCF_TIPOS)[number];

/** Lo que la caja imprime. La secuencia vive solo en administración. */
export type NegocioRecibo = {
  nombreComercial: string;
  razonSocial: string;
  rnc: string | null;
  direccion: string;
  telefono: string | null;
  ncfVence: string | null;
  emiteNcf: boolean;
};

export type NegocioFiscal = NegocioRecibo & {
  ncfTipo: NcfTipo | null;
  ncfSiguiente: number | null;
  ncfHasta: number | null;
};

export const NEGOCIO_RECIBO_DEFAULT: NegocioRecibo = {
  nombreComercial: "QUICK!",
  razonSocial: "Quick! Mini Market",
  rnc: null,
  direccion: "Residencial Jardines 3, Pueblo Bávaro, La Altagracia",
  telefono: "809-226-4986",
  ncfVence: null,
  emiteNcf: false,
};

const CACHE_KEY = "quick-pos-negocio";

export function ncfSequenceWidth(tipo: NcfTipo): number {
  return tipo.startsWith("E") ? 10 : 8;
}

export function formatNcf(tipo: NcfTipo, secuencia: number): string | null {
  if (!Number.isInteger(secuencia) || secuencia < 1) {
    return null;
  }
  const width = ncfSequenceWidth(tipo);
  if (secuencia > 10 ** width - 1) {
    return null;
  }
  return `${tipo}${String(secuencia).padStart(width, "0")}`;
}

export function formatNcfVence(isoDate: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) {
    return null;
  }
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function todayIsoSantoDomingo(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santo_Domingo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function negocioEmiteNcf(
  value: Pick<NegocioFiscal, "ncfTipo" | "ncfSiguiente" | "ncfHasta" | "ncfVence">,
  today = todayIsoSantoDomingo()
): boolean {
  if (!value.ncfTipo || value.ncfSiguiente == null || value.ncfHasta == null || !value.ncfVence) {
    return false;
  }
  if (value.ncfSiguiente > value.ncfHasta || value.ncfVence < today) {
    return false;
  }
  return formatNcf(value.ncfTipo, value.ncfSiguiente) != null;
}

function clip(value: unknown, max: number): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim().slice(0, max);
}

function dateOrNull(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
  return match ? match[1] : null;
}

function rncOrNull(value: unknown): string | null {
  const text = clip(value, 20);
  if (!text) {
    return null;
  }
  const parsed = parseRnc(text);
  return parsed.ok ? parsed.rnc : null;
}

export function normalizeNegocioRecibo(value: Partial<NegocioRecibo> | null | undefined): NegocioRecibo {
  const source = value ?? {};
  const nombre = clip(source.nombreComercial, 80);
  const razon = clip(source.razonSocial, 120);
  const direccion = clip(source.direccion, 160);
  const hasTelefono = Object.prototype.hasOwnProperty.call(source, "telefono");
  return {
    nombreComercial: nombre || NEGOCIO_RECIBO_DEFAULT.nombreComercial,
    razonSocial: razon || NEGOCIO_RECIBO_DEFAULT.razonSocial,
    rnc: rncOrNull(source.rnc),
    direccion: direccion || NEGOCIO_RECIBO_DEFAULT.direccion,
    telefono: hasTelefono ? clip(source.telefono, 40) || null : NEGOCIO_RECIBO_DEFAULT.telefono,
    ncfVence: dateOrNull(source.ncfVence),
    emiteNcf: source.emiteNcf === true,
  };
}

export function loadCachedNegocio(): NegocioRecibo {
  if (typeof localStorage === "undefined") {
    return NEGOCIO_RECIBO_DEFAULT;
  }
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) {
      return NEGOCIO_RECIBO_DEFAULT;
    }
    return normalizeNegocioRecibo(JSON.parse(raw) as Partial<NegocioRecibo>);
  } catch {
    return NEGOCIO_RECIBO_DEFAULT;
  }
}

export function cacheNegocio(value: NegocioRecibo): void {
  if (typeof localStorage === "undefined") {
    return;
  }
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(value));
  } catch {
    // El recibo sigue con los datos que ya están en memoria.
  }
}

export function wrapTicketLine(value: string, width = 32): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const piece = word.length > width ? word.slice(0, width) : word;
    if (!current) {
      current = piece;
      continue;
    }
    if (current.length + 1 + piece.length <= width) {
      current = `${current} ${piece}`;
    } else {
      lines.push(current);
      current = piece;
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines;
}

export function fiscalHeaderLines(negocio: NegocioRecibo, ncf: string | null): string[] {
  const lines: string[] = [];
  const comercial = negocio.nombreComercial.trim() || NEGOCIO_RECIBO_DEFAULT.nombreComercial;
  const razon = negocio.razonSocial.trim();
  lines.push(comercial);
  if (razon && razon.toLocaleLowerCase("es") !== comercial.toLocaleLowerCase("es")) {
    lines.push(...wrapTicketLine(razon));
  }
  if (negocio.direccion.trim()) {
    lines.push(...wrapTicketLine(negocio.direccion));
  }
  if (negocio.telefono?.trim()) {
    lines.push(...wrapTicketLine(`Tel. ${negocio.telefono.trim()}`));
  }
  if (negocio.rnc?.trim()) {
    lines.push(`RNC ${negocio.rnc.trim()}`);
  }
  const comprobante = ncf?.trim() ?? "";
  if (comprobante) {
    lines.push(`NCF ${comprobante}`);
    const vence = negocio.ncfVence ? formatNcfVence(negocio.ncfVence) : null;
    if (vence) {
      lines.push(`Válido hasta ${vence}`);
    }
  } else if (negocio.emiteNcf) {
    lines.push("NCF pendiente");
  }
  return lines;
}

function parseTipo(value: unknown): NcfTipo | null | "invalid" {
  const text = clip(value, 8).toUpperCase();
  if (!text) {
    return null;
  }
  return NCF_TIPOS.includes(text as NcfTipo) ? (text as NcfTipo) : "invalid";
}

function parseSecuencia(value: unknown): number | null | "invalid" {
  if (value == null || value === "") {
    return null;
  }
  const raw = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  if (!/^[0-9]+$/.test(raw)) {
    return "invalid";
  }
  const number = Number(raw);
  if (!Number.isSafeInteger(number) || number < 1) {
    return "invalid";
  }
  return number;
}

export function parseNegocioFiscalPatch(
  body: unknown,
  current: NegocioFiscal,
  issued: boolean
): { ok: true; value: NegocioFiscal } | { ok: false; message: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, message: "El cuerpo no es válido" };
  }
  const input = body as Record<string, unknown>;
  const nombreComercial = clip(input.nombreComercial, 80);
  const razonSocial = clip(input.razonSocial, 120);
  const direccion = clip(input.direccion, 160);
  const telefono = clip(input.telefono, 40) || null;
  if (!nombreComercial || !razonSocial || !direccion) {
    return { ok: false, message: "El nombre, la razón social y la dirección son obligatorios" };
  }
  const rncText = clip(input.rnc, 20);
  let rnc: string | null = null;
  if (rncText) {
    const parsed = parseRnc(rncText);
    if (!parsed.ok) {
      return { ok: false, message: parsed.message };
    }
    rnc = parsed.rnc;
  }
  const tipo = parseTipo(input.ncfTipo);
  if (tipo === "invalid") {
    return { ok: false, message: "El tipo de NCF tiene que ser B02 o E32" };
  }
  const siguiente = parseSecuencia(input.ncfSiguiente);
  const hasta = parseSecuencia(input.ncfHasta);
  if (siguiente === "invalid" || hasta === "invalid") {
    return { ok: false, message: "La secuencia del NCF tiene que ser un número entero" };
  }
  const vence = dateOrNull(input.ncfVence);
  const secuenciaVacia = !tipo && siguiente == null && hasta == null && !vence;
  const secuenciaCompleta = Boolean(tipo && siguiente != null && hasta != null && vence);
  if (!secuenciaVacia && !secuenciaCompleta) {
    return { ok: false, message: "Para emitir NCF hacen falta el tipo, el desde, el hasta y la fecha de vencimiento" };
  }
  const agotada = siguiente != null && hasta != null && siguiente === hasta + 1;
  if (secuenciaCompleta && tipo && siguiente != null && hasta != null && vence) {
    if (hasta < siguiente && !agotada) {
      return { ok: false, message: "El hasta del NCF no puede ser menor que el desde" };
    }
    const cabe = formatNcf(tipo, hasta) && (agotada || formatNcf(tipo, siguiente));
    if (!cabe) {
      return { ok: false, message: tipo === "E32" ? "La secuencia E32 usa hasta 10 dígitos" : "La secuencia B02 usa hasta 8 dígitos" };
    }
    if (vence < todayIsoSantoDomingo()) {
      return { ok: false, message: "La fecha de vencimiento del NCF ya pasó" };
    }
  }
  if (issued) {
    if (!current.ncfTipo || secuenciaVacia || tipo !== current.ncfTipo) {
      return { ok: false, message: "Ya se emitieron comprobantes. No se puede cambiar el tipo ni borrar la secuencia" };
    }
    if (siguiente != null && current.ncfSiguiente != null && siguiente < current.ncfSiguiente) {
      return { ok: false, message: "La secuencia no puede retroceder: ese NCF ya se usó" };
    }
  }
  const value: NegocioFiscal = {
    nombreComercial,
    razonSocial,
    rnc,
    direccion,
    telefono,
    ncfTipo: tipo,
    ncfSiguiente: siguiente,
    ncfHasta: hasta,
    ncfVence: vence,
    emiteNcf: false,
  };
  value.emiteNcf = negocioEmiteNcf(value);
  return { ok: true, value };
}
