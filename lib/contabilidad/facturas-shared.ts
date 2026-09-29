import { calendarDayKey } from "@/lib/local-day";

export const FACTURA_ESTADOS = [
  { id: "recibida", label: "Recibida", corto: "Recibida", ayuda: "Llegó y todavía no se revisa." },
  { id: "en_analisis", label: "En análisis", corto: "Análisis", ayuda: "Phillip está leyendo el documento." },
  { id: "pendiente_informacion", label: "Pendiente de información", corto: "Pendiente", ayuda: "Hay una duda abierta." },
  { id: "respuesta_recibida", label: "Respuesta recibida", corto: "Respondida", ayuda: "Llegó la respuesta y falta incorporarla." },
  { id: "completa", label: "Completa", corto: "Completa", ayuda: "Phillip terminó de capturar y validar. No significa que la factura ya esté en Odoo." },
  { id: "incompleta", label: "Incompleta", corto: "Incompleta", ayuda: "Faltan páginas o datos y no se van a conseguir." },
  { id: "posible_duplicado", label: "Posible duplicado", corto: "Duplicado", ayuda: "Coincide con otra factura ya guardada." },
  { id: "documento_no_valido", label: "Documento no válido", corto: "No válida", ayuda: "No es una factura utilizable." },
  { id: "escalada", label: "Escalada", corto: "Escalada", ayuda: "Phillip la pasó a una persona." },
] as const;

export const FACTURA_TIPOS = [
  { id: "factura", label: "Factura" },
  { id: "nota_credito", label: "Nota de crédito" },
  { id: "conduce", label: "Conduce" },
  { id: "recibo", label: "Recibo" },
  { id: "cotizacion", label: "Cotización" },
] as const;

export const FACTURA_CONDICIONES = [
  { id: "contado", label: "Contado" },
  { id: "credito", label: "Crédito" },
] as const;

export const FACTURA_MONEDAS = [
  { id: "DOP", label: "RD$" },
  { id: "USD", label: "US$" },
  { id: "EUR", label: "EUR" },
] as const;

export const FACTURA_PRESENTACIONES = [
  { id: "unidad", label: "Unidad" },
  { id: "paquete", label: "Paquete" },
  { id: "caja", label: "Caja" },
  { id: "fardo", label: "Fardo" },
  { id: "otro", label: "Otra" },
] as const;

export const FACTURA_ESTADOS_LINEA = [
  { id: "completa", label: "Completa" },
  { id: "ambigua", label: "Ambigua" },
  { id: "ilegible", label: "Ilegible" },
  { id: "pendiente", label: "Pendiente" },
] as const;

export const FACTURA_ITBIS_LINEA = [
  { id: "si", label: "Sí" },
  { id: "no", label: "No" },
  { id: "no_determinado", label: "No determinado" },
] as const;

export const FACTURA_VALIDACIONES = [
  { id: "suma_lineas", label: "Suma de líneas coincide con subtotal" },
  { id: "itbis", label: "ITBIS recalculado coincide" },
  { id: "total", label: "Total recalculado coincide" },
  { id: "ncf_legible", label: "NCF legible" },
  { id: "numero_legible", label: "Número de factura legible" },
  { id: "posible_duplicado", label: "Posible factura duplicada" },
  { id: "paginas", label: "Todas las páginas recibidas" },
  { id: "cantidades", label: "Cantidades y presentaciones claras" },
  { id: "diferencia_matematica", label: "Diferencia matemática detectada" },
  { id: "documento_completo", label: "Documento completo o incompleto" },
] as const;

export const FACTURA_RESULTADOS = [
  { id: "correcto", label: "Correcto" },
  { id: "diferencia", label: "Diferencia" },
  { id: "pendiente", label: "Pendiente" },
  { id: "no_aplica", label: "No aplica" },
] as const;

export const FACTURA_PREGUNTA_ESTADOS = [
  { id: "abierta", label: "Abierta" },
  { id: "resuelta", label: "Resuelta" },
] as const;

export type FacturaEstado = (typeof FACTURA_ESTADOS)[number]["id"];
export type FacturaTipoDocumento = (typeof FACTURA_TIPOS)[number]["id"];
export type FacturaCondicion = (typeof FACTURA_CONDICIONES)[number]["id"];
export type FacturaMoneda = (typeof FACTURA_MONEDAS)[number]["id"];
export type FacturaPresentacion = (typeof FACTURA_PRESENTACIONES)[number]["id"];
export type FacturaEstadoLinea = (typeof FACTURA_ESTADOS_LINEA)[number]["id"];
export type FacturaItbisLinea = (typeof FACTURA_ITBIS_LINEA)[number]["id"];
export type FacturaValidacionCodigo = (typeof FACTURA_VALIDACIONES)[number]["id"];
export type FacturaResultado = (typeof FACTURA_RESULTADOS)[number]["id"];
export type FacturaPreguntaEstado = (typeof FACTURA_PREGUNTA_ESTADOS)[number]["id"];

export type FacturaLinea = {
  id: string;
  numeroLinea: number;
  codigoSku: string | null;
  codigoBarras: string | null;
  descripcionOriginal: string | null;
  productoNormalizado: string | null;
  marca: string | null;
  variante: string | null;
  tamano: string | null;
  presentacion: FacturaPresentacion | null;
  presentacionLabel: string | null;
  cantidadComprada: number | null;
  unidadesPorPresentacion: number | null;
  unidadesTotales: number | null;
  costoPorPresentacion: number | null;
  costoUnitario: number | null;
  descuentoLinea: number | null;
  itbisLinea: number | null;
  precioIncluyeItbis: FacturaItbisLinea;
  precioIncluyeItbisLabel: string;
  subtotalLinea: number | null;
  totalLinea: number | null;
  estado: FacturaEstadoLinea;
  estadoLabel: string;
  observacion: string | null;
  productoId: string | null;
  productoCatalogo: FacturaProductoCatalogo | null;
};

