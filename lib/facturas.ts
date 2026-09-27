import { borrarArchivos, guardarDocumentos, type DocumentoEntrada } from "@/lib/factura-documentos";
import {
  FACTURA_CONDICIONES,
  FACTURA_ESTADOS,
  FACTURA_ESTADOS_LINEA,
  FACTURA_ITBIS_LINEA,
  FACTURA_PRESENTACIONES,
  FACTURA_PREGUNTA_ESTADOS,
  FACTURA_RESULTADOS,
  FACTURA_TIPOS,
  FACTURA_VALIDACIONES,
  buscarDuplicado,
  completarValidaciones,
  explicacionDuplicado,
  facturaTieneIdentidad,
  isUuid,
  labelOf,
  leerCamposFactura,
  leerLineas,
  leerPreguntas,
  leerRespuestaPregunta,
  leerValidaciones,
  mensajeEstadoInvalido,
  normalizeToken,
  parseClave,
  parseEstado,
  referenciaFactura,
  type DuplicadoCandidato,
  type FacturaCampos,
  type FacturaCatalogoRef,
  type FacturaDetalle,
  type FacturaDocumento,
  type FacturaEstadoLinea,
  type FacturaItbisLinea,
  type FacturaLinea,
  type FacturaLineaInput,
  type FacturaMoneda,
  type FacturaProductoCatalogo,
  type FacturaPregunta,
  type FacturaPreguntaInput,
  type FacturaPresentacion,
  type FacturaResumen,
  type FacturaValidacion,
  type FacturaValidacionInput,
  type FacturasResumen,
} from "@/lib/facturas-shared";
import { isDayKey } from "@/lib/local-day";
import { getSupabaseAdminClient } from "@/lib/supabase";

const LIST_MAX = 500;

const FACTURA_SELECT =
  "id, clave, recibido_en, enviado_por, tienda, tipo_documento, proveedor, rnc, ncf, numero_factura, fecha_emision, fecha_vencimiento, condicion, metodo_pago, moneda, subtotal, descuento_total, itbis_total, otros_cargos, total, numero_productos, numero_documentos, estado, observaciones, posible_duplicado, duplicado_de, preguntas_abiertas, updated_at";

export type FacturaFiltro = {
  q?: string | null;
  estado?: string | null;
  tienda?: string | null;
  pendientes?: boolean;
  duplicados?: boolean;
  sinFoto?: boolean;
};

function textOrNull(value: unknown, max = 4000): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const text = value.trim().slice(0, max);
  return text || null;
}

function num(value: unknown): number | null {
  if (value == null || value === "") {
    return null;
  }
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function int(value: unknown): number {
  const number = num(value);
  return number == null ? 0 : Math.max(0, Math.round(number));
}

function day(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const key = value.slice(0, 10);
  return isDayKey(key) ? key : null;
}

function iso(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "23505");
}

function hasKey(body: Record<string, unknown>, keys: string[]): boolean {
  return keys.some((key) => Object.prototype.hasOwnProperty.call(body, key));
}

function mapResumen(row: Record<string, unknown>, duplicadoReferencia: string | null = null): FacturaResumen | null {
  const id = String(row.id ?? "");
  const estado = parseEstado(row.estado);
  const tipoDocumento = FACTURA_TIPOS.some((item) => item.id === row.tipo_documento) ? (row.tipo_documento as FacturaResumen["tipoDocumento"]) : null;
  const moneda: FacturaMoneda | null = row.moneda === "USD" || row.moneda === "EUR" || row.moneda === "DOP" ? row.moneda : null;
  const recibidoEn = iso(row.recibido_en);
  if (!id || !estado || !tipoDocumento || !moneda || !recibidoEn) {
    return null;
  }
  const condicion = FACTURA_CONDICIONES.some((item) => item.id === row.condicion) ? (row.condicion as NonNullable<FacturaResumen["condicion"]>) : null;
  const proveedor = textOrNull(row.proveedor, 200);
  const fechaEmision = day(row.fecha_emision);
  const total = num(row.total);
  const tienda = textOrNull(row.tienda, 160);
  const numeroDocumentos = int(row.numero_documentos);
  const resumen: FacturaResumen = {
    id,
    clave: textOrNull(row.clave, 80),
    referencia: "",
    recibidoEn,
    enviadoPor: textOrNull(row.enviado_por, 160),
    tienda,
    tipoDocumento,
    tipoDocumentoLabel: labelOf(FACTURA_TIPOS, tipoDocumento),
    proveedor,
    rnc: textOrNull(row.rnc, 20),
    ncf: textOrNull(row.ncf, 20),
    numeroFactura: textOrNull(row.numero_factura, 80),
    fechaEmision,
    fechaVencimiento: day(row.fecha_vencimiento),
    condicion,
    condicionLabel: condicion ? labelOf(FACTURA_CONDICIONES, condicion) : null,
    metodoPago: textOrNull(row.metodo_pago, 80),
    moneda,
    subtotal: num(row.subtotal),
    descuentoTotal: num(row.descuento_total),
    itbisTotal: num(row.itbis_total),
    otrosCargos: num(row.otros_cargos),
    total,
    numeroProductos: int(row.numero_productos),
    numeroDocumentos,
    tieneFoto: numeroDocumentos > 0,
    estado,
    estadoLabel: labelOf(FACTURA_ESTADOS, estado),
    estadoAyuda: FACTURA_ESTADOS.find((item) => item.id === estado)?.ayuda ?? "",
    observaciones: textOrNull(row.observaciones, 4000),
    posibleDuplicado: row.posible_duplicado === true,
    duplicadoReferencia,
    preguntasAbiertas: int(row.preguntas_abiertas),
    actualizadoEn: iso(row.updated_at) ?? recibidoEn,
  };
  resumen.referencia = referenciaFactura(resumen);
  return resumen;
}

