import { publishAgentEvent } from "@/lib/agent-events";
import { dueDateFromCredit, type Proveedor } from "@/lib/admin-compras-shared";
import { findProveedorParaFactura, getProveedorById } from "@/lib/admin-compras";
import { getParametrosConfig } from "@/lib/admin-parametros";
import {
  SIN_PROPUESTA,
  aprenderAlias,
  aprenderVinculos,
  candidatosCatalogo,
  completarUnidades,
  lineasParaAceptar,
  proponerCatalogo,
  type Vinculo,
} from "@/lib/factura-catalogo";
import { borrarArchivos, guardarDocumentos, type DocumentoEntrada } from "@/lib/factura-documentos";
import { candidatosPago, pagosDe } from "@/lib/factura-pagos";
import {
  FACTURA_CONDICIONES,
  FACTURA_ESTADOS,
  FACTURA_ESTADOS_LINEA,
  FACTURA_ITBIS_LINEA,
  FACTURA_PRESENTACIONES,
  FACTURA_PREGUNTA_ESTADOS,
  FACTURA_PROPUESTA_ORIGENES,
  FACTURA_RECEPCIONES,
  FACTURA_RESULTADOS,
  FACTURA_TIPOS,
  FACTURA_VALIDACIONES,
  ALERTA_CANTIDAD_DEFECTO,
  ALERTA_PRECIO_DEFECTO,
  alertasLinea,
  medidaLinea,
  type MedidaLinea,
  buscarDuplicado,
  completarValidaciones,
  diferenciaPagos,
  diferenciaRecepcion,
  resumenRecepcion,
  explicacionDuplicado,
  facturaTieneIdentidad,
  isUuid,
  esCampoProducto,
  esCampoUnidades,
  estadoTrasLigue,
  labelOf,
  leerCamposFactura,
  leerLineas,
  leerPreguntas,
  leerRangoPropuestas,
  leerRespuestaPregunta,
  leerValidaciones,
  mensajeEstadoInvalido,
  normalizeToken,
  parseClave,
  ORIGENES_LIGUE,
  PROPUESTA_ACEPTAR_TODAS,
  parseEstado,
  referenciaFactura,
  resolverUnidades,
  textoConfirmacionUi,
  validacionesFiscales,
  type DuplicadoCandidato,
  type FacturaCampos,
  type FacturaCatalogoRef,
  type FacturaConciliacion,
  type FacturaDetalle,
  type FacturaDocumento,
  type FacturaEstadoLinea,
  type OrigenLigue,
  type FacturaItbisLinea,
  type FacturaLinea,
  type FacturaLineaCandidatos,
  type FacturaLineaInput,
  type FacturaMoneda,
  type FacturaNotaRef,
  type FacturaProductoCatalogo,
  type FacturaPregunta,
  type FacturaPreguntaInput,
  type FacturaPresentacion,
  type FacturaPropuestaOrigen,
  type FacturaProveedorFicha,
  type FacturaRecepcion,
  type FacturaListado,
  type FacturaResumen,
  type FacturaValidacion,
  type FacturaValidacionInput,
  type FacturaVerificacion,
  type FacturasResumen,
  FACTURAS_PAGE_SIZE,
} from "@/lib/facturas-shared";
import { validarCambioEstado, type Actor, type OperacionBot } from "@/lib/operacion-shared";
import { lineasSinCatalogo, pendientesDe, propuestasPorConfirmar, type Pendiente } from "@/lib/facturas-pendientes";
import { isDayKey } from "@/lib/local-day";
import { getSupabaseAdminClient } from "@/lib/supabase";

const LIST_MAX = 500;

const LIST_SELECT =
  "id, clave, recibido_en, enviado_por, tienda, tipo_documento, proveedor, rnc, ncf, numero_factura, fecha_emision, moneda, total, numero_documentos, estado, posible_duplicado, preguntas_abiertas, es_compra_personal, socio, problema, problema_dueno, problema_falta, updated_at";

const FACTURA_SELECT =
  "id, clave, recibido_en, enviado_por, tienda, tipo_documento, proveedor, proveedor_id, rnc, ncf, numero_factura, fecha_emision, fecha_vencimiento, condicion, metodo_pago, moneda, subtotal, descuento_total, itbis_total, otros_cargos, total, numero_productos, numero_documentos, estado, observaciones, posible_duplicado, duplicado_de, preguntas_abiertas, es_compra_personal, socio, confirmacion_texto, confirmacion_por, confirmacion_en, problema, problema_dueno, problema_desde, problema_falta, ledger_id, compra_id, factura_origen_id, updated_at";

export type FacturaFiltro = {
  q?: string | null;
  estado?: string | null;
  tienda?: string | null;
  pendientes?: boolean;
  duplicados?: boolean;
  sinFoto?: boolean;
  problema?: boolean;
  /** Problema, preguntas abiertas, posible duplicado o sin foto. */
  atencion?: boolean;
};

const ATENCION_OR = "problema.eq.true,preguntas_abiertas.gt.0,posible_duplicado.eq.true,numero_documentos.eq.0";

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
    proveedorId: typeof row.proveedor_id === "string" && isUuid(row.proveedor_id) ? row.proveedor_id : null,
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
    esCompraPersonal: row.es_compra_personal === true,
    socio: textOrNull(row.socio, 160),
    confirmacionTexto: textOrNull(row.confirmacion_texto, 4000),
    confirmacionPor: textOrNull(row.confirmacion_por, 160),
    confirmacionEn: iso(row.confirmacion_en),
    problema: row.problema === true,
    problemaDueno: textOrNull(row.problema_dueno, 40),
    problemaDesde: iso(row.problema_desde),
    problemaFalta: textOrNull(row.problema_falta, 2000),
    ledgerId: typeof row.ledger_id === "string" && isUuid(row.ledger_id) ? row.ledger_id : null,
    compraId: typeof row.compra_id === "string" && isUuid(row.compra_id) ? row.compra_id : null,
    facturaOrigenId: typeof row.factura_origen_id === "string" && isUuid(row.factura_origen_id) ? row.factura_origen_id : null,
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
  const recepcion: FacturaRecepcion = FACTURA_RECEPCIONES.find((item) => item.id === row.recepcion)?.id ?? "pendiente";
  const cantidadRecibida = num(row.cantidad_recibida);
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
    productoConfirmadoPor: textOrNull(row.producto_confirmado_por, 160),
    productoConfirmadoEn: iso(row.producto_confirmado_en),
    origenLigue: origenLigueDe(row.origen_ligue),
    unidadesConfirmadoPor: textOrNull(row.unidades_confirmado_por, 160),
    unidadesConfirmadoEn: iso(row.unidades_confirmado_en),
    propuesta: propuestaDe(row),
    recepcion,
    recepcionLabel: labelOf(FACTURA_RECEPCIONES, recepcion),
    cantidadRecibida,
    recepcionPor: textOrNull(row.recepcion_por, 160),
    recepcionEn: iso(row.recepcion_en),
    alertas: [],
    diferenciaRecepcion: diferenciaRecepcion({
      recepcion,
      cantidadComprada: num(row.cantidad_comprada),
      cantidadRecibida,
      costoPorPresentacion: num(row.costo_por_presentacion),
      totalLinea: num(row.total_linea),
    }),
  };
}