export type FacturaProductoCatalogo = {
  id: string;
  nombre: string;
  marca: string | null;
  codigoOdoo: string | null;
  codigoBarras: string | null;
};

export type FacturaCatalogoRef =
  | { accion: "omitir" }
  | { accion: "quitar" }
  | { accion: "id"; id: string }
  | { accion: "codigo"; codigo: string };

export type FacturaValidacion = {
  codigo: FacturaValidacionCodigo;
  codigoLabel: string;
  resultado: FacturaResultado;
  resultadoLabel: string;
  explicacion: string | null;
  revisadoEn: string | null;
};

export type FacturaPregunta = {
  id: string;
  lineaNumero: number | null;
  campo: string | null;
  pregunta: string;
  consultadoA: string | null;
  respuesta: string | null;
  respondidoPor: string | null;
  respondidoEn: string | null;
  evidencia: string | null;
  estado: FacturaPreguntaEstado;
  estadoLabel: string;
  creadoEn: string;
};

export type FacturaDocumento = {
  id: string;
  nombre: string | null;
  mime: string;
  pagina: number | null;
  esImagen: boolean;
  creadoEn: string;
};

export type FacturaResumen = {
  id: string;
  clave: string | null;
  referencia: string;
  recibidoEn: string;
  enviadoPor: string | null;
  tienda: string | null;
  tipoDocumento: FacturaTipoDocumento;
  tipoDocumentoLabel: string;
  proveedor: string | null;
  rnc: string | null;
  ncf: string | null;
  numeroFactura: string | null;
  fechaEmision: string | null;
  fechaVencimiento: string | null;
  condicion: FacturaCondicion | null;
  condicionLabel: string | null;
  metodoPago: string | null;
  moneda: FacturaMoneda;
  subtotal: number | null;
  descuentoTotal: number | null;
  itbisTotal: number | null;
  otrosCargos: number | null;
  total: number | null;
  numeroProductos: number;
  numeroDocumentos: number;
  tieneFoto: boolean;
  estado: FacturaEstado;
  estadoLabel: string;
  estadoAyuda: string;
  observaciones: string | null;
  posibleDuplicado: boolean;
  duplicadoReferencia: string | null;
  preguntasAbiertas: number;
  actualizadoEn: string;
  compraId: string | null;
  inventarioEstado: "pendiente" | "parcial" | "aplicada";
  inventarioAplicadoEn: string | null;
};

export type FacturaDetalle = FacturaResumen & {
  lineas: FacturaLinea[];
  validaciones: FacturaValidacion[];
  preguntas: FacturaPregunta[];
  documentos: FacturaDocumento[];
};

export type FacturasResumen = {
  total: number;
  porEstado: Array<{ id: FacturaEstado; label: string; facturas: number }>;
  preguntasAbiertas: number;
  posiblesDuplicados: number;
  sinFoto: number;
};

export type FacturaCampos = {
  clave?: string | null;
  recibidoEn?: string | null;
  enviadoPor?: string | null;
  tienda?: string | null;
  tipoDocumento?: FacturaTipoDocumento;
  proveedor?: string | null;
  rnc?: string | null;
  ncf?: string | null;
  numeroFactura?: string | null;
  fechaEmision?: string | null;
  fechaVencimiento?: string | null;
  condicion?: FacturaCondicion | null;
  metodoPago?: string | null;
  moneda?: FacturaMoneda;
  subtotal?: number | null;
  descuentoTotal?: number | null;
  itbisTotal?: number | null;
  otrosCargos?: number | null;
  total?: number | null;
  estado?: FacturaEstado;
  observaciones?: string | null;
};

export type FacturaLineaInput = {
  numeroLinea: number;
  codigoSku: string | null;
  codigoBarras: string | null;
  descripcionOriginal: string | null;
  productoNormalizado: string | null;
  marca: string | null;
  variante: string | null;
  tamano: string | null;
  presentacion: FacturaPresentacion | null;
  cantidadComprada: number | null;
  unidadesPorPresentacion: number | null;
  unidadesTotales: number | null;
  costoPorPresentacion: number | null;
  costoUnitario: number | null;
  descuentoLinea: number | null;
  itbisLinea: number | null;
  precioIncluyeItbis: FacturaItbisLinea;
  subtotalLinea: number | null;
  totalLinea: number | null;
  estado: FacturaEstadoLinea;
  observacion: string | null;
  catalogo: FacturaCatalogoRef;
};

export type FacturaValidacionInput = {
  codigo: FacturaValidacionCodigo;
  resultado: FacturaResultado;
  explicacion: string | null;
  revisadoEn: string | null;
};

export type FacturaPreguntaInput = {
  id?: string | null;
  lineaNumero: number | null;
  campo: string | null;
  pregunta: string;
  consultadoA: string | null;
  respuesta: string | null;
  respondidoPor: string | null;
  respondidoEn: string | null;
  evidencia: string | null;
  estado: FacturaPreguntaEstado;
};

export type DuplicadoCandidato = {
  id: string;
  proveedor: string | null;
  ncf: string | null;
  numeroFactura: string | null;
  fechaEmision: string | null;
  total: number | null;
  tienda: string | null;
  moneda: string;
};