function mapLinea(row: Record<string, unknown>): FacturaLinea | null {
  const id = String(row.id ?? "");
  const numeroLinea = int(row.numero_linea);
  const estado = FACTURA_ESTADOS_LINEA.some((item) => item.id === row.estado) ? (row.estado as FacturaEstadoLinea) : null;
  const itbis = FACTURA_ITBIS_LINEA.some((item) => item.id === row.precio_incluye_itbis) ? (row.precio_incluye_itbis as FacturaItbisLinea) : "no_determinado";
  const presentacion = FACTURA_PRESENTACIONES.some((item) => item.id === row.presentacion) ? (row.presentacion as FacturaPresentacion) : null;
  if (!id || !estado || numeroLinea < 1) {
    return null;
  }
  return {
    id,
    numeroLinea,
    codigoSku: textOrNull(row.codigo_sku, 80),
    codigoBarras: textOrNull(row.codigo_barras, 40),
    descripcionOriginal: textOrNull(row.descripcion_original, 500),
    productoNormalizado: textOrNull(row.producto_normalizado, 200),
    marca: textOrNull(row.marca, 120),
    variante: textOrNull(row.variante, 120),
    tamano: textOrNull(row.tamano, 80),
    presentacion,
    presentacionLabel: presentacion ? labelOf(FACTURA_PRESENTACIONES, presentacion) : null,
    cantidadComprada: num(row.cantidad_comprada),
    unidadesPorPresentacion: num(row.unidades_por_presentacion),
    unidadesTotales: num(row.unidades_totales),
    costoPorPresentacion: num(row.costo_por_presentacion),
    costoUnitario: num(row.costo_unitario),
    descuentoLinea: num(row.descuento_linea),
    itbisLinea: num(row.itbis_linea),
    precioIncluyeItbis: itbis,
    precioIncluyeItbisLabel: labelOf(FACTURA_ITBIS_LINEA, itbis),
    subtotalLinea: num(row.subtotal_linea),
    totalLinea: num(row.total_linea),
    estado,
    estadoLabel: labelOf(FACTURA_ESTADOS_LINEA, estado),
    observacion: textOrNull(row.observacion, 1000),
    productoId: typeof row.producto_id === "string" && isUuid(row.producto_id) ? row.producto_id : null,
    productoCatalogo: null,
  };
}

function mapValidacion(row: Record<string, unknown>): FacturaValidacion | null {
  const codigo = FACTURA_VALIDACIONES.find((item) => item.id === row.codigo);
  const resultado = FACTURA_RESULTADOS.find((item) => item.id === row.resultado);
  if (!codigo || !resultado) {
    return null;
  }
  return {
    codigo: codigo.id,
    codigoLabel: codigo.label,
    resultado: resultado.id,
    resultadoLabel: resultado.label,
    explicacion: textOrNull(row.explicacion, 2000),
    revisadoEn: iso(row.revisado_en),
  };
}