function origenLigueDe(value: unknown): OrigenLigue | null {
  return ORIGENES_LIGUE.some((item) => item.id === value) ? (value as OrigenLigue) : null;
}

function propuestaDe(row: Record<string, unknown>): FacturaLinea["propuesta"] {
  const productoId = typeof row.propuesta_producto_id === "string" && isUuid(row.propuesta_producto_id) ? row.propuesta_producto_id : null;
  const origen = FACTURA_PROPUESTA_ORIGENES.find((item) => item.id === row.propuesta_origen)?.id ?? null;
  const confianza = num(row.propuesta_confianza);
  if (!productoId || !origen || confianza == null || row.producto_id) {
    return null;
  }
  return {
    productoId,
    confianza,
    origen: origen as FacturaPropuestaOrigen,
    origenLabel: labelOf(FACTURA_PROPUESTA_ORIGENES, origen),
    producto: null,
    razon: textOrNull(row.propuesta_razon, 500),
    por: textOrNull(row.propuesta_por, 40),
    en: iso(row.propuesta_en),
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
    tipo: row.tipo === "ticket" ? "ticket" : "pagina",
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
    const { error } = await supabase.from("facturas").update({ posible_duplicado: false, duplicado_de: null }).eq("id", id);
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
  const update: Record<string, unknown> = { posible_duplicado: true, duplicado_de: match.candidato.id };
  if (!estadoExplicito && (actual.estado === "recibida" || actual.estado === "falta_factura")) {
    update.problema = true;
    update.problema_dueno = "phillip";
    update.problema_desde = new Date().toISOString();
    update.problema_falta = explicacionDuplicado(match.motivo, referencia);
  }
  const { error } = await supabase.from("facturas").update(update).eq("id", id);
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

function fichaDe(proveedor: Proveedor): FacturaProveedorFicha {
  return {
    id: proveedor.id,
    nombre: proveedor.nombre,
    rnc: proveedor.rnc,
    tieneCredito: proveedor.tieneCredito,
    diasCredito: proveedor.diasCredito,
    formaPago: proveedor.formaPago,
  };
}

async function otraConMismoNcf(factura: FacturaResumen): Promise<string | null> {
  if (!factura.rnc || !factura.ncf) {
    return null;
  }
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("facturas")
    .select(FACTURA_SELECT)
    .eq("rnc", factura.rnc)
    .eq("ncf", factura.ncf)
    .neq("id", factura.id)
    .limit(1)
    .maybeSingle();
  if (error) {
    throw error;
  }
  const otra = data ? mapResumen(data as Record<string, unknown>) : null;
  return otra ? otra.referencia : null;
}

async function fiscalesDe(factura: FacturaResumen, ficha: FacturaProveedorFicha | null): Promise<FacturaValidacionInput[]> {
  return validacionesFiscales({
    tipoDocumento: factura.tipoDocumento,
    rnc: factura.rnc,
    ncf: factura.ncf,
    proveedor: ficha,
    otraConMismoNcf: await otraConMismoNcf(factura),
    revisadoEn: new Date().toISOString(),
  });
}

function vencimientoCalculado(factura: FacturaResumen, proveedor: Proveedor): string | null {
  if (factura.fechaVencimiento || !factura.fechaEmision) {
    return null;
  }
  if (factura.condicion === "contado") {
    return factura.fechaEmision;
  }
  if (!proveedor.tieneCredito) {
    return null;
  }
  return dueDateFromCredit(factura.fechaEmision, proveedor);
}

/** Liga la factura a la ficha del proveedor, completa el vencimiento y guarda las validaciones fiscales. */
async function revisarProveedorYFiscal(id: string): Promise<void> {
  const actual = await loadResumen(id);
  if (!actual) {
    return;
  }
  const proveedor = await findProveedorParaFactura({ rnc: actual.rnc, nombre: actual.proveedor });
  const update: Record<string, unknown> = {};
  if ((proveedor?.id ?? null) !== actual.proveedorId) {
    update.proveedor_id = proveedor?.id ?? null;
  }
  const vencimiento = proveedor ? vencimientoCalculado(actual, proveedor) : null;
  if (vencimiento) {
    update.fecha_vencimiento = vencimiento;
  }
  if (Object.keys(update).length) {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from("facturas").update(update).eq("id", id);
    if (error) {
      throw error;
    }
  }
  for (const validacion of await fiscalesDe(actual, proveedor ? fichaDe(proveedor) : null)) {
    await guardarValidacion(id, validacion);
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

/** Devuelve las líneas que llegaron con un producto elegido a propósito, para aprender el alias. */
async function upsertLineas(id: string, lineas: FacturaLineaInput[], reemplazar: boolean): Promise<Vinculo[]> {
  const supabase = getSupabaseAdminClient();
  if (reemplazar) {
    if (!lineas.length) {
      const { error } = await supabase.from("factura_lineas").delete().eq("factura_id", id);
      if (error) {
        throw error;
      }
      return [];
    }
    const numeros = lineas.map((linea) => linea.numeroLinea);
    const { error } = await supabase.from("factura_lineas").delete().eq("factura_id", id).not("numero_linea", "in", `(${numeros.join(",")})`);
    if (error) {
      throw error;
    }
  }
  if (!lineas.length) {
    return [];
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
  const vinculos: Vinculo[] = [];
  for (const linea of lineas) {
    const productoId = await productoIdDeLinea(linea, actuales);
    const row: Record<string, unknown> = { ...lineaRow(id, linea), producto_id: productoId };
    if (productoId) {
      Object.assign(row, SIN_PROPUESTA);
    }
    if (productoId && (linea.catalogo.accion === "id" || linea.catalogo.accion === "codigo")) {
      vinculos.push({ descripcion: linea.descripcionOriginal ?? linea.productoNormalizado, productoId });
    }
    rows.push(row);
  }
  const { error } = await supabase.from("factura_lineas").upsert(rows, { onConflict: "factura_id,numero_linea" });
  if (error) {
    throw error;
  }
  return vinculos;
}

async function revisarCatalogo(id: string, vinculos: Vinculo[], actor: Actor): Promise<void> {
  await aprenderVinculos(id, vinculos, actor);
  await proponerCatalogo(id);
  await completarUnidades(id);
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

type FacturaQuery = PromiseLike<{ data: unknown[] | null; error: { message?: string } | null; count: number | null }> & {
  eq: (column: string, value: unknown) => FacturaQuery;
  gt: (column: string, value: unknown) => FacturaQuery;
  ilike: (column: string, value: string) => FacturaQuery;
  or: (filters: string) => FacturaQuery;
  limit: (count: number) => FacturaQuery;
  range: (from: number, to: number) => FacturaQuery;
};

function asFacturaQuery(query: unknown): FacturaQuery {
  return query as FacturaQuery;
}

function sanitizeFacturaSearch(raw: string): string {
  return raw
    .trim()
    .replace(/[%_,()]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

function aplicarFiltroFacturas(query: FacturaQuery, filtro: FacturaFiltro): FacturaQuery {
  let next = query;
  if (filtro.estado) {
    const estado = parseEstado(filtro.estado);
    if (!estado) {
      throw new Error(mensajeEstadoInvalido());
    }
    next = next.eq("estado", estado);
  }
  if (filtro.tienda?.trim()) {
    next = next.ilike("tienda", `%${filtro.tienda.trim().replace(/[%_]/g, " ")}%`);
  }
  if (filtro.pendientes) {
    next = next.gt("preguntas_abiertas", 0);
  }
  if (filtro.duplicados) {
    next = next.eq("posible_duplicado", true);
  }
  if (filtro.sinFoto) {
    next = next.eq("numero_documentos", 0);
  }
  if (filtro.problema) {
    next = next.eq("problema", true);
  }
  if (filtro.atencion) {
    next = next.or(ATENCION_OR);
  }
  const q = sanitizeFacturaSearch(filtro.q ?? "");
  if (q) {
    next = next.or(
      `proveedor.ilike.%${q}%,ncf.ilike.%${q}%,numero_factura.ilike.%${q}%,tienda.ilike.%${q}%,enviado_por.ilike.%${q}%,rnc.ilike.%${q}%,clave.ilike.%${q}%`
    );
  }
  return next;
}

function filasFactura(data: unknown[] | null): FacturaResumen[] {
  return (data ?? []).map((row) => mapResumen(row as Record<string, unknown>)).filter((row): row is FacturaResumen => Boolean(row));
}

export async function listFacturas(filtro: FacturaFiltro = {}): Promise<FacturaResumen[]> {
  const supabase = getSupabaseAdminClient();
  const query = aplicarFiltroFacturas(
    asFacturaQuery(supabase.from("facturas").select(FACTURA_SELECT).order("updated_at", { ascending: false })),
    filtro
  );
  const { data, error } = await query.limit(LIST_MAX);
  if (error) {
    throw error;
  }
  return filasFactura(data);
}

export async function listFacturaIds(filtro: FacturaFiltro, max = LIST_MAX): Promise<string[]> {
  const supabase = getSupabaseAdminClient();
  const take = Math.min(Math.max(max, 1), LIST_MAX);
  const query = aplicarFiltroFacturas(
    asFacturaQuery(supabase.from("facturas").select("id").order("updated_at", { ascending: false })),
    filtro
  );
  const { data, error } = await query.limit(take);
  if (error) {
    throw error;
  }
  return (data ?? []).map((row) => String((row as { id?: unknown }).id ?? "")).filter(Boolean);
}

export async function listFacturasPagina(filtro: FacturaFiltro, page: number): Promise<FacturaListado> {
  const supabase = getSupabaseAdminClient();
  const current = Number.isInteger(page) && page > 0 ? page : 1;
  const from = (current - 1) * FACTURAS_PAGE_SIZE;
  const to = from + FACTURAS_PAGE_SIZE - 1;
  const query = aplicarFiltroFacturas(
    asFacturaQuery(supabase.from("facturas").select(LIST_SELECT, { count: "exact" }).order("updated_at", { ascending: false })),
    filtro
  );
  const { data, error, count } = await query.range(from, to);
  if (error) {
    throw error;
  }
  return {
    facturas: filasFactura(data),
    total: count ?? 0,
    page: current,
    pageSize: FACTURAS_PAGE_SIZE,
  };
}

let resumenCache: { at: number; resumen: FacturasResumen } | null = null;
const RESUMEN_TTL_MS = 15_000;

function resumenDesdeJson(value: unknown): FacturasResumen | null {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  const porEstado = row?.porEstado;
  if (!row || !porEstado || typeof porEstado !== "object") {
    return null;
  }
  const por = porEstado as Record<string, unknown>;
  return {
    total: int(row.total),
    porEstado: FACTURA_ESTADOS.map((estado) => ({
      id: estado.id,
      label: estado.label,
      facturas: int(por[estado.id]),
    })),
    preguntasAbiertas: int(row.preguntasAbiertas),
    posiblesDuplicados: int(row.posiblesDuplicados),
    sinFoto: int(row.sinFoto),
    conProblema: int(row.conProblema),
    atencion: int(row.atencion),
  };
}

async function contarFacturas(aplicar?: (query: FacturaQuery) => FacturaQuery): Promise<number> {
  const supabase = getSupabaseAdminClient();
  let query = asFacturaQuery(supabase.from("facturas").select("id", { count: "exact", head: true }));
  if (aplicar) {
    query = aplicar(query);
  }
  const { count, error } = await query;
  if (error) {
    throw error;
  }
  return count ?? 0;
}

async function resumenFacturasConteo(): Promise<FacturasResumen> {
  const supabase = getSupabaseAdminClient();
  const [total, duplicados, sinFoto, problema, atencion, preguntas, ...porEstado] = await Promise.all([
    contarFacturas(),
    contarFacturas((query) => query.eq("posible_duplicado", true)),
    contarFacturas((query) => query.eq("numero_documentos", 0)),
    contarFacturas((query) => query.eq("problema", true)),
    contarFacturas((query) => query.or(ATENCION_OR)),
    supabase.from("facturas").select("preguntas_abiertas").gt("preguntas_abiertas", 0),
    ...FACTURA_ESTADOS.map((estado) => contarFacturas((query) => query.eq("estado", estado.id))),
  ]);
  if (preguntas.error) {
    throw preguntas.error;
  }
  return {
    total,
    porEstado: FACTURA_ESTADOS.map((estado, index) => ({
      id: estado.id,
      label: estado.label,
      facturas: porEstado[index] ?? 0,
    })),
    preguntasAbiertas: (preguntas.data ?? []).reduce((sum, row) => sum + int(row.preguntas_abiertas), 0),
    posiblesDuplicados: duplicados,
    sinFoto,
    conProblema: problema,
    atencion,
  };
}

export async function resumenFacturas(): Promise<FacturasResumen> {
  if (resumenCache && Date.now() - resumenCache.at < RESUMEN_TTL_MS) {
    return resumenCache.resumen;
  }
  const supabase = getSupabaseAdminClient();
  const rpc = await supabase.rpc("facturas_resumen");
  const payload = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
  let resumen = !rpc.error ? resumenDesdeJson(typeof payload === "string" ? parseJson(payload) : payload) : null;
  if (rpc.error && !rpcAusenteFacturas(rpc.error)) {
    throw rpc.error;
  }
  if (!resumen) {
    resumen = await resumenFacturasConteo();
  }
  resumenCache = { at: Date.now(), resumen };
  return resumen;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function rpcAusenteFacturas(error: { code?: string; message?: string }): boolean {
  const message = error.message ?? "";
  return error.code === "PGRST202" || /could not find the function|schema cache/i.test(message);
}

export type FacturaConPendientes = Pick<FacturaResumen, "id" | "referencia" | "proveedor" | "estado" | "estadoLabel" | "total" | "moneda" | "fechaVencimiento"> & {
  pendientes: Pendiente[];
};

async function porFactura<T>(tabla: string, columnas: string, ids: string[], filtro?: { columna: string; valor: string }): Promise<Map<string, T[]>> {
  const supabase = getSupabaseAdminClient();
  const grupos = new Map<string, T[]>();
  for (let inicio = 0; inicio < ids.length; inicio += 100) {
    let query = supabase.from(tabla).select(columnas).in("factura_id", ids.slice(inicio, inicio + 100));
    if (filtro) {
      query = query.eq(filtro.columna, filtro.valor);
    }
    const { data, error } = await query;
    if (error) {
      throw error;
    }
    for (const row of (data ?? []) as unknown as Array<Record<string, unknown>>) {
      const facturaId = String(row.factura_id ?? "");
      const lista = grupos.get(facturaId) ?? [];
      lista.push(row as T);
      grupos.set(facturaId, lista);
    }
  }
  return grupos;
}

/**
 * Lo que falta en cada factura que no está conciliada, con cinco consultas en total.
 * No busca pagos candidatos en caja (eso sale al abrir la ficha).
 */
export async function listarPendientes(opciones: { hoy: string; dueno?: OperacionBot | null }): Promise<FacturaConPendientes[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("facturas")
    .select(FACTURA_SELECT)
    .neq("estado", "conciliada")
    .order("recibido_en", { ascending: true })
    .limit(LIST_MAX);
  if (error) {
    throw error;
  }
  const facturas = (data ?? []).map((row) => mapResumen(row as Record<string, unknown>)).filter((row): row is FacturaResumen => Boolean(row));
  const ids = facturas.map((factura) => factura.id);
  if (!ids.length) {
    return [];
  }
  const [lineas, diferencias, pagos] = await Promise.all([
    porFactura<Record<string, unknown>>("factura_lineas", "*", ids),
    porFactura<Record<string, unknown>>("factura_validaciones", "factura_id", ids, { columna: "resultado", valor: "diferencia" }),
    porFactura<{ monto: unknown }>("factura_pagos", "factura_id, monto", ids),
  ]);
  const resultado: FacturaConPendientes[] = [];
  for (const factura of facturas) {
    const susLineas = (lineas.get(factura.id) ?? []).map((row) => mapLinea(row)).filter((row): row is FacturaLinea => Boolean(row));
    const susPagos = (pagos.get(factura.id) ?? []).map((row) => ({ monto: num(row.monto) ?? 0 }));
    const pendientes = pendientesDe(
      {
        ...factura,
        recepcion: resumenRecepcion(susLineas),
        lineasSinCatalogo: lineasSinCatalogo(susLineas),
        propuestasPorConfirmar: propuestasPorConfirmar(susLineas),
        validacionesConDiferencia: diferencias.get(factura.id)?.length ?? 0,
        pagosCandidatos: null,
        lineasConAlerta: null,
        pagosDiferencia: diferenciaPagos(factura.total, susPagos),
      },
      { hoy: opciones.hoy, formatDesde: (value) => value ?? "sin fecha" }
    ).filter((item) => !opciones.dueno || item.dueno === opciones.dueno);
    if (pendientes.length) {
      resultado.push({
        id: factura.id,
        referencia: factura.referencia,
        proveedor: factura.proveedor,
        estado: factura.estado,
        estadoLabel: factura.estadoLabel,
        total: factura.total,
        moneda: factura.moneda,
        fechaVencimiento: factura.fechaVencimiento,
        pendientes,
      });
    }
  }
  return resultado;
}

async function umbralesAlerta(): Promise<{ precio: number; cantidad: number }> {
  try {
    const config = await getParametrosConfig();
    return { precio: config.alertaPrecio, cantidad: config.alertaCantidad };
  } catch {
    return { precio: ALERTA_PRECIO_DEFECTO, cantidad: ALERTA_CANTIDAD_DEFECTO };
  }
}

type HistorialRow = Record<string, unknown> & { facturas?: Record<string, unknown> | Array<Record<string, unknown>> | null };

/** Compara cada línea ligada con las compras anteriores del mismo producto al mismo proveedor. Una consulta para toda la factura. */
async function adjuntarAlertas(factura: FacturaResumen, lineas: FacturaLinea[]): Promise<FacturaLinea[]> {
  const productos = Array.from(new Set(lineas.map((linea) => linea.productoId).filter((id): id is string => Boolean(id))));
  if (!factura.proveedorId || !productos.length || factura.tipoDocumento === "nota_credito") {
    return lineas;
  }
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("factura_lineas")
    .select(
      "producto_id, costo_unitario, unidades_totales, costo_por_presentacion, cantidad_comprada, presentacion, unidades_por_presentacion, facturas!inner ( id, proveedor_id, recibido_en, fecha_emision, tipo_documento, moneda )"
    )
    .in("producto_id", productos)
    .eq("facturas.proveedor_id", factura.proveedorId)
    .eq("facturas.moneda", factura.moneda)
    .neq("facturas.tipo_documento", "nota_credito")
    .neq("factura_id", factura.id)
    .limit(2000);
  if (error) {
    throw error;
  }
  const fechaDe = (row: Record<string, unknown> | null | undefined) => String(row?.fecha_emision ?? row?.recibido_en ?? "").slice(0, 10);
  const actual = factura.fechaEmision ?? factura.recibidoEn.slice(0, 10);
  const porProducto = new Map<string, Array<{ fecha: string; medida: MedidaLinea | null }>>();
  for (const row of (data ?? []) as HistorialRow[]) {
    const cabecera = Array.isArray(row.facturas) ? row.facturas[0] : row.facturas;
    const fecha = fechaDe(cabecera);
    if (!fecha || fecha > actual) {
      continue;
    }
    const productoId = String(row.producto_id);
    const lista = porProducto.get(productoId) ?? [];
    lista.push({
      fecha,
      medida: medidaLinea({
        costoUnitario: num(row.costo_unitario),
        unidadesTotales: num(row.unidades_totales),
        costoPorPresentacion: num(row.costo_por_presentacion),
        cantidadComprada: num(row.cantidad_comprada),
        presentacion: textOrNull(row.presentacion, 40),
        unidadesPorPresentacion: num(row.unidades_por_presentacion),
      }),
    });
    porProducto.set(productoId, lista);
  }
  if (!porProducto.size) {
    return lineas;
  }
  const umbral = await umbralesAlerta();
  return lineas.map((linea) => {
    const historial = linea.productoId ? porProducto.get(linea.productoId) : undefined;
    if (!historial) {
      return linea;
    }
    const ordenado = historial.sort((a, b) => b.fecha.localeCompare(a.fecha)).map((item) => item.medida);
    return { ...linea, alertas: alertasLinea(medidaLinea(linea), ordenado, umbral, factura.moneda) };
  });
}

async function adjuntarCatalogo(lineas: FacturaLinea[]): Promise<FacturaLinea[]> {
  const ids = Array.from(
    new Set(lineas.flatMap((linea) => [linea.productoId, linea.propuesta?.productoId ?? null]).filter((id): id is string => Boolean(id)))
  );
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
    propuesta: linea.propuesta ? { ...linea.propuesta, producto: porId.get(linea.propuesta.productoId) ?? null } : null,
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
    supabase.from("factura_documentos").select("id, nombre, mime, pagina, tipo, created_at").eq("factura_id", id).order("pagina", { ascending: true }),
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
  const proveedor = resumen.proveedorId ? await getProveedorById(resumen.proveedorId) : null;
  const proveedorFicha = proveedor ? fichaDe(proveedor) : null;
  const pagos = await pagosDe(id);
  const origen = resumen.facturaOrigenId ? await loadResumen(resumen.facturaOrigenId) : null;
  const fiscales = await fiscalesDe(resumen, proveedorFicha);
  const stored = (validaciones.data ?? [])
    .map((row) => mapValidacion(row as Record<string, unknown>))
    .filter((row): row is FacturaValidacion => Boolean(row))
    .filter((row) => !fiscales.some((fiscal) => fiscal.codigo === row.codigo));
  for (const fiscal of fiscales) {
    stored.push({
      codigo: fiscal.codigo,
      codigoLabel: labelOf(FACTURA_VALIDACIONES, fiscal.codigo),
      resultado: fiscal.resultado,
      resultadoLabel: labelOf(FACTURA_RESULTADOS, fiscal.resultado),
      explicacion: fiscal.explicacion,
      revisadoEn: fiscal.revisadoEn,
    });
  }
  return {
    ...resumen,
    proveedorFicha,
    pagos,
    pagosCandidatos: await candidatosPago(resumen),
    pagosDiferencia: diferenciaPagos(resumen.total, pagos),
    facturaOrigen: origen ? { id: origen.id, referencia: origen.referencia } : null,
    notasCredito: resumen.tipoDocumento === "nota_credito" ? [] : await notasDe(id),
    lineas: await adjuntarAlertas(
      resumen,
      await adjuntarCatalogo(
        (lineas.data ?? []).map((row) => mapLinea(row as Record<string, unknown>)).filter((row): row is FacturaLinea => Boolean(row))
      )
    ),
    validaciones: completarValidaciones(stored),
    preguntas: (preguntas.data ?? []).map((row) => mapPregunta(row as Record<string, unknown>)).filter((row): row is FacturaPregunta => Boolean(row)),
    documentos: (documentos.data ?? [])
      .map((row) => mapDocumento(row as Record<string, unknown>))
      .filter((row): row is FacturaDocumento => Boolean(row))
      .sort((a, b) => (a.pagina ?? 999) - (b.pagina ?? 999)),
    verificacion: await ultimaVerificacion(id),
    conciliacion: await ultimaConciliacion(id),
  };
}

async function ultimaVerificacion(facturaId: string): Promise<FacturaVerificacion | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("factura_verificaciones")
    .select("*")
    .eq("factura_id", facturaId)
    .order("creado_en", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }
  const resultado = data.resultado === "cuadra" || data.resultado === "falta" || data.resultado === "diferencia" ? data.resultado : null;
  const creadoEn = iso(data.creado_en);
  if (!resultado || !creadoEn) {
    return null;
  }
  const label = resultado === "cuadra" ? "Cuadra" : resultado === "falta" ? "Falta" : "Diferencia";
  return {
    id: String(data.id),
    resultado,
    resultadoLabel: label,
    rnc: textOrNull(data.rnc, 20),
    ncf: textOrNull(data.ncf, 20),
    montoFactura: num(data.monto_factura),
    montoSistema: num(data.monto_sistema),
    montoCaja: num(data.monto_caja),
    montoDgii: num(data.monto_dgii),
    nota: textOrNull(data.nota, 2000),
    creadoEn,
  };
}

async function ultimaConciliacion(facturaId: string): Promise<FacturaConciliacion | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("factura_conciliaciones")
    .select("*")
    .eq("factura_id", facturaId)
    .order("creado_en", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }
  const resultado =
    data.resultado === "pagada" || data.resultado === "vencida_sin_pagar" || data.resultado === "pagada_sin_movimiento" || data.resultado === "falta_factura"
      ? data.resultado
      : null;
  const creadoEn = iso(data.creado_en);
  if (!resultado || !creadoEn) {
    return null;
  }
  const medio = data.medio === "banco" || data.medio === "caja" || data.medio === "cardnet" ? data.medio : null;
  const labels: Record<typeof resultado, string> = {
    pagada: "Pagada",
    vencida_sin_pagar: "Vencida sin pagar",
    pagada_sin_movimiento: "Pagada sin movimiento",
    falta_factura: "Falta factura",
  };
  return {
    id: String(data.id),
    resultado,
    resultadoLabel: labels[resultado],
    medio,
    medioLabel: medio === "banco" ? "Banco" : medio === "caja" ? "Caja" : medio === "cardnet" ? "CardNET" : null,
    fecha: day(data.fecha),
    referencia: textOrNull(data.referencia, 160),
    monto: num(data.monto),
    nota: textOrNull(data.nota, 2000),
    creadoEn,
  };
}

async function applyChildren(id: string, body: Record<string, unknown>, documentos: DocumentoEntrada[]): Promise<Vinculo[] | null> {
  let vinculos: Vinculo[] | null = null;
  if (hasKey(body, ["lineas", "productos"]) && (body.lineas ?? body.productos) !== undefined) {
    const lineas = leerLineas(body.lineas ?? body.productos);
    vinculos = await upsertLineas(id, lineas, body.reemplazarLineas === true || body.reemplazarProductos === true);
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
  return vinculos;
}

async function exigirEtapa(id: string | null, estado: FacturaCampos["estado"], actor: Actor, personalNuevo: boolean | undefined): Promise<void> {
  if (!estado) {
    return;
  }
  let esCompraPersonal = personalNuevo === true;
  let lineas = 0;
  let lineasSinRecepcion = 0;
  if (id) {
    const supabase = getSupabaseAdminClient();
    const [header, recepciones] = await Promise.all([
      supabase.from("facturas").select("es_compra_personal").eq("id", id).maybeSingle(),
      supabase.from("factura_lineas").select("recepcion").eq("factura_id", id),
    ]);
    if (header.error) {
      throw header.error;
    }
    if (recepciones.error) {
      throw recepciones.error;
    }
    esCompraPersonal = personalNuevo ?? header.data?.es_compra_personal === true;
    lineas = recepciones.data?.length ?? 0;
    lineasSinRecepcion = (recepciones.data ?? []).filter((row) => row.recepcion === "pendiente").length;
  }
  validarCambioEstado({ actor, estado, esCompraPersonal, lineas, lineasSinRecepcion });
}

/** Resuelve facturaOrigen (id o clave) a la columna factura_origen_id. Solo las notas de crédito la llevan. */
async function origenRow(campos: FacturaCampos, id: string | null): Promise<Record<string, unknown>> {
  if (campos.facturaOrigen === undefined) {
    return {};
  }
  if (campos.facturaOrigen === null) {
    return { factura_origen_id: null };
  }
  let tipo = campos.tipoDocumento;
  if (!tipo && id) {
    tipo = (await loadResumen(id))?.tipoDocumento;
  }
  if (tipo !== "nota_credito") {
    throw new Error("Solo una nota de crédito se liga a una factura original. Manda tipoDocumento: nota_credito");
  }
  const origen = await findFacturaId(campos.facturaOrigen);
  if (!origen) {
    throw new Error("No encontramos la factura original de esa nota de crédito");
  }
  if (origen === id) {
    throw new Error("La nota de crédito no puede ser su propia factura original");
  }
  return { factura_origen_id: origen };
}

async function notasDe(facturaId: string): Promise<FacturaNotaRef[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("facturas").select(FACTURA_SELECT).eq("factura_origen_id", facturaId).order("recibido_en", { ascending: true });
  if (error) {
    throw error;
  }
  return (data ?? [])
    .map((row) => mapResumen(row as Record<string, unknown>))
    .filter((row): row is FacturaResumen => Boolean(row))
    .map((nota) => ({ id: nota.id, referencia: nota.referencia, total: nota.total, estado: nota.estado, estadoLabel: nota.estadoLabel }));
}

export async function createFactura(
  body: Record<string, unknown>,
  documentos: DocumentoEntrada[],
  actor: Actor = "lectura"
): Promise<{ creado: boolean; factura: FacturaDetalle }> {
  const { campos, estadoExplicito } = leerCamposFactura(body, "create");
  await exigirEtapa(null, campos.estado, actor, false);
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
  const { data, error } = await supabase.from("facturas").insert({ ...headerRow(campos), ...(await origenRow(campos, null)) }).select("id").single();
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
    const vinculos = await applyChildren(id, { ...body, lineas: hasKey(body, ["lineas", "productos"]) ? body.lineas ?? body.productos : undefined }, documentos);
    await revisarDuplicado(id, estadoExplicito);
    await revisarProveedorYFiscal(id);
    if (vinculos) {
      await revisarCatalogo(id, vinculos, actor);
    }
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

export async function updateFactura(
  idOrClave: string,
  body: Record<string, unknown>,
  documentos: DocumentoEntrada[],
  actor: Actor = "lectura"
): Promise<FacturaDetalle> {
  const id = await requireFacturaId(idOrClave);
  const { campos, estadoExplicito } = leerCamposFactura(body, "patch");
  await exigirEtapa(id, campos.estado, actor, undefined);
  const row = { ...headerRow(campos), ...(await origenRow(campos, id)) };
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
  const vinculos = await applyChildren(id, body, documentos);
  await revisarDuplicado(id, estadoExplicito);
  await revisarProveedorYFiscal(id);
  if (vinculos) {
    await revisarCatalogo(id, vinculos, actor);
  }
  await syncCounters(id);
  const factura = await getFactura(id);
  if (!factura) {
    throw new Error("No encontramos esa factura");
  }
  return factura;
}

type LigueAplicado = {
  id: string;
  productoId: string;
  descripcion: string | null;
  codigoSku: string | null;
  numeroLinea: number;
  estado: string | null;
  origen: OrigenLigue;
  por: string | null;
};

async function cerrarPreguntasDeLinea(facturaId: string, numeroLinea: number, tipo: "producto" | "unidades", por: string, ahora: string): Promise<void> {
  if (numeroLinea < 1) {
    return;
  }
  const coincide = tipo === "producto" ? esCampoProducto : esCampoUnidades;
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("factura_preguntas")
    .select("id, campo")
    .eq("factura_id", facturaId)
    .eq("estado", "abierta")
    .eq("linea_numero", numeroLinea);
  if (error) {
    throw error;
  }
  const texto = textoConfirmacionUi(por);
  for (const row of data ?? []) {
    if (!coincide(typeof row.campo === "string" ? row.campo : null)) {
      continue;
    }
    const { error: updateError } = await supabase
      .from("factura_preguntas")
      .update({
        respuesta: texto,
        evidencia: texto,
        respondido_por: por,
        respondido_en: ahora,
        estado: "resuelta",
      })
      .eq("id", row.id);
    if (updateError) {
      throw updateError;
    }
  }
}

/** Liga productos y, si lo hizo una persona, cierra las preguntas, aprende el alias y avisa al bot. */
async function aplicarLigues(facturaId: string, ligues: LigueAplicado[], proveedorId: string | null, aliasPor: string): Promise<void> {
  if (!ligues.length) {
    return;
  }
  const supabase = getSupabaseAdminClient();
  const ahora = new Date().toISOString();
  let humanas = 0;
  for (const ligue of ligues) {
    const estado = FACTURA_ESTADOS_LINEA.some((item) => item.id === ligue.estado) ? (ligue.estado as FacturaEstadoLinea) : null;
    const row: Record<string, unknown> = {
      producto_id: ligue.productoId,
      ...SIN_PROPUESTA,
      origen_ligue: ligue.origen,
      producto_confirmado_por: ligue.origen === "humano" ? ligue.por : null,
      producto_confirmado_en: ligue.origen === "humano" ? ahora : null,
    };
    if (estado && estadoTrasLigue(estado) !== estado) {
      row.estado = estadoTrasLigue(estado);
    }
    const { error } = await supabase.from("factura_lineas").update(row).eq("id", ligue.id).eq("factura_id", facturaId);
    if (error) {
      throw error;
    }
    await aprenderAlias(proveedorId, ligue.descripcion, ligue.productoId, ligue.por ?? aliasPor, ligue.codigoSku);
    if (ligue.origen === "humano" && ligue.por) {
      humanas += 1;
      await cerrarPreguntasDeLinea(facturaId, ligue.numeroLinea, "producto", ligue.por, ahora);
      await publishAgentEvent("linea.confirmada", {
        facturaId,
        numeroLinea: ligue.numeroLinea,
        productoId: ligue.productoId,
        por: ligue.por,
      });
    }
  }
  if (humanas) {
    await syncCounters(facturaId);
  }
}

export async function asignarProductoLinea(
  idOrClave: string,
  lineaId: string,
  body: Record<string, unknown>,
  actor: Actor = "admin",
  confirmadoPor: string | null = null
): Promise<FacturaDetalle> {
  if (!isUuid(lineaId)) {
    throw new Error("No encontramos esa línea");
  }
  const facturaId = await requireFacturaId(idOrClave);
  const supabase = getSupabaseAdminClient();
  const { data: linea, error: lineaError } = await supabase
    .from("factura_lineas")
    .select("id, numero_linea, estado, descripcion_original, producto_normalizado, codigo_sku, propuesta_producto_id")
    .eq("id", lineaId)
    .eq("factura_id", facturaId)
    .maybeSingle();
  if (lineaError) {
    throw lineaError;
  }
  if (!linea) {
    throw new Error("No encontramos esa línea");
  }
  const aceptar = body.aceptarPropuesta === true || body.aceptar === true;
  const productoId = aceptar ? linea.propuesta_producto_id : body.productoId;
  if (aceptar && !productoId) {
    throw new Error("Esa línea no tiene propuesta para aceptar");
  }
  let next: string | null = null;
  if (productoId != null && productoId !== "") {
    if (typeof productoId !== "string" || !isUuid(productoId.trim())) {
      throw new Error("El producto del catálogo no es válido");
    }
    next = await buscarProductoCatalogo({ accion: "id", id: productoId.trim() });
  }
  const descripcion = textOrNull(linea.descripcion_original, 500) ?? textOrNull(linea.producto_normalizado, 200);
  const codigoSku = textOrNull(linea.codigo_sku, 80);
  const numeroLinea = int(linea.numero_linea);
  const estado = textOrNull(linea.estado, 40);
  if (next) {
    const persona = confirmadoPor?.trim() || null;
    const origen: OrigenLigue = persona ? "humano" : "propuesta_auto";
    const proveedor = await loadResumen(facturaId);
    await aplicarLigues(
      facturaId,
      [{ id: lineaId, productoId: next, descripcion, codigoSku, numeroLinea, estado, origen, por: persona }],
      proveedor?.proveedorId ?? null,
      persona ?? actor
    );
    await completarUnidades(facturaId);
  } else {
    const { error } = await supabase
      .from("factura_lineas")
      .update({ producto_id: null, producto_confirmado_por: null, producto_confirmado_en: null, origen_ligue: null })
      .eq("id", lineaId)
      .eq("factura_id", facturaId);
    if (error) {
      throw error;
    }
    await proponerCatalogo(facturaId);
  }
  await supabase.from("facturas").update({ updated_at: new Date().toISOString() }).eq("id", facturaId);
  const factura = await getFactura(facturaId);
  if (!factura) {
    throw new Error("No encontramos esa factura");
  }
  return factura;
}

/** La persona editó las unidades por presentación de una línea: queda su nombre y se cierra la pregunta. */
export async function confirmarUnidadesEnLinea(facturaId: string, numeroLineaRaw: unknown, unidades: number, por: string): Promise<void> {
  const numeroLinea = int(numeroLineaRaw);
  const nombre = por.trim();
  if (!isUuid(facturaId) || numeroLinea < 1 || !nombre) {
    throw new Error("No encontramos esa línea");
  }
  const supabase = getSupabaseAdminClient();
  const { data: linea, error } = await supabase
    .from("factura_lineas")
    .select("id, presentacion, cantidad_comprada, costo_por_presentacion")
    .eq("factura_id", facturaId)
    .eq("numero_linea", numeroLinea)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!linea) {
    throw new Error("No encontramos esa línea");
  }
  const presentacion = FACTURA_PRESENTACIONES.some((item) => item.id === linea.presentacion) ? (linea.presentacion as FacturaPresentacion) : null;
  const resuelto = resolverUnidades({
    presentacion,
    cantidadComprada: num(linea.cantidad_comprada),
    unidadesPorPresentacion: unidades,
    unidadesTotales: null,
    costoPorPresentacion: num(linea.costo_por_presentacion),
    costoUnitario: null,
  });
  const ahora = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("factura_lineas")
    .update({
      unidades_por_presentacion: resuelto.unidadesPorPresentacion,
      unidades_totales: resuelto.unidadesTotales,
      costo_unitario: resuelto.costoUnitario,
      unidades_confirmado_por: nombre,
      unidades_confirmado_en: ahora,
    })
    .eq("id", linea.id);
  if (updateError) {
    throw updateError;
  }
  await cerrarPreguntasDeLinea(facturaId, numeroLinea, "unidades", nombre, ahora);
  await syncCounters(facturaId);
}

/** Acepta propuestas de una vez. Phillip desde 90 (propuesta_auto). Una persona también las de 70 a 89 (humano). */
export async function aceptarPropuestas(
  idOrClave: string,
  body: Record<string, unknown>,
  actor: Actor,
  confirmadoPor: string | null = null
): Promise<{ aceptadas: number; factura: FacturaDetalle }> {
  if (actor !== "phillip" && actor !== "admin") {
    throw new Error("Solo Phillip acepta las propuestas del catálogo");
  }
  const facturaId = await requireFacturaId(idOrClave);
  const rango = leerRangoPropuestas(body, actor);
  const lineas = await lineasParaAceptar(facturaId, rango.minimo, rango.maximo);
  const persona = actor === "admin" ? confirmadoPor?.trim() || "Admin" : null;
  const proveedorId = (await loadResumen(facturaId))?.proveedorId ?? null;
  await aplicarLigues(
    facturaId,
    lineas.map((linea) => ({
      id: linea.id,
      productoId: linea.productoId,
      descripcion: linea.descripcion,
      codigoSku: linea.codigoSku,
      numeroLinea: linea.numeroLinea,
      estado: linea.estado,
      origen: persona ? "humano" : "propuesta_auto",
      por: persona,
    })),
    proveedorId,
    persona ?? actor
  );
  if (lineas.length) {
    await completarUnidades(facturaId);
    const supabase = getSupabaseAdminClient();
    await supabase.from("facturas").update({ updated_at: new Date().toISOString() }).eq("id", facturaId);
  }
  const factura = await getFactura(facturaId);
  if (!factura) {
    throw new Error("No encontramos esa factura");
  }
  return { aceptadas: lineas.length, factura };
}

export async function candidatosLineas(idOrClave: string, todas: boolean): Promise<{ factura: string; referencia: string; lineas: FacturaLineaCandidatos[] }> {
  const factura = await getFactura(idOrClave);
  if (!factura) {
    throw new Error("No encontramos esa factura");
  }
  const lineas = factura.lineas.filter((linea) => todas || !linea.productoId);
  const candidatos = await candidatosCatalogo(
    factura.id,
    lineas.map((linea) => ({
      id: linea.id,
      descripcion: linea.descripcionOriginal ?? linea.productoNormalizado,
      codigoSku: linea.codigoSku,
      codigoBarras: linea.codigoBarras,
    }))
  );
  return {
    factura: factura.id,
    referencia: factura.referencia,
    lineas: lineas.map((linea) => ({
      lineaId: linea.id,
      numeroLinea: linea.numeroLinea,
      descripcion: linea.descripcionOriginal ?? linea.productoNormalizado,
      codigoSku: linea.codigoSku,
      codigoBarras: linea.codigoBarras,
      presentacion: linea.presentacion,
      cantidadComprada: linea.cantidadComprada,
      costoPorPresentacion: linea.costoPorPresentacion,
      productoId: linea.productoId,
      propuesta: linea.propuesta,
      candidatos: candidatos.get(linea.id) ?? [],
    })),
  };
}

type PropuestaAgente = { lineaId: string; productoId: string; confianza: number; razon: string };

async function leerPropuestas(facturaId: string, body: Record<string, unknown>): Promise<PropuestaAgente[]> {
  const items = Array.isArray(body.propuestas) ? body.propuestas : Array.isArray(body.lineas) ? body.lineas : null;
  if (!items?.length) {
    throw new Error("Manda propuestas: [{ numeroLinea, productoId o codigoOdoo, confianza, razon }]");
  }
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("factura_lineas").select("id, numero_linea, producto_id").eq("factura_id", facturaId);
  if (error) {
    throw error;
  }
  const porNumero = new Map((data ?? []).map((row) => [int(row.numero_linea), String(row.id)]));
  const ligadas = new Set((data ?? []).filter((row) => row.producto_id).map((row) => String(row.id)));
  const ids = new Set(porNumero.values());
  const propuestas: PropuestaAgente[] = [];
  for (const raw of items) {
    const item = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const lineaId = typeof item.lineaId === "string" && ids.has(item.lineaId) ? item.lineaId : porNumero.get(int(item.numeroLinea));
    if (!lineaId) {
      throw new Error(`No encontramos la línea ${String(item.numeroLinea ?? item.lineaId ?? "")}`.trim());
    }
    const numero = int(item.numeroLinea) || Array.from(porNumero.entries()).find(([, id]) => id === lineaId)?.[0];
    if (ligadas.has(lineaId)) {
      throw new Error(`La línea ${numero} ya tiene producto. Para cambiarlo usa PATCH /lineas/{lineaId} con productoId`);
    }
    const confianza = num(item.confianza);
    if (confianza == null || confianza < 0 || confianza > 100) {
      throw new Error(`En la línea ${numero}, la confianza tiene que ser un número de 0 a 100`);
    }
    const razon = textOrNull(item.razon, 500);
    if (!razon || razon.length < 3) {
      throw new Error(`En la línea ${numero}, manda la razon de la propuesta`);
    }
    const productoRaw = typeof item.productoId === "string" ? item.productoId.trim() : "";
    const codigo = typeof item.codigoOdoo === "string" ? item.codigoOdoo.trim() : "";
    if (!productoRaw && !codigo) {
      throw new Error(`En la línea ${numero}, manda productoId o codigoOdoo`);
    }
    if (productoRaw && !isUuid(productoRaw)) {
      throw new Error(`En la línea ${numero}, el producto del catálogo no es válido`);
    }
    const productoId = await buscarProductoCatalogo(productoRaw ? { accion: "id", id: productoRaw } : { accion: "codigo", codigo });
    propuestas.push({ lineaId, productoId, confianza: Math.round(confianza), razon });
  }
  return propuestas;
}

/**
 * Phillip deja su propuesta por línea con su confianza y su razón. Con aceptar, las de 90 o más se ligan
 * y quedan aprendidas para ese proveedor; las demás esperan a una persona.
 */
export async function proponerLineas(
  idOrClave: string,
  body: Record<string, unknown>,
  actor: Actor
): Promise<{ propuestas: number; ligadas: number; porConfirmar: number; factura: FacturaDetalle }> {
  if (actor !== "phillip" && actor !== "admin") {
    throw new Error("Solo Phillip propone los productos del catálogo");
  }
  const facturaId = await requireFacturaId(idOrClave);
  const propuestas = await leerPropuestas(facturaId, body);
  const aceptar = body.aceptar === true;
  const supabase = getSupabaseAdminClient();
  const ahora = new Date().toISOString();
  const por = actor === "admin" ? "Admin" : "Phillip";
  for (const propuesta of propuestas) {
    const { error } = await supabase
      .from("factura_lineas")
      .update({
        producto_id: null,
        propuesta_producto_id: propuesta.productoId,
        propuesta_confianza: propuesta.confianza,
        propuesta_origen: "agente",
        propuesta_razon: propuesta.razon,
        propuesta_por: por,
        propuesta_en: ahora,
      })
      .eq("id", propuesta.lineaId)
      .eq("factura_id", facturaId);
    if (error) {
      throw error;
    }
  }
  let ligadas = 0;
  if (aceptar) {
    const proveedorId = (await loadResumen(facturaId))?.proveedorId ?? null;
    const enviadas = new Set(propuestas.map((propuesta) => propuesta.lineaId));
    const paraLigar = (await lineasParaAceptar(facturaId, PROPUESTA_ACEPTAR_TODAS)).filter((linea) => enviadas.has(linea.id));
    await aplicarLigues(
      facturaId,
      paraLigar.map((linea) => ({
        id: linea.id,
        productoId: linea.productoId,
        descripcion: linea.descripcion,
        codigoSku: linea.codigoSku,
        numeroLinea: linea.numeroLinea,
        estado: linea.estado,
        origen: "propuesta_auto" as const,
        por: null,
      })),
      proveedorId,
      actor
    );
    ligadas = paraLigar.length;
    if (ligadas) {
      await completarUnidades(facturaId);
    }
  }
  await supabase.from("facturas").update({ updated_at: ahora }).eq("id", facturaId);
  const factura = await getFactura(facturaId);
  if (!factura) {
    throw new Error("No encontramos esa factura");
  }
  return { propuestas: propuestas.length, ligadas, porConfirmar: propuestas.length - ligadas, factura };
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
    problema: flag("problema"),
    atencion: flag("atencion"),
  };
}