export const FACTURAS_AGENT_USO =
  "Guarda cada factura en cuanto llegue, con la foto original. POST /api/agent/facturas manda proveedor, tienda, fechas, montos, lineas (o productos), validaciones, preguntas y la foto: en JSON usa fotoBase64 o documentos[{ pagina, base64 }]; en multipart adjunta el archivo en el campo foto (también vale captura o documento). JPG, PNG, WebP o PDF, hasta 4 MB por archivo. Si hay varias páginas, mándalas todas. Identifica la factura con referencia (proveedor, fecha, monto y tienda): el id es interno y no se menciona en la conversación. Si no sabes cuántas unidades trae la caja, el paquete o el fardo, no mandes unidadesPorPresentacion ni calcules unidadesTotales o costoUnitario. Para cruzar una línea con el catálogo manda productoId o codigoOdoo; si no lo mandas, el producto ya elegido se conserva. Repetir el POST con la misma clave no pisa la factura y responde creado: false; una foto nueva de esa clave sí se guarda. Para corregir usa PATCH. Completa significa que terminaste de capturar y validar, no que la factura esté en Odoo. Para meter las unidades y el costo al inventario manda aplicarInventario: true en el POST o en el PATCH. Sin ese campo la factura solo se guarda. Una línea sin producto, sin costo o sin unidades por caja no mueve stock.";

export const FACTURAS_AGENT_ENDPOINTS = [
  {
    method: "GET",
    path: "/api/agent/facturas?estado=&q=&tienda=&pendientes=true&duplicados=true",
    describe: "Vocabulario, conteos y el listado. Cada factura trae referencia para hablar con una persona, y id solo para las llamadas siguientes.",
  },
  {
    method: "POST",
    path: "/api/agent/facturas",
    describe:
      "Crea la factura y sube la foto. JSON: fotoBase64 o documentos[{ nombre, pagina, base64 }]. Multipart: archivo en foto, captura o documento, y el resto de los campos como texto (lineas y validaciones van en JSON dentro del campo). JPG, PNG, WebP o PDF, hasta 4 MB. clave es opcional. Si ya existe, responde 200 con creado: false, no pisa los datos y sí guarda una foto nueva.",
  },
  { method: "GET", path: "/api/agent/facturas/{id-o-clave}", describe: "La factura completa: cabecera, productos, validaciones, preguntas y documentos." },
  {
    method: "PATCH",
    path: "/api/agent/facturas/{id-o-clave}",
    describe:
      "Actualiza solo los campos enviados. lineas o productos hace upsert por numeroLinea; reemplazarLineas: true borra las que no mandes. validaciones hace upsert por codigo. preguntas nuevas se agregan y, si traen id, se actualizan.",
  },
  {
    method: "POST",
    path: "/api/agent/facturas/{id-o-clave}/lineas",
    describe: "Agrega o corrige productos. El mismo numeroLinea actualiza la fila. Para enlazar el catálogo manda productoId o codigoOdoo. No calcules unidades si no conoces las unidades por presentación.",
  },
  {
    method: "POST",
    path: "/api/agent/facturas/{id-o-clave}/validaciones",
    describe: "Registra resultado (correcto, diferencia, pendiente, no_aplica), explicacion y la fecha de revisión. El codigo puede ser el id o la etiqueta.",
  },
  {
    method: "POST",
    path: "/api/agent/facturas/{id-o-clave}/preguntas",
    describe: "Abre una duda: campo, pregunta y a quién se consultó. Si ya mandas respuesta, queda resuelta.",
  },
  {
    method: "PATCH",
    path: "/api/agent/facturas/{id-o-clave}/preguntas/{preguntaId}",
    describe: "Guarda la respuesta, quién respondió, la evidencia y el estado abierta o resuelta.",
  },
  {
    method: "POST",
    path: "/api/agent/facturas/{id-o-clave}/documentos",
    describe: "Adjunta otra página. documentos: [{ nombre, pagina, base64 }]. Una foto repetida no se duplica.",
  },
  {
    method: "GET",
    path: "/api/agent/facturas/{id-o-clave}/documentos/{documentoId}",
    describe: "Descarga la foto o el PDF original.",
  },
] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ESTADO_ALIAS: Record<string, FacturaEstado> = {
  analizando: "en_analisis",
  pendiente: "pendiente_informacion",
  pendiente_de_informacion: "pendiente_informacion",
  duplicada: "posible_duplicado",
  duplicado: "posible_duplicado",
  no_valido: "documento_no_valido",
  invalido: "documento_no_valido",
  documento_invalido: "documento_no_valido",
};

const TIPO_ALIAS: Record<string, FacturaTipoDocumento> = {
  nota_de_credito: "nota_credito",
  nc: "nota_credito",
  cotizacion: "cotizacion",
  quote: "cotizacion",
};

const PRESENTACION_ALIAS: Record<string, FacturaPresentacion> = {
  unidades: "unidad",
  unitario: "unidad",
  paquetes: "paquete",
  cajas: "caja",
  fardos: "fardo",
  otra: "otro",
};

const VALIDACION_ALIAS: Record<string, FacturaValidacionCodigo> = {
  suma_de_lineas: "suma_lineas",
  suma_de_lineas_coincide_con_subtotal: "suma_lineas",
  itbis_recalculado: "itbis",
  itbis_recalculado_coincide: "itbis",
  total_recalculado: "total",
  total_recalculado_coincide: "total",
  ncf: "ncf_legible",
  numero_de_factura: "numero_legible",
  numero_de_factura_legible: "numero_legible",
  numero_factura_legible: "numero_legible",
  factura_duplicada: "posible_duplicado",
  posible_factura_duplicada: "posible_duplicado",
  duplicado: "posible_duplicado",
  paginas_recibidas: "paginas",
  todas_las_paginas: "paginas",
  todas_las_paginas_recibidas: "paginas",
  cantidades_y_presentaciones: "cantidades",
  cantidades_y_presentaciones_claras: "cantidades",
  diferencia: "diferencia_matematica",
  diferencia_matematica_detectada: "diferencia_matematica",
  documento: "documento_completo",
  documento_completo_o_incompleto: "documento_completo",
};

const RESULTADO_ALIAS: Record<string, FacturaResultado> = {
  ok: "correcto",
  coincide: "correcto",
  no_coincide: "diferencia",
  diferencia_detectada: "diferencia",
  na: "no_aplica",
  noaplica: "no_aplica",
};