function mapPregunta(row: Record<string, unknown>): FacturaPregunta | null {
  const id = String(row.id ?? "");
  const pregunta = textOrNull(row.pregunta, 2000);
  const estado = FACTURA_PREGUNTA_ESTADOS.some((item) => item.id === row.estado) ? (row.estado as FacturaPregunta["estado"]) : null;
  const creadoEn = iso(row.created_at);
  if (!id || !pregunta || !estado || !creadoEn) {
    return null;
  }
  const lineaNumero = num(row.linea_numero);
  return {
    id,
    lineaNumero: lineaNumero != null && Number.isInteger(lineaNumero) ? lineaNumero : null,
    campo: textOrNull(row.campo, 200),
    pregunta,
    consultadoA: textOrNull(row.consultado_a, 160),
    respuesta: textOrNull(row.respuesta, 4000),
    respondidoPor: textOrNull(row.respondido_por, 160),
    respondidoEn: iso(row.respondido_en),
    evidencia: textOrNull(row.evidencia, 2000),
    estado,
    estadoLabel: labelOf(FACTURA_PREGUNTA_ESTADOS, estado),
    creadoEn,
  };
}

function mapDocumento(row: Record<string, unknown>): FacturaDocumento | null {
  const id = String(row.id ?? "");
  const mime = typeof row.mime === "string" ? row.mime : "";
  const creadoEn = iso(row.created_at);
  if (!id || !mime || !creadoEn) {
    return null;
  }
  const pagina = num(row.pagina);
  return {
    id,
    nombre: textOrNull(row.nombre, 180),
    mime,
    pagina: pagina != null && Number.isInteger(pagina) ? pagina : null,
    esImagen: mime.startsWith("image/"),
    creadoEn,
  };
}

function headerRow(campos: FacturaCampos): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const set = (column: string, value: unknown) => {
    if (value !== undefined) {
      row[column] = value;
    }
  };
  set("clave", campos.clave);
  set("recibido_en", campos.recibidoEn);
  set("enviado_por", campos.enviadoPor);
  set("tienda", campos.tienda);
  set("tipo_documento", campos.tipoDocumento);
  set("proveedor", campos.proveedor);
  set("rnc", campos.rnc);
  set("ncf", campos.ncf);
  set("numero_factura", campos.numeroFactura);
  set("fecha_emision", campos.fechaEmision);
  set("fecha_vencimiento", campos.fechaVencimiento);
  set("condicion", campos.condicion);
  set("metodo_pago", campos.metodoPago);
  set("moneda", campos.moneda);
  set("subtotal", campos.subtotal);
  set("descuento_total", campos.descuentoTotal);
  set("itbis_total", campos.itbisTotal);
  set("otros_cargos", campos.otrosCargos);
  set("total", campos.total);
  set("estado", campos.estado);
  set("observaciones", campos.observaciones);
  return row;
}

function lineaRow(facturaId: string, linea: FacturaLineaInput): Record<string, unknown> {
  return {
    factura_id: facturaId,
    numero_linea: linea.numeroLinea,
    codigo_sku: linea.codigoSku,
    codigo_barras: linea.codigoBarras,
    descripcion_original: linea.descripcionOriginal,
    producto_normalizado: linea.productoNormalizado,
    marca: linea.marca,
    variante: linea.variante,
    tamano: linea.tamano,
    presentacion: linea.presentacion,
    cantidad_comprada: linea.cantidadComprada,
    unidades_por_presentacion: linea.unidadesPorPresentacion,
    unidades_totales: linea.unidadesTotales,
    costo_por_presentacion: linea.costoPorPresentacion,
    costo_unitario: linea.costoUnitario,
    descuento_linea: linea.descuentoLinea,
    itbis_linea: linea.itbisLinea,
    precio_incluye_itbis: linea.precioIncluyeItbis,
    subtotal_linea: linea.subtotalLinea,
    total_linea: linea.totalLinea,
    estado: linea.estado,
    observacion: linea.observacion,
  };
}

async function findFacturaId(idOrClave: string): Promise<string | null> {
  const supabase = getSupabaseAdminClient();
  const token = idOrClave.trim();
  if (isUuid(token)) {
    const { data, error } = await supabase.from("facturas").select("id").eq("id", token).maybeSingle();
    if (error) {
      throw error;
    }
    if (data?.id) {
      return String(data.id);
    }
  }
  const clave = parseClave(token);
  if (!clave.ok) {
    throw new Error(clave.message);
  }
  if (!clave.clave) {
    return null;
  }
  const { data, error } = await supabase.from("facturas").select("id").eq("clave", clave.clave).maybeSingle();
  if (error) {
    throw error;
  }
  return data?.id ? String(data.id) : null;
}

async function requireFacturaId(idOrClave: string): Promise<string> {
  const id = await findFacturaId(idOrClave);
  if (!id) {
    throw new Error("No encontramos esa factura");
  }
  return id;
}

async function syncCounters(id: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const [lineas, preguntas, documentos] = await Promise.all([
    supabase.from("factura_lineas").select("id", { count: "exact", head: true }).eq("factura_id", id),
    supabase.from("factura_preguntas").select("id", { count: "exact", head: true }).eq("factura_id", id).eq("estado", "abierta"),
    supabase.from("factura_documentos").select("id", { count: "exact", head: true }).eq("factura_id", id),
  ]);
  if (lineas.error) {
    throw lineas.error;
  }
  if (preguntas.error) {
    throw preguntas.error;
  }
  if (documentos.error) {
    throw documentos.error;
  }
  const { error } = await supabase
    .from("facturas")
    .update({
      numero_productos: lineas.count ?? 0,
      preguntas_abiertas: preguntas.count ?? 0,
      numero_documentos: documentos.count ?? 0,
    })
    .eq("id", id);
  if (error) {
    throw error;
  }
}

async function candidatosDuplicado(factura: FacturaResumen): Promise<DuplicadoCandidato[]> {
  const supabase = getSupabaseAdminClient();
  const select = "id, proveedor, ncf, numero_factura, fecha_emision, total, tienda, moneda";
  const rows: Record<string, unknown>[] = [];
  if (factura.ncf) {
    const { data, error } = await supabase.from("facturas").select(select).eq("ncf", factura.ncf).neq("id", factura.id).limit(8);
    if (error) {
      throw error;
    }
    rows.push(...(data ?? []));
  }
  if (factura.proveedor && factura.numeroFactura && factura.fechaEmision) {
    const { data, error } = await supabase
      .from("facturas")
      .select(select)
      .ilike("proveedor", factura.proveedor)
      .eq("numero_factura", factura.numeroFactura)
      .eq("fecha_emision", factura.fechaEmision)
      .neq("id", factura.id)
      .limit(8);
    if (error) {
      throw error;
    }
    rows.push(...(data ?? []));
  }
  const seen = new Set<string>();
  const candidatos: DuplicadoCandidato[] = [];
  for (const row of rows) {
    const id = String(row.id ?? "");
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    candidatos.push({
      id,
      proveedor: textOrNull(row.proveedor, 200),
      ncf: textOrNull(row.ncf, 20),
      numeroFactura: textOrNull(row.numero_factura, 80),
      fechaEmision: day(row.fecha_emision),
      total: num(row.total),
      tienda: textOrNull(row.tienda, 160),
      moneda: typeof row.moneda === "string" ? row.moneda : "DOP",
    });
  }
  return candidatos;
}

async function guardarValidacion(facturaId: string, validacion: FacturaValidacionInput): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("factura_validaciones").upsert(
    {
      factura_id: facturaId,
      codigo: validacion.codigo,
      resultado: validacion.resultado,
      explicacion: validacion.explicacion,
      revisado_en: validacion.revisadoEn ?? new Date().toISOString(),
    },
    { onConflict: "factura_id,codigo" }
  );
  if (error) {
    throw error;
  }
}

async function revisarDuplicado(id: string, estadoExplicito: boolean): Promise<void> {
  const actual = await loadResumen(id);
  if (!actual) {
    return;
  }
  const match = buscarDuplicado(actual, await candidatosDuplicado(actual));
  const supabase = getSupabaseAdminClient();
  if (!match) {
    const { error } = await supabase.from("facturas").update({ posible_duplicado: actual.estado === "posible_duplicado", duplicado_de: null }).eq("id", id);
    if (error) {
      throw error;
    }
    return;
  }
  const referencia = referenciaFactura({
    proveedor: match.candidato.proveedor,
    fechaEmision: match.candidato.fechaEmision,
    total: match.candidato.total,
    moneda: match.candidato.moneda,
    tienda: match.candidato.tienda,
  });
  const nextEstado = !estadoExplicito && (actual.estado === "recibida" || actual.estado === "en_analisis") ? "posible_duplicado" : actual.estado;
  const { error } = await supabase
    .from("facturas")
    .update({ posible_duplicado: true, duplicado_de: match.candidato.id, estado: nextEstado })
    .eq("id", id);
  if (error) {
    throw error;
  }
  await guardarValidacion(id, {
    codigo: "posible_duplicado",
    resultado: "diferencia",
    explicacion: explicacionDuplicado(match.motivo, referencia),
    revisadoEn: new Date().toISOString(),
  });
  const { error: otherError } = await supabase.from("facturas").update({ posible_duplicado: true }).eq("id", match.candidato.id);
  if (otherError) {
    throw otherError;
  }
}