const ITBIS_ALIAS: Record<string, FacturaItbisLinea> = {
  yes: "si",
  true: "si",
  false: "no",
  desconocido: "no_determinado",
  no_se: "no_determinado",
};

const PREGUNTA_ALIAS: Record<string, FacturaPreguntaEstado> = {
  abierto: "abierta",
  resuelto: "resuelta",
  cerrada: "resuelta",
};

const LINEA_ALIAS: Record<string, FacturaEstadoLinea> = {
  dudosa: "ambigua",
  no_se_lee: "ilegible",
};

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

export function labelOf<T extends { id: string; label: string }>(list: readonly T[], id: string): string {
  return list.find((item) => item.id === id)?.label ?? id;
}

export function normalizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function parseClave(value: unknown): { ok: true; clave: string | null } | { ok: false; message: string } {
  if (value == null || value === "") {
    return { ok: true, clave: null };
  }
  if (typeof value !== "string") {
    return { ok: false, message: "La clave tiene que ser texto" };
  }
  const clave = value.trim();
  if (!clave) {
    return { ok: true, clave: null };
  }
  if (clave.length > 80 || !/^[A-Za-z0-9_.:-]+$/.test(clave)) {
    return { ok: false, message: "La clave solo puede tener letras, números, punto, guión y guión bajo" };
  }
  return { ok: true, clave };
}

function parseEnum<T extends string>(
  list: readonly { id: T; label: string }[],
  value: unknown,
  alias: Record<string, T>
): T | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  const token = normalizeToken(value);
  const aliased = alias[token];
  if (aliased && list.some((item) => item.id === aliased)) {
    return aliased;
  }
  const byId = list.find((item) => item.id === token);
  if (byId) {
    return byId.id;
  }
  return list.find((item) => normalizeToken(item.label) === token)?.id ?? null;
}

export function parseEstado(value: unknown): FacturaEstado | null {
  return parseEnum(FACTURA_ESTADOS, value, ESTADO_ALIAS);
}

export function parseTipoDocumento(value: unknown): FacturaTipoDocumento | null {
  return parseEnum(FACTURA_TIPOS, value, TIPO_ALIAS);
}

export function parseCondicion(value: unknown): FacturaCondicion | null {
  return parseEnum(FACTURA_CONDICIONES, value, {});
}

export function parseMoneda(value: unknown): FacturaMoneda | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  const token = normalizeToken(value);
  if (token === "rd" || token === "dop" || token === "rd$" || token === "peso" || token === "pesos") {
    return "DOP";
  }
  if (token === "usd" || token === "us" || token === "dolar" || token === "dolares") {
    return "USD";
  }
  if (token === "eur" || token === "euro" || token === "euros") {
    return "EUR";
  }
  return parseEnum(FACTURA_MONEDAS, value, {});
}

export function parsePresentacion(value: unknown): FacturaPresentacion | null {
  return parseEnum(FACTURA_PRESENTACIONES, value, PRESENTACION_ALIAS);
}

export function parseEstadoLinea(value: unknown): FacturaEstadoLinea | null {
  return parseEnum(FACTURA_ESTADOS_LINEA, value, LINEA_ALIAS);
}

export function parseItbisLinea(value: unknown): FacturaItbisLinea | null {
  if (typeof value === "boolean") {
    return value ? "si" : "no";
  }
  return parseEnum(FACTURA_ITBIS_LINEA, value, ITBIS_ALIAS);
}

export function parseValidacionCodigo(value: unknown): FacturaValidacionCodigo | null {
  return parseEnum(FACTURA_VALIDACIONES, value, VALIDACION_ALIAS);
}

export function parseResultado(value: unknown): FacturaResultado | null {
  return parseEnum(FACTURA_RESULTADOS, value, RESULTADO_ALIAS);
}

export function parsePreguntaEstado(value: unknown): FacturaPreguntaEstado | null {
  return parseEnum(FACTURA_PREGUNTA_ESTADOS, value, PREGUNTA_ALIAS);
}

export function mensajeEstadoInvalido(): string {
  return `El estado no es válido. Usa ${FACTURA_ESTADOS.map((item) => item.id).join(", ")}`;
}

function roundTo(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function parseMoney(value: unknown, label: string): { ok: true; value: number | null } | { ok: false; message: string } {
  if (value == null || value === "") {
    return { ok: true, value: null };
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return { ok: false, message: `${label} no es un monto válido` };
    }
    return { ok: true, value: roundTo(value, 2) };
  }
  if (typeof value !== "string") {
    return { ok: false, message: `${label} no es un monto válido` };
  }
  let text = value.trim().replace(/\s/g, "").replace(/^(RD\$|US\$|USD|DOP|EUR|€)/i, "");
  if (!text) {
    return { ok: true, value: null };
  }
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(text) || /^-?\d+,\d{1,4}$/.test(text)) {
    text = text.replace(/\./g, "").replace(",", ".");
  } else {
    text = text.replace(/,/g, "");
  }
  const number = Number(text);
  if (!Number.isFinite(number)) {
    return { ok: false, message: `${label} no es un monto válido` };
  }
  return { ok: true, value: roundTo(number, 2) };
}

export function parseCantidad(value: unknown, label: string): { ok: true; value: number | null } | { ok: false; message: string } {
  const parsed = parseMoney(value, label);
  if (!parsed.ok || parsed.value == null) {
    return parsed;
  }
  if (parsed.value < 0) {
    return { ok: false, message: `${label} no puede ser negativa` };
  }
  return { ok: true, value: roundTo(parsed.value, 3) };
}

export function parseFecha(value: unknown, label: string): { ok: true; value: string | null } | { ok: false; message: string } {
  if (value == null || value === "") {
    return { ok: true, value: null };
  }
  const key = calendarDayKey(value);
  if (!key) {
    return { ok: false, message: `${label} tiene que usar el formato YYYY-MM-DD` };
  }
  return { ok: true, value: key };
}