async function loadResumen(id: string): Promise<FacturaResumen | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("facturas").select(FACTURA_SELECT).eq("id", id).maybeSingle();
  if (error) {
    throw error;
  }
  return data ? mapResumen(data as Record<string, unknown>) : null;
}

async function duplicadoReferenciaDe(duplicadoDe: unknown): Promise<string | null> {
  if (typeof duplicadoDe !== "string" || !isUuid(duplicadoDe)) {
    return null;
  }
  const otro = await loadResumen(duplicadoDe);
  return otro?.referencia ?? null;
}

async function buscarProductoCatalogo(ref: Exclude<FacturaCatalogoRef, { accion: "omitir" | "quitar" }>): Promise<string> {
  const supabase = getSupabaseAdminClient();
  if (ref.accion === "id") {
    const { data, error } = await supabase.from("products").select("id").eq("id", ref.id).maybeSingle();
    if (error) {
      throw error;
    }
    if (!data?.id) {
      throw new Error("No encontramos ese producto en el catálogo");
    }
    return String(data.id);
  }
  const codigo = ref.codigo.trim();
  const porCodigo = await supabase.from("products").select("id").eq("codigo_odoo", codigo).limit(2);
  if (porCodigo.error) {
    throw porCodigo.error;
  }
  const porBarras = porCodigo.data?.length
    ? porCodigo
    : await supabase.from("products").select("id").eq("codigo_barras", codigo).limit(2);
  if (porBarras.error) {
    throw porBarras.error;
  }
  const matches = porBarras.data ?? [];
  if (matches.length > 1) {
    throw new Error("Hay más de un producto con ese código. Manda productoId");
  }
  if (!matches[0]?.id) {
    throw new Error("No encontramos ese producto en el catálogo");
  }
  return String(matches[0].id);
}

async function productoIdDeLinea(linea: FacturaLineaInput, actuales: Map<number, string | null>): Promise<string | null> {
  if (linea.catalogo.accion === "omitir") {
    return actuales.get(linea.numeroLinea) ?? null;
  }
  if (linea.catalogo.accion === "quitar") {
    return null;
  }
  return buscarProductoCatalogo(linea.catalogo);
}

async function upsertLineas(id: string, lineas: FacturaLineaInput[], reemplazar: boolean): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (reemplazar) {
    if (!lineas.length) {
      const { error } = await supabase.from("factura_lineas").delete().eq("factura_id", id);
      if (error) {
        throw error;
      }
      return;
    }
    const numeros = lineas.map((linea) => linea.numeroLinea);
    const { error } = await supabase.from("factura_lineas").delete().eq("factura_id", id).not("numero_linea", "in", `(${numeros.join(",")})`);
    if (error) {
      throw error;
    }
  }
  if (!lineas.length) {
    return;
  }
  const actuales = new Map<number, string | null>();
  const { data: existentes, error: existentesError } = await supabase.from("factura_lineas").select("numero_linea, producto_id").eq("factura_id", id);
  if (existentesError) {
    throw existentesError;
  }
  for (const row of existentes ?? []) {
    const numero = int((row as { numero_linea?: unknown }).numero_linea);
    const productoId = (row as { producto_id?: unknown }).producto_id;
    actuales.set(numero, typeof productoId === "string" && isUuid(productoId) ? productoId : null);
  }
  const rows = [];
  for (const linea of lineas) {
    rows.push({
      ...lineaRow(id, linea),
      producto_id: await productoIdDeLinea(linea, actuales),
    });
  }
  const { error } = await supabase.from("factura_lineas").upsert(rows, { onConflict: "factura_id,numero_linea" });
  if (error) {
    throw error;
  }
}

async function savePreguntas(id: string, preguntas: FacturaPreguntaInput[]): Promise<void> {
  const supabase = getSupabaseAdminClient();
  for (const pregunta of preguntas) {
    const respondidoEn = pregunta.respondidoEn ?? (pregunta.estado === "resuelta" ? new Date().toISOString() : null);
    const row = {
      linea_numero: pregunta.lineaNumero,
      campo: pregunta.campo,
      pregunta: pregunta.pregunta,
      consultado_a: pregunta.consultadoA,
      respuesta: pregunta.respuesta,
      respondido_por: pregunta.respondidoPor,
      respondido_en: respondidoEn,
      evidencia: pregunta.evidencia,
      estado: pregunta.estado,
    };
    if (pregunta.id) {
      const { data, error } = await supabase.from("factura_preguntas").update(row).eq("id", pregunta.id).eq("factura_id", id).select("id").maybeSingle();
      if (error) {
        throw error;
      }
      if (!data) {
        throw new Error("No encontramos esa pregunta");
      }
      continue;
    }
    const { data: abiertas, error: listError } = await supabase
      .from("factura_preguntas")
      .select("id, pregunta, campo")
      .eq("factura_id", id)
      .eq("estado", "abierta");
    if (listError) {
      throw listError;
    }
    const misma = (abiertas ?? []).find((item) => {
      const texto = typeof item.pregunta === "string" ? normalizeToken(item.pregunta) : "";
      const campo = typeof item.campo === "string" ? item.campo : "";
      return texto === normalizeToken(pregunta.pregunta) && campo === (pregunta.campo ?? "");
    });
    if (misma?.id) {
      const { error } = await supabase.from("factura_preguntas").update(row).eq("id", misma.id);
      if (error) {
        throw error;
      }
      continue;
    }
    const { error } = await supabase.from("factura_preguntas").insert({ ...row, factura_id: id });
    if (error) {
      throw error;
    }
  }
}

export async function listFacturas(filtro: FacturaFiltro = {}): Promise<FacturaResumen[]> {
  const supabase = getSupabaseAdminClient();
  let query = supabase.from("facturas").select(FACTURA_SELECT).order("updated_at", { ascending: false }).limit(LIST_MAX);
  if (filtro.estado) {
    const estado = parseEstado(filtro.estado);
    if (!estado) {
      throw new Error(mensajeEstadoInvalido());
    }
    query = query.eq("estado", estado);
  }
  if (filtro.tienda?.trim()) {
    query = query.ilike("tienda", `%${filtro.tienda.trim()}%`);
  }
  if (filtro.pendientes) {
    query = query.gt("preguntas_abiertas", 0);
  }
  if (filtro.duplicados) {
    query = query.eq("posible_duplicado", true);
  }
  if (filtro.sinFoto) {
    query = query.eq("numero_documentos", 0);
  }
  const { data, error } = await query;
  if (error) {
    throw error;
  }
  const needle = filtro.q?.trim().toLowerCase() ?? "";
  return (data ?? [])
    .map((row) => mapResumen(row as Record<string, unknown>))
    .filter((row): row is FacturaResumen => Boolean(row))
    .filter((row) => {
      if (!needle) {
        return true;
      }
      return [row.proveedor, row.ncf, row.numeroFactura, row.tienda, row.enviadoPor, row.referencia, row.rnc].some((value) => value?.toLowerCase().includes(needle));
    });
}

export async function resumenFacturas(): Promise<FacturasResumen> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("facturas").select("estado, preguntas_abiertas, posible_duplicado, numero_documentos").limit(5000);
  if (error) {
    throw error;
  }
  const rows = data ?? [];
  return {
    total: rows.length,
    porEstado: FACTURA_ESTADOS.map((estado) => ({
      id: estado.id,
      label: estado.label,
      facturas: rows.filter((row) => row.estado === estado.id).length,
    })),
    preguntasAbiertas: rows.reduce((sum, row) => sum + int(row.preguntas_abiertas), 0),
    posiblesDuplicados: rows.filter((row) => row.posible_duplicado === true).length,
    sinFoto: rows.filter((row) => int(row.numero_documentos) === 0).length,
  };
}

async function adjuntarCatalogo(lineas: FacturaLinea[]): Promise<FacturaLinea[]> {
  const ids = Array.from(new Set(lineas.map((linea) => linea.productoId).filter((id): id is string => Boolean(id))));
  if (!ids.length) {
    return lineas;
  }
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("products").select("id, nombre, marca, codigo_odoo, codigo_barras").in("id", ids);
  if (error) {
    throw error;
  }
  const porId = new Map<string, FacturaProductoCatalogo>();
  for (const row of data ?? []) {
    const id = String((row as { id?: unknown }).id ?? "");
    const nombre = textOrNull((row as { nombre?: unknown }).nombre, 200);
    if (!id || !nombre) {
      continue;
    }
    porId.set(id, {
      id,
      nombre,
      marca: textOrNull((row as { marca?: unknown }).marca, 120),
      codigoOdoo: textOrNull((row as { codigo_odoo?: unknown }).codigo_odoo, 80),
      codigoBarras: textOrNull((row as { codigo_barras?: unknown }).codigo_barras, 40),
    });
  }
  return lineas.map((linea) => ({
    ...linea,
    productoCatalogo: linea.productoId ? porId.get(linea.productoId) ?? null : null,
  }));
}