export function parseFechaHora(value: unknown, label: string): { ok: true; value: string | null } | { ok: false; message: string } {
  if (value == null || value === "") {
    return { ok: true, value: null };
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return { ok: false, message: `${label} no es una fecha válida` };
    }
    return { ok: true, value: value.toISOString() };
  }
  if (typeof value !== "string") {
    return { ok: false, message: `${label} tiene que ser fecha y hora` };
  }
  const date = new Date(value.trim());
  if (Number.isNaN(date.getTime())) {
    return { ok: false, message: `${label} no es una fecha válida` };
  }
  return { ok: true, value: date.toISOString() };
}

export function formatMonto(value: number | null, moneda: string = "DOP"): string {
  if (value == null) {
    return "—";
  }
  const formatted = new Intl.NumberFormat("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  if (moneda === "USD") {
    return `US$${formatted}`;
  }
  if (moneda === "EUR") {
    return `€${formatted}`;
  }
  return `RD$${formatted}`;
}

export function referenciaFactura(input: {
  proveedor: string | null;
  fechaEmision: string | null;
  recibidoEn?: string | null;
  total: number | null;
  moneda: string;
  tienda: string | null;
}): string {
  const fecha = input.fechaEmision ?? (input.recibidoEn ? input.recibidoEn.slice(0, 10) : null);
  const monto = input.total == null ? null : formatMonto(input.total, input.moneda);
  const parts = [input.proveedor, fecha, monto, input.tienda].filter((part): part is string => Boolean(part && part !== "—"));
  return parts.join(" · ") || "Factura sin datos";
}

export function buscarDuplicado(
  actual: { id?: string | null; proveedor: string | null; ncf: string | null; numeroFactura: string | null; fechaEmision: string | null },
  candidatos: DuplicadoCandidato[]
): { candidato: DuplicadoCandidato; motivo: "ncf" | "numero" } | null {
  const ncf = actual.ncf?.trim().toUpperCase() || null;
  const proveedor = actual.proveedor?.trim().toLowerCase() || null;
  const numero = actual.numeroFactura?.trim().toLowerCase() || null;
  for (const candidato of candidatos) {
    if (actual.id && candidato.id === actual.id) {
      continue;
    }
    if (ncf && candidato.ncf?.trim().toUpperCase() === ncf) {
      return { candidato, motivo: "ncf" };
    }
    if (
      proveedor &&
      numero &&
      actual.fechaEmision &&
      candidato.proveedor?.trim().toLowerCase() === proveedor &&
      candidato.numeroFactura?.trim().toLowerCase() === numero &&
      candidato.fechaEmision === actual.fechaEmision
    ) {
      return { candidato, motivo: "numero" };
    }
  }
  return null;
}

export function explicacionDuplicado(motivo: "ncf" | "numero", referencia: string): string {
  if (motivo === "ncf") {
    return `Hay otra factura con el mismo NCF: ${referencia}`;
  }
  return `Hay otra factura del mismo proveedor, número y fecha: ${referencia}`;
}

export function resolverUnidades(input: {
  presentacion: FacturaPresentacion | null;
  cantidadComprada: number | null;
  unidadesPorPresentacion: number | null;
  unidadesTotales: number | null;
  costoPorPresentacion: number | null;
  costoUnitario: number | null;
}): { unidadesPorPresentacion: number | null; unidadesTotales: number | null; costoUnitario: number | null; aviso: string | null } {
  const known = input.unidadesPorPresentacion ?? (input.presentacion === "unidad" ? 1 : null);
  const intentoIndividual = input.unidadesTotales != null || input.costoUnitario != null;
  if (known == null) {
    return {
      unidadesPorPresentacion: null,
      unidadesTotales: null,
      costoUnitario: null,
      aviso: intentoIndividual
        ? "No se guardaron las unidades individuales ni el costo unitario: no está confirmado cuántas unidades trae la presentación."
        : null,
    };
  }
  if (!(known > 0)) {
    throw new Error("Las unidades por presentación tienen que ser mayores que cero");
  }
  const unidadesTotales = input.cantidadComprada == null ? null : roundTo(input.cantidadComprada * known, 3);
  const costoUnitario = input.costoPorPresentacion == null ? null : roundTo(input.costoPorPresentacion / known, 4);
  const aviso =
    input.unidadesTotales != null && unidadesTotales != null && Math.abs(input.unidadesTotales - unidadesTotales) > 0.001
      ? "Las unidades totales se recalcularon con la cantidad y las unidades por presentación."
      : null;
  return {
    unidadesPorPresentacion: known,
    unidadesTotales,
    costoUnitario,
    aviso,
  };
}

export function completarValidaciones(stored: FacturaValidacion[]): FacturaValidacion[] {
  return FACTURA_VALIDACIONES.map((item) => {
    const found = stored.find((row) => row.codigo === item.id);
    if (found) {
      return { ...found, codigoLabel: item.label };
    }
    return {
      codigo: item.id,
      codigoLabel: item.label,
      resultado: "pendiente",
      resultadoLabel: "Pendiente",
      explicacion: null,
      revisadoEn: null,
    };
  });
}

function hasKey(body: Record<string, unknown>, keys: string[]): boolean {
  return keys.some((key) => Object.prototype.hasOwnProperty.call(body, key));
}

function pick(body: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      return body[key];
    }
  }
  return undefined;
}

function textOrNull(value: unknown, max: number): string | null {
  if (value == null) {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value).slice(0, max);
  }
  if (typeof value !== "string") {
    return null;
  }
  const text = value.trim().slice(0, max);
  return text || null;
}

function requireMoney(value: unknown, label: string): number | null {
  const parsed = parseMoney(value, label);
  if (!parsed.ok) {
    throw new Error(parsed.message);
  }
  return parsed.value;
}