export async function getFactura(idOrClave: string): Promise<FacturaDetalle | null> {
  const id = await findFacturaId(idOrClave);
  if (!id) {
    return null;
  }
  const supabase = getSupabaseAdminClient();
  const [header, lineas, validaciones, preguntas, documentos] = await Promise.all([
    supabase.from("facturas").select(FACTURA_SELECT).eq("id", id).maybeSingle(),
    supabase.from("factura_lineas").select("*").eq("factura_id", id).order("numero_linea", { ascending: true }),
    supabase.from("factura_validaciones").select("codigo, resultado, explicacion, revisado_en").eq("factura_id", id),
    supabase.from("factura_preguntas").select("*").eq("factura_id", id).order("created_at", { ascending: true }),
    supabase.from("factura_documentos").select("id, nombre, mime, pagina, created_at").eq("factura_id", id).order("pagina", { ascending: true }),
  ]);
  if (header.error) {
    throw header.error;
  }
  if (lineas.error) {
    throw lineas.error;
  }
  if (validaciones.error) {
    throw validaciones.error;
  }
  if (preguntas.error) {
    throw preguntas.error;
  }
  if (documentos.error) {
    throw documentos.error;
  }
  if (!header.data) {
    return null;
  }
  const headerRowData = header.data as Record<string, unknown>;
  const resumen = mapResumen(headerRowData, await duplicadoReferenciaDe(headerRowData.duplicado_de));
  if (!resumen) {
    return null;
  }
  const stored = (validaciones.data ?? [])
    .map((row) => mapValidacion(row as Record<string, unknown>))
    .filter((row): row is FacturaValidacion => Boolean(row));
  return {
    ...resumen,
    lineas: await adjuntarCatalogo(
      (lineas.data ?? []).map((row) => mapLinea(row as Record<string, unknown>)).filter((row): row is FacturaLinea => Boolean(row))
    ),
    validaciones: completarValidaciones(stored),
    preguntas: (preguntas.data ?? []).map((row) => mapPregunta(row as Record<string, unknown>)).filter((row): row is FacturaPregunta => Boolean(row)),
    documentos: (documentos.data ?? [])
      .map((row) => mapDocumento(row as Record<string, unknown>))
      .filter((row): row is FacturaDocumento => Boolean(row))
      .sort((a, b) => (a.pagina ?? 999) - (b.pagina ?? 999)),
  };
}

async function applyChildren(id: string, body: Record<string, unknown>, documentos: DocumentoEntrada[]): Promise<void> {
  if (hasKey(body, ["lineas", "productos"])) {
    const lineas = leerLineas(body.lineas ?? body.productos);
    await upsertLineas(id, lineas, body.reemplazarLineas === true || body.reemplazarProductos === true);
  }
  if (hasKey(body, ["validaciones"])) {
    for (const validacion of leerValidaciones(body.validaciones)) {
      await guardarValidacion(id, validacion);
    }
  }
  if (hasKey(body, ["preguntas"])) {
    await savePreguntas(id, leerPreguntas(body.preguntas));
  }
  if (documentos.length) {
    await guardarDocumentos(id, documentos);
  }
}