function requireCantidad(value: unknown, label: string): number | null {
  const parsed = parseCantidad(value, label);
  if (!parsed.ok) {
    throw new Error(parsed.message);
  }
  return parsed.value;
}

function requireFecha(value: unknown, label: string): string | null {
  const parsed = parseFecha(value, label);
  if (!parsed.ok) {
    throw new Error(parsed.message);
  }
  return parsed.value;
}

function requireFechaHora(value: unknown, label: string): string | null {
  const parsed = parseFechaHora(value, label);
  if (!parsed.ok) {
    throw new Error(parsed.message);
  }
  return parsed.value;
}

export function leerCamposFactura(body: Record<string, unknown>, mode: "create" | "patch"): { campos: FacturaCampos; estadoExplicito: boolean } {
  const campos: FacturaCampos = {};
  const take = (keys: string[], apply: (value: unknown) => void) => {
    if (mode === "patch" && !hasKey(body, keys)) {
      return;
    }
    if (mode === "create" && !hasKey(body, keys)) {
      return;
    }
    apply(pick(body, keys));
  };

  take(["clave"], (value) => {
    const parsed = parseClave(value);
    if (!parsed.ok) {
      throw new Error(parsed.message);
    }
    campos.clave = parsed.clave;
  });
  take(["recibidoEn", "recibido_en", "fechaRecepcion"], (value) => {
    campos.recibidoEn = requireFechaHora(value, "La fecha de recepción");
  });
  take(["enviadoPor", "enviado_por"], (value) => {
    campos.enviadoPor = textOrNull(value, 160);
  });
  take(["tienda"], (value) => {
    campos.tienda = textOrNull(value, 160);
  });
  take(["tipoDocumento", "tipo_documento", "tipo"], (value) => {
    const tipo = parseTipoDocumento(value);
    if (!tipo) {
      throw new Error(`El tipo de documento no es válido. Usa ${FACTURA_TIPOS.map((item) => item.id).join(", ")}`);
    }
    campos.tipoDocumento = tipo;
  });
  take(["proveedor"], (value) => {
    campos.proveedor = textOrNull(value, 200);
  });
  take(["rnc"], (value) => {
    const text = textOrNull(value, 20);
    campos.rnc = text ? text.replace(/\D/g, "") || text : null;
  });
  take(["ncf"], (value) => {
    const text = textOrNull(value, 20);
    campos.ncf = text ? text.toUpperCase().replace(/[^A-Z0-9]/g, "") || null : null;
  });
  take(["numeroFactura", "numero_factura", "numero"], (value) => {
    campos.numeroFactura = textOrNull(value, 80);
  });
  take(["fechaEmision", "fecha_emision", "fecha"], (value) => {
    campos.fechaEmision = requireFecha(value, "La fecha de emisión");
  });
  take(["fechaVencimiento", "fecha_vencimiento", "vencimiento"], (value) => {
    campos.fechaVencimiento = requireFecha(value, "La fecha de vencimiento");
  });
  take(["condicion"], (value) => {
    if (value == null || value === "") {
      campos.condicion = null;
      return;
    }
    const condicion = parseCondicion(value);
    if (!condicion) {
      throw new Error("La condición tiene que ser contado o credito");
    }
    campos.condicion = condicion;
  });
  take(["metodoPago", "metodo_pago"], (value) => {
    campos.metodoPago = textOrNull(value, 80);
  });
  take(["moneda"], (value) => {
    const moneda = parseMoneda(value);
    if (!moneda) {
      throw new Error("La moneda tiene que ser DOP, USD o EUR");
    }
    campos.moneda = moneda;
  });
  take(["subtotal"], (value) => {
    campos.subtotal = requireMoney(value, "El subtotal");
  });
  take(["descuentoTotal", "descuento_total", "descuento"], (value) => {
    campos.descuentoTotal = requireMoney(value, "El descuento");
  });
  take(["itbisTotal", "itbis_total", "itbis"], (value) => {
    campos.itbisTotal = requireMoney(value, "El ITBIS");
  });
  take(["otrosCargos", "otros_cargos", "otros"], (value) => {
    campos.otrosCargos = requireMoney(value, "Los otros cargos");
  });
  take(["total"], (value) => {
    campos.total = requireMoney(value, "El total");
  });
  const estadoExplicito = hasKey(body, ["estado"]);
  if (estadoExplicito) {
    const estado = parseEstado(pick(body, ["estado"]));
    if (!estado) {
      throw new Error(mensajeEstadoInvalido());
    }
    campos.estado = estado;
  }
  take(["observaciones"], (value) => {
    campos.observaciones = textOrNull(value, 4000);
  });

  if (mode === "create") {
    campos.tipoDocumento = campos.tipoDocumento ?? "factura";
    campos.moneda = campos.moneda ?? "DOP";
    campos.estado = campos.estado ?? "recibida";
  }
  return { campos, estadoExplicito };
}

function unirObservacion(propia: string | null, aviso: string | null): string | null {
  if (!aviso) {
    return propia;
  }
  if (!propia) {
    return aviso;
  }
  if (propia.includes(aviso)) {
    return propia;
  }
  return `${propia} ${aviso}`;
}

export function leerCatalogoRef(raw: Record<string, unknown>, donde: string): FacturaCatalogoRef {
  const idKeys = ["productoId", "producto_id", "catalogoId"];
  const codeKeys = ["codigoOdoo", "codigo_odoo", "codigoCatalogo", "codigo_catalogo"];
  const hasId = idKeys.some((key) => Object.prototype.hasOwnProperty.call(raw, key));
  const hasCode = codeKeys.some((key) => Object.prototype.hasOwnProperty.call(raw, key));
  if (!hasId && !hasCode) {
    return { accion: "omitir" };
  }
  if (hasId) {
    const value = pick(raw, idKeys);
    if (value == null || value === "") {
      return { accion: "quitar" };
    }
    if (typeof value !== "string" || !isUuid(value.trim())) {
      throw new Error(`${donde}: productoId tiene que ser el id del producto en el catálogo`);
    }
    return { accion: "id", id: value.trim() };
  }
  const value = pick(raw, codeKeys);
  if (value == null || value === "") {
    return { accion: "quitar" };
  }
  const codigo = textOrNull(value, 80);
  if (!codigo) {
    return { accion: "quitar" };
  }
  return { accion: "codigo", codigo };
}

export function leerLinea(raw: Record<string, unknown>, index: number): FacturaLineaInput {
  const donde = `La línea ${index + 1}`;
  const numeroRaw = pick(raw, ["numeroLinea", "numero_linea", "numero", "linea"]);
  let numeroLinea = index + 1;
  if (numeroRaw != null && numeroRaw !== "") {
    const numero = typeof numeroRaw === "number" ? numeroRaw : Number(String(numeroRaw).trim());
    if (!Number.isInteger(numero) || numero < 1 || numero > 500) {
      throw new Error(`${donde} tiene un número de línea inválido`);
    }
    numeroLinea = numero;
  }
  const descripcionOriginal = textOrNull(pick(raw, ["descripcionOriginal", "descripcion_original", "descripcion", "texto"]), 500);
  const codigoSku = textOrNull(pick(raw, ["codigoSku", "codigo_sku", "codigo", "sku"]), 80);
  if (!descripcionOriginal && !codigoSku) {
    throw new Error(`${donde} necesita la descripción original o el código`);
  }
  const presentacionRaw = pick(raw, ["presentacion", "presentacionCompra", "presentacion_compra"]);
  const presentacion = presentacionRaw == null || presentacionRaw === "" ? null : parsePresentacion(presentacionRaw);
  if (presentacionRaw != null && presentacionRaw !== "" && !presentacion) {
    throw new Error(`${donde} tiene una presentación inválida. Usa unidad, paquete, caja, fardo u otro`);
  }
  const unidades = resolverUnidades({
    presentacion,
    cantidadComprada: requireCantidad(pick(raw, ["cantidadComprada", "cantidad_comprada", "cantidad"]), `${donde}: la cantidad`),
    unidadesPorPresentacion: requireCantidad(
      pick(raw, ["unidadesPorPresentacion", "unidades_por_presentacion", "unidadesPorCaja", "unidadesPresentacion"]),
      `${donde}: las unidades por presentación`
    ),
    unidadesTotales: requireCantidad(pick(raw, ["unidadesTotales", "unidades_totales", "unidades"]), `${donde}: las unidades totales`),
    costoPorPresentacion: requireMoney(pick(raw, ["costoPorPresentacion", "costo_por_presentacion", "costo", "costoPresentacion"]), `${donde}: el costo`),
    costoUnitario: requireMoney(pick(raw, ["costoUnitario", "costo_unitario", "costoUnidad"]), `${donde}: el costo unitario`),
  });
  const estadoRaw = pick(raw, ["estadoLinea", "estado_linea", "estado"]);
  const estado = estadoRaw == null || estadoRaw === "" ? "pendiente" : parseEstadoLinea(estadoRaw);
  if (!estado) {
    throw new Error(`${donde} tiene un estado inválido. Usa completa, ambigua, ilegible o pendiente`);
  }
  const itbisRaw = pick(raw, ["precioIncluyeItbis", "precio_incluye_itbis", "incluyeItbis"]);
  const precioIncluyeItbis = itbisRaw == null || itbisRaw === "" ? "no_determinado" : parseItbisLinea(itbisRaw);
  if (!precioIncluyeItbis) {
    throw new Error(`${donde}: precioIncluyeItbis tiene que ser si, no o no_determinado`);
  }
  return {
    numeroLinea,
    codigoSku,
    codigoBarras: textOrNull(pick(raw, ["codigoBarras", "codigo_barras", "barras", "ean"]), 40),
    descripcionOriginal,
    productoNormalizado: textOrNull(pick(raw, ["productoNormalizado", "producto_normalizado", "producto", "nombreNormalizado"]), 200),
    marca: textOrNull(pick(raw, ["marca"]), 120),
    variante: textOrNull(pick(raw, ["variante"]), 120),
    tamano: textOrNull(pick(raw, ["tamano", "tamaño", "size"]), 80),
    presentacion,
    cantidadComprada: requireCantidad(pick(raw, ["cantidadComprada", "cantidad_comprada", "cantidad"]), `${donde}: la cantidad`),
    unidadesPorPresentacion: unidades.unidadesPorPresentacion,
    unidadesTotales: unidades.unidadesTotales,
    costoPorPresentacion: requireMoney(pick(raw, ["costoPorPresentacion", "costo_por_presentacion", "costo", "costoPresentacion"]), `${donde}: el costo`),
    costoUnitario: unidades.costoUnitario,
    descuentoLinea: requireMoney(pick(raw, ["descuentoLinea", "descuento_linea", "descuento"]), `${donde}: el descuento`),
    itbisLinea: requireMoney(pick(raw, ["itbisLinea", "itbis_linea", "itbis"]), `${donde}: el ITBIS`),
    precioIncluyeItbis,
    subtotalLinea: requireMoney(pick(raw, ["subtotalLinea", "subtotal_linea", "subtotal"]), `${donde}: el subtotal`),
    totalLinea: requireMoney(pick(raw, ["totalLinea", "total_linea", "total"]), `${donde}: el total`),
    estado,
    observacion: unirObservacion(textOrNull(pick(raw, ["observacion", "observaciones"]), 1000), unidades.aviso),
    catalogo: leerCatalogoRef(raw, donde),
  };
}