export async function createFactura(
  body: Record<string, unknown>,
  documentos: DocumentoEntrada[]
): Promise<{ creado: boolean; factura: FacturaDetalle }> {
  const { campos, estadoExplicito } = leerCamposFactura(body, "create");
  const lineas = hasKey(body, ["lineas", "productos"]) ? leerLineas(body.lineas ?? body.productos) : [];
  if (!facturaTieneIdentidad(campos, lineas.length, documentos.length)) {
    throw new Error("Manda el proveedor, el número, la tienda o la foto de la factura");
  }
  if (campos.clave) {
    const existing = await findFacturaId(campos.clave);
    if (existing) {
      if (documentos.length) {
        await guardarDocumentos(existing, documentos);
        await syncCounters(existing);
      }
      const factura = await getFactura(existing);
      if (!factura) {
        throw new Error("No encontramos esa factura");
      }
      return { creado: false, factura };
    }
  }
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("facturas").insert(headerRow(campos)).select("id").single();
  if (error) {
    if (isUniqueViolation(error) && campos.clave) {
      const existing = await findFacturaId(campos.clave);
      if (existing) {
        const factura = await getFactura(existing);
        if (factura) {
          return { creado: false, factura };
        }
      }
    }
    throw error;
  }
  const id = String(data.id);
  try {
    await applyChildren(id, { ...body, lineas: hasKey(body, ["lineas", "productos"]) ? body.lineas ?? body.productos : undefined }, documentos);
    await revisarDuplicado(id, estadoExplicito);
    await syncCounters(id);
  } catch (childError) {
    await borrarArchivosDeFactura(id);
    await supabase.from("facturas").delete().eq("id", id);
    throw childError;
  }
  const factura = await getFactura(id);
  if (!factura) {
    throw new Error("No encontramos esa factura");
  }
  return { creado: true, factura };
}

async function borrarArchivosDeFactura(id: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase.from("factura_documentos").select("storage_path").eq("factura_id", id);
  const paths = (data ?? []).map((row) => (typeof row.storage_path === "string" ? row.storage_path : "")).filter(Boolean);
  await borrarArchivos(paths);
}

export async function updateFactura(idOrClave: string, body: Record<string, unknown>, documentos: DocumentoEntrada[]): Promise<FacturaDetalle> {
  const id = await requireFacturaId(idOrClave);
  const { campos, estadoExplicito } = leerCamposFactura(body, "patch");
  const row = headerRow(campos);
  if (Object.keys(row).length) {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from("facturas").update(row).eq("id", id);
    if (error) {
      if (isUniqueViolation(error)) {
        throw new Error("Esa clave ya pertenece a otra factura");
      }
      throw error;
    }
  }
  await applyChildren(id, body, documentos);
  await revisarDuplicado(id, estadoExplicito);
  await syncCounters(id);
  const factura = await getFactura(id);
  if (!factura) {
    throw new Error("No encontramos esa factura");
  }
  return factura;
}

export async function asignarProductoLinea(idOrClave: string, lineaId: string, productoId: unknown): Promise<FacturaDetalle> {
  if (!isUuid(lineaId)) {
    throw new Error("No encontramos esa línea");
  }
  const facturaId = await requireFacturaId(idOrClave);
  let next: string | null = null;
  if (productoId != null && productoId !== "") {
    if (typeof productoId !== "string" || !isUuid(productoId.trim())) {
      throw new Error("El producto del catálogo no es válido");
    }
    next = await buscarProductoCatalogo({ accion: "id", id: productoId.trim() });
  }
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("factura_lineas").update({ producto_id: next }).eq("id", lineaId).eq("factura_id", facturaId).select("id").maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error("No encontramos esa línea");
  }
  await supabase.from("facturas").update({ updated_at: new Date().toISOString() }).eq("id", facturaId);
  const factura = await getFactura(facturaId);
  if (!factura) {
    throw new Error("No encontramos esa factura");
  }
  return factura;
}

export async function responderPregunta(idOrClave: string, preguntaId: string, body: Record<string, unknown>): Promise<FacturaDetalle> {
  if (!isUuid(preguntaId)) {
    throw new Error("No encontramos esa pregunta");
  }
  const id = await requireFacturaId(idOrClave);
  const respuesta = leerRespuestaPregunta(body);
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("factura_preguntas")
    .update({
      respuesta: respuesta.respuesta,
      respondido_por: respuesta.respondidoPor,
      evidencia: respuesta.evidencia,
      estado: respuesta.estado,
      respondido_en: respuesta.respondidoEn,
    })
    .eq("id", preguntaId)
    .eq("factura_id", id)
    .select("id")
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error("No encontramos esa pregunta");
  }
  await syncCounters(id);
  const factura = await getFactura(id);
  if (!factura) {
    throw new Error("No encontramos esa factura");
  }
  return factura;
}

export function filtroDesdeParams(params: URLSearchParams): FacturaFiltro {
  const flag = (name: string) => {
    const value = params.get(name);
    return value === "true" || value === "1";
  };
  return {
    q: params.get("q"),
    estado: params.get("estado"),
    tienda: params.get("tienda"),
    pendientes: flag("pendientes"),
    duplicados: flag("duplicados"),
    sinFoto: flag("sinFoto") || flag("sin_foto"),
  };
}