export function leerLineas(value: unknown): FacturaLineaInput[] {
  if (value == null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error("Las líneas tienen que ser una lista");
  }
  const lineas = value.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`La línea ${index + 1} tiene que ser un objeto`);
    }
    return leerLinea(item as Record<string, unknown>, index);
  });
  const numeros = new Set<number>();
  for (const linea of lineas) {
    if (numeros.has(linea.numeroLinea)) {
      throw new Error(`La línea ${linea.numeroLinea} está repetida`);
    }
    numeros.add(linea.numeroLinea);
  }
  return lineas;
}

export function leerValidacion(raw: Record<string, unknown>, index: number): FacturaValidacionInput {
  const codigo = parseValidacionCodigo(pick(raw, ["codigo", "id", "validacion"]));
  if (!codigo) {
    throw new Error(`La validación ${index + 1} no tiene un codigo conocido`);
  }
  const resultadoRaw = pick(raw, ["resultado"]);
  const resultado = resultadoRaw == null || resultadoRaw === "" ? "pendiente" : parseResultado(resultadoRaw);
  if (!resultado) {
    throw new Error(`La validación ${labelOf(FACTURA_VALIDACIONES, codigo)} tiene un resultado inválido. Usa correcto, diferencia, pendiente o no_aplica`);
  }
  return {
    codigo,
    resultado,
    explicacion: textOrNull(pick(raw, ["explicacion", "explicación", "detalle"]), 2000),
    revisadoEn: requireFechaHora(pick(raw, ["revisadoEn", "revisado_en", "fecha"]), "La fecha de revisión"),
  };
}

export function leerValidaciones(value: unknown): FacturaValidacionInput[] {
  if (value == null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error("Las validaciones tienen que ser una lista");
  }
  const seen = new Set<string>();
  return value.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`La validación ${index + 1} tiene que ser un objeto`);
    }
    const validacion = leerValidacion(item as Record<string, unknown>, index);
    if (seen.has(validacion.codigo)) {
      throw new Error(`La validación ${labelOf(FACTURA_VALIDACIONES, validacion.codigo)} está repetida`);
    }
    seen.add(validacion.codigo);
    return validacion;
  });
}

export function leerPregunta(raw: Record<string, unknown>, index: number): FacturaPreguntaInput {
  const pregunta = textOrNull(pick(raw, ["pregunta"]), 2000);
  if (!pregunta) {
    throw new Error(`La pregunta ${index + 1} está vacía`);
  }
  const respuesta = textOrNull(pick(raw, ["respuesta"]), 4000);
  const estadoRaw = pick(raw, ["estado"]);
  let estado: FacturaPreguntaEstado;
  if (estadoRaw == null || estadoRaw === "") {
    estado = respuesta ? "resuelta" : "abierta";
  } else {
    const parsed = parsePreguntaEstado(estadoRaw);
    if (!parsed) {
      throw new Error(`La pregunta ${index + 1} tiene un estado inválido. Usa abierta o resuelta`);
    }
    estado = parsed;
  }
  const lineaRaw = pick(raw, ["lineaNumero", "linea_numero", "numeroLinea"]);
  let lineaNumero: number | null = null;
  if (lineaRaw != null && lineaRaw !== "") {
    const numero = typeof lineaRaw === "number" ? lineaRaw : Number(String(lineaRaw).trim());
    if (!Number.isInteger(numero) || numero < 1) {
      throw new Error(`La pregunta ${index + 1} apunta a una línea inválida`);
    }
    lineaNumero = numero;
  }
  const idRaw = pick(raw, ["id", "preguntaId"]);
  const id = typeof idRaw === "string" && isUuid(idRaw.trim()) ? idRaw.trim() : null;
  return {
    id,
    lineaNumero,
    campo: textOrNull(pick(raw, ["campo", "producto"]), 200),
    pregunta,
    consultadoA: textOrNull(pick(raw, ["consultadoA", "consultado_a", "consultado"]), 160),
    respuesta,
    respondidoPor: textOrNull(pick(raw, ["respondidoPor", "respondido_por"]), 160),
    respondidoEn: requireFechaHora(pick(raw, ["respondidoEn", "respondido_en"]), "La fecha de respuesta"),
    evidencia: textOrNull(pick(raw, ["evidencia"]), 2000),
    estado,
  };
}

export function leerPreguntas(value: unknown): FacturaPreguntaInput[] {
  if (value == null) {
    return [];
  }
  const list = Array.isArray(value) ? value : [value];
  return list.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`La pregunta ${index + 1} tiene que ser un objeto`);
    }
    return leerPregunta(item as Record<string, unknown>, index);
  });
}

export function facturaTieneIdentidad(campos: FacturaCampos, lineas: number, documentos: number): boolean {
  return Boolean(campos.proveedor || campos.ncf || campos.numeroFactura || campos.tienda || lineas > 0 || documentos > 0);
}

export type FacturaRespuestaInput = {
  respuesta: string;
  respondidoPor: string | null;
  evidencia: string | null;
  estado: FacturaPreguntaEstado;
  respondidoEn: string;
};

export function leerRespuestaPregunta(body: Record<string, unknown>): FacturaRespuestaInput {
  const respuesta = textOrNull(pick(body, ["respuesta"]), 4000);
  if (!respuesta) {
    throw new Error("La respuesta está vacía");
  }
  const estadoRaw = pick(body, ["estado"]);
  const estado = estadoRaw == null || estadoRaw === "" ? "resuelta" : parsePreguntaEstado(estadoRaw);
  if (!estado) {
    throw new Error("El estado de la pregunta tiene que ser abierta o resuelta");
  }
  const respondidoEn = requireFechaHora(pick(body, ["respondidoEn", "respondido_en"]), "La fecha de respuesta") ?? new Date().toISOString();
  return {
    respuesta,
    respondidoPor: textOrNull(pick(body, ["respondidoPor", "respondido_por"]), 160),
    evidencia: textOrNull(pick(body, ["evidencia"]), 2000),
    estado,
    respondidoEn,
  };
}
