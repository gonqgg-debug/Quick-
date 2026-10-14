import { CompraDuplicadaError, createCompra, updateCompra } from "@/lib/admin-compras";
import { isMonthKey } from "@/lib/admin-parametros-shared";
import { getTodosLosBalances } from "@/lib/caja";
import { ligarPago, quitarPago } from "@/lib/factura-pagos";
import { getFactura } from "@/lib/facturas";
import type { FacturaDetalle } from "@/lib/facturas-shared";
import { cantidadRecibidaDe, isUuid, leerRecepcion } from "@/lib/facturas-shared";
import { isDayKey, todayDayKey } from "@/lib/local-day";
import { toMoney } from "@/lib/money";
import {
  assertVersionEditable,
  compararDecisiones,
  conceptoEsGanancia,
  conceptoEsMargen,
  decisionVencida,
  esCierreBot,
  esOperacionBot,
  mesAnterior,
  monthBounds,
  type Actor,
  type Asiento,
  type CierreBot,
  type CierreEntrega,
  type CierreEstado,
  type CierrePanel,
  type CierreResumenNumeros,
  type CierreVersion,
  type ConciliacionMedio,
  type ConciliacionResultado,
  type Decision,
  type DecisionEstado,
  type Excepcion,
  type OperacionBot,
  type ReporteLinea,
  type ReporteTipo,
  type VerificacionResultado,
  CIERRE_BOTS,
  CONCILIACION_MEDIOS,
  CONCILIACION_RESULTADOS,
  REPORTE_TIPOS,
  VERIFICACION_RESULTADOS,
} from "@/lib/operacion-shared";
import { getSupabaseAdminClient } from "@/lib/supabase";

function textOrNull(value: unknown, max = 2000): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const text = value.trim().slice(0, max);
  return text || null;
}

function moneyOrNull(value: unknown): number | null {
  if (value == null || value === "") {
    return null;
  }
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) {
    throw new Error("El monto no es válido");
  }
  return toMoney(number);
}

function dayOrNull(value: unknown, label: string): string | null {
  if (value == null || value === "") {
    return null;
  }
  if (typeof value !== "string" || !isDayKey(value.slice(0, 10))) {
    throw new Error(`${label} no es válida`);
  }
  return value.slice(0, 10);
}

function requireMes(value: string): string {
  const mes = value.trim();
  if (!isMonthKey(mes)) {
    throw new Error("El mes no es válido");
  }
  return mes;
}

function iso(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function requireFactura(idOrClave: string): Promise<FacturaDetalle> {
  const factura = await getFactura(idOrClave);
  if (!factura) {
    throw new Error("No encontramos esa factura");
  }
  return factura;
}

function actorBot(actor: Actor): OperacionBot {
  if (actor === "admin" || actor === "lectura" || !esOperacionBot(actor)) {
    throw new Error("Este acceso no puede escribir esa parte");
  }
  return actor;
}

export async function guardarConfirmacion(
  idOrClave: string,
  body: Record<string, unknown>,
  actor: Actor
): Promise<FacturaDetalle> {
  if (actor !== "rodrigo" && actor !== "admin") {
    throw new Error("Solo Rodrigo guarda la respuesta de la tienda");
  }
  const factura = await requireFactura(idOrClave);
  const texto = textOrNull(body.texto ?? body.respuesta ?? body.confirmacion, 4000);
  if (!texto) {
    throw new Error("La respuesta de Ramón no puede ir vacía");
  }
  const por = textOrNull(body.confirmadoPor ?? body.confirmacionPor ?? body.por, 160) ?? "Ramón";
  const en = dayOrNull(body.fecha ?? body.confirmacionEn, "La fecha") ?? todayDayKey();
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("facturas")
    .update({
      confirmacion_texto: texto,
      confirmacion_por: por,
      confirmacion_en: new Date(`${en}T12:00:00.000Z`).toISOString(),
    })
    .eq("id", factura.id);
  if (error) {
    throw error;
  }
  return requireFactura(factura.id);
}

/** Rodrigo marca cada línea como completa, faltante o regalo según lo que dijo la tienda. */
export async function guardarRecepcion(idOrClave: string, body: Record<string, unknown>, actor: Actor): Promise<FacturaDetalle> {
  if (actor !== "rodrigo" && actor !== "admin") {
    throw new Error("Solo Rodrigo confirma la recepción");
  }
  const factura = await requireFactura(idOrClave);
  if (!factura.lineas.length) {
    throw new Error("Esa factura todavía no tiene productos. Phillip tiene que extraerlos primero");
  }
  const { todas, lineas, por } = leerRecepcion(body);
  const quien = por ?? (actor === "admin" ? "Admin" : "Rodrigo");
  const ahora = new Date().toISOString();
  const porNumero = new Map(factura.lineas.map((linea) => [linea.numeroLinea, linea]));
  const entradas = todas
    ? factura.lineas.map((linea) => ({ numeroLinea: linea.numeroLinea, recepcion: todas, cantidadRecibida: null }))
    : lineas;
  const supabase = getSupabaseAdminClient();
  for (const entrada of entradas) {
    const linea = porNumero.get(entrada.numeroLinea);
    if (!linea) {
      throw new Error(`La factura no tiene la línea ${entrada.numeroLinea}`);
    }
    const pendiente = entrada.recepcion === "pendiente";
    const { error } = await supabase
      .from("factura_lineas")
      .update({
        recepcion: entrada.recepcion,
        cantidad_recibida: cantidadRecibidaDe(entrada, linea.cantidadComprada),
        recepcion_por: pendiente ? null : quien,
        recepcion_en: pendiente ? null : ahora,
      })
      .eq("id", linea.id);
    if (error) {
      throw error;
    }
  }
  await supabase.from("facturas").update({ updated_at: ahora }).eq("id", factura.id);
  return requireFactura(factura.id);
}

export async function marcarCompraPersonal(
  idOrClave: string,
  body: Record<string, unknown>,
  actor: Actor
): Promise<FacturaDetalle> {
  if (actor !== "rodrigo" && actor !== "admin") {
    throw new Error("Solo Rodrigo marca las compras personales");
  }
  const factura = await requireFactura(idOrClave);
  const personal = body.esCompraPersonal === true || body.es_compra_personal === true;
  const socio = personal ? textOrNull(body.socio, 160) : null;
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("facturas").update({ es_compra_personal: personal, socio }).eq("id", factura.id);
  if (error) {
    throw error;
  }
  return requireFactura(factura.id);
}

async function marcarProblema(facturaId: string, dueno: OperacionBot, falta: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("facturas")
    .update({
      problema: true,
      problema_dueno: dueno,
      problema_desde: new Date().toISOString(),
      problema_falta: falta.slice(0, 2000),
    })
    .eq("id", facturaId);
  if (error) {
    throw error;
  }
}

async function limpiarProblema(facturaId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("facturas")
    .update({ problema: false, problema_dueno: null, problema_desde: null, problema_falta: null })
    .eq("id", facturaId);
  if (error) {
    throw error;
  }
}

async function abrirCuentaPorPagar(factura: FacturaDetalle): Promise<string | null> {
  if (factura.tipoDocumento === "nota_credito" || factura.esCompraPersonal || factura.compraId || factura.moneda !== "DOP") {
    return factura.compraId;
  }
  if (!factura.proveedor) {
    throw new Error("La factura no tiene proveedor para la cuenta por pagar");
  }
  if (factura.total == null || factura.total <= 0) {
    throw new Error("La factura no tiene total para la cuenta por pagar");
  }
  try {
    const compra = await createCompra({
      proveedorNombre: factura.proveedor,
      monto: factura.total,
      fecha: factura.fechaEmision ?? todayDayKey(),
      dueDate: factura.fechaVencimiento,
      rnc: factura.rnc,
      ncf: factura.ncf,
      pagado: false,
    });
    return compra.id;
  } catch (error) {
    if (error instanceof CompraDuplicadaError) {
      return error.compra.id;
    }
    throw error;
  }
}

/**
 * Cuenta por pagar de la factura original a la que se descuenta la nota de crédito.
 * Null si no es nota, si ya se aplicó o si la original no lleva cuenta por pagar (personal o en dólares).
 */
async function compraParaNota(nota: FacturaDetalle): Promise<string | null> {
  if (nota.tipoDocumento !== "nota_credito" || nota.compraId) {
    return null;
  }
  if (!nota.facturaOrigenId) {
    throw new Error("La nota de crédito no tiene factura original. Manda facturaOrigen con el id o la clave de la factura");
  }
  const origen = await requireFactura(nota.facturaOrigenId);
  if (origen.esCompraPersonal || origen.moneda !== "DOP") {
    return null;
  }
  if (!origen.compraId) {
    throw new Error("La factura original todavía no está verificada. Boris tiene que verificarla antes que la nota de crédito");
  }
  if (nota.total == null || nota.total <= 0) {
    throw new Error("La nota de crédito no tiene total para descontar");
  }
  return origen.compraId;
}

/** Descuenta la nota de la cuenta por pagar. Si el saldo llega a cero, la cuenta queda pagada. */
async function aplicarNotaCredito(nota: FacturaDetalle, compraId: string): Promise<string> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("compras").select("monto, notas_credito, pagado").eq("id", compraId).maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error("No encontramos la cuenta por pagar de la factura original");
  }
  const notasCredito = toMoney(toMoney(data.notas_credito ?? 0) + (nota.total ?? 0));
  const saldado = notasCredito >= toMoney(data.monto);
  const { error: updateError } = await supabase
    .from("compras")
    .update({
      notas_credito: notasCredito,
      ...(saldado && !data.pagado ? { pagado: true, pagado_en: todayDayKey() } : {}),
    })
    .eq("id", compraId);
  if (updateError) {
    throw updateError;
  }
  return compraId;
}

export async function publicarVerificacion(
  idOrClave: string,
  body: Record<string, unknown>,
  actor: Actor
): Promise<FacturaDetalle> {
  if (actor !== "boris" && actor !== "admin") {
    throw new Error("Solo Boris puede marcar la factura verificada");
  }
  const factura = await requireFactura(idOrClave);
  const resultado = VERIFICACION_RESULTADOS.find((item) => item.id === body.resultado)?.id as VerificacionResultado | undefined;
  if (!resultado) {
    throw new Error("El resultado tiene que ser cuadra, falta o diferencia");
  }
  const nota = textOrNull(body.nota, 2000);
  const aplicarA = resultado === "cuadra" ? await compraParaNota(factura) : null;
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("factura_verificaciones").insert({
    factura_id: factura.id,
    resultado,
    rnc: textOrNull(body.rnc, 20),
    ncf: textOrNull(body.ncf, 20)?.toUpperCase() ?? null,
    monto_factura: moneyOrNull(body.montoFactura ?? body.monto_factura),
    monto_sistema: moneyOrNull(body.montoSistema ?? body.monto_sistema),
    monto_caja: moneyOrNull(body.montoCaja ?? body.monto_caja),
    monto_dgii: moneyOrNull(body.montoDgii ?? body.monto_dgii),
    nota,
  });
  if (error) {
    throw error;
  }
  if (resultado === "cuadra") {
    const compraId = aplicarA ? await aplicarNotaCredito(factura, aplicarA) : await abrirCuentaPorPagar(factura);
    await limpiarProblema(factura.id);
    const { error: updateError } = await supabase
      .from("facturas")
      .update({ estado: "verificada", ...(compraId ? { compra_id: compraId } : {}) })
      .eq("id", factura.id);
    if (updateError) {
      throw updateError;
    }
  } else {
    await marcarProblema(factura.id, "boris", nota ?? (resultado === "falta" ? "Falta un dato contra DGII, caja o sistema" : "Hay una diferencia de montos"));
  }
  return requireFactura(factura.id);
}

export async function publicarConciliacion(
  idOrClave: string,
  body: Record<string, unknown>,
  actor: Actor
): Promise<FacturaDetalle> {
  if (actor !== "fred" && actor !== "admin") {
    throw new Error("Solo Fred puede marcar la factura conciliada");
  }
  const factura = await requireFactura(idOrClave);
  const resultado = CONCILIACION_RESULTADOS.find((item) => item.id === body.resultado)?.id as ConciliacionResultado | undefined;
  if (!resultado) {
    throw new Error("El resultado tiene que ser pagada, vencida_sin_pagar, pagada_sin_movimiento o falta_factura");
  }
  const medioRaw = textOrNull(body.medio, 40);
  const medio = medioRaw ? (CONCILIACION_MEDIOS.find((item) => item.id === medioRaw)?.id as ConciliacionMedio | undefined) : null;
  if (medioRaw && !medio) {
    throw new Error("El medio tiene que ser banco, caja o cardnet");
  }
  const nota = textOrNull(body.nota, 2000);
  const ledgerId = body.ledgerId ?? body.ledger_id;
  const movimientoId = body.movimientoId ?? body.movimiento_id;
  const liga = ledgerId != null || movimientoId != null;
  if (liga && resultado !== "pagada") {
    throw new Error("Solo se liga un movimiento cuando el resultado es pagada");
  }
  const medioLigado: ConciliacionMedio = movimientoId != null ? "banco" : "caja";
  if (liga && medio && medio !== medioLigado) {
    throw new Error(`El movimiento es de ${medioLigado}. Manda medio ${medioLigado} o no mandes medio`);
  }
  const pago = liga ? await ligarPago(factura.id, { ledgerId, movimientoId }, actor) : null;
  const fecha = dayOrNull(body.fecha, "La fecha") ?? pago?.fecha ?? null;
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("factura_conciliaciones").insert({
    factura_id: factura.id,
    resultado,
    medio: medio ?? (pago ? pago.origen : null),
    fecha,
    referencia: textOrNull(body.referencia, 160) ?? pago?.referencia ?? null,
    monto: moneyOrNull(body.monto) ?? pago?.monto ?? null,
    nota,
  });
  if (error) {
    throw error;
  }
  if (resultado === "pagada") {
    if (factura.compraId) {
      await updateCompra(factura.compraId, { pagado: true, pagadoEn: fecha ?? todayDayKey() });
    }
    await limpiarProblema(factura.id);
    const { error: updateError } = await supabase.from("facturas").update({ estado: "conciliada" }).eq("id", factura.id);
    if (updateError) {
      throw updateError;
    }
  } else if (resultado === "falta_factura") {
    await limpiarProblema(factura.id);
    const { error: updateError } = await supabase.from("facturas").update({ estado: "falta_factura" }).eq("id", factura.id);
    if (updateError) {
      throw updateError;
    }
  } else {
    await marcarProblema(
      factura.id,
      "fred",
      nota ?? (resultado === "vencida_sin_pagar" ? "Vencida sin pagar" : "Pagada sin movimiento")
    );
  }
  return requireFactura(factura.id);
}

/** Fred liga una salida de caja o un débito del banco sin cerrar todavía la conciliación. */
export async function ligarPagoCaja(idOrClave: string, body: Record<string, unknown>, actor: Actor): Promise<FacturaDetalle> {
  const factura = await requireFactura(idOrClave);
  if (factura.estado === "conciliada") {
    throw new Error("La factura ya está conciliada");
  }
  await ligarPago(factura.id, { ledgerId: body.ledgerId ?? body.ledger_id, movimientoId: body.movimientoId ?? body.movimiento_id }, actor);
  return requireFactura(factura.id);
}

export async function quitarPagoCaja(idOrClave: string, pagoId: string, actor: Actor): Promise<FacturaDetalle> {
  const factura = await requireFactura(idOrClave);
  if (factura.estado === "conciliada") {
    throw new Error("La factura ya está conciliada. Ábrele una excepción si el pago estaba mal");
  }
  await quitarPago(factura.id, pagoId, actor);
  return requireFactura(factura.id);
}

function mapDecision(row: Record<string, unknown>, referencia: string | null, today: string): Decision | null {
  const id = String(row.id ?? "");
  const autor = String(row.autor ?? "");
  const estado = row.estado === "si" || row.estado === "no" || row.estado === "pendiente" ? row.estado : null;
  const pregunta = textOrNull(row.pregunta, 2000);
  const creadaEn = iso(row.creada_en);
  if (!id || !esOperacionBot(autor) || !estado || !pregunta || !creadaEn) {
    return null;
  }
  const venceEn = typeof row.vence_en === "string" ? row.vence_en.slice(0, 10) : null;
  return {
    id,
    facturaId: typeof row.factura_id === "string" ? row.factura_id : null,
    facturaReferencia: referencia,
    autor,
    pregunta,
    monto: row.monto == null ? null : toMoney(row.monto),
    venceEn,
    siNoContesta: textOrNull(row.si_no_contesta, 400) ?? "queda en espera",
    estado,
    vencida: decisionVencida(venceEn, today, estado),
    resueltaEn: iso(row.resuelta_en),
    creadaEn,
  };
}

export async function listarDecisiones(): Promise<Decision[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("decisiones").select("*").order("creada_en", { ascending: true }).limit(500);
  if (error) {
    throw error;
  }
  const facturaIds = Array.from(new Set((data ?? []).map((row) => (typeof row.factura_id === "string" ? row.factura_id : "")).filter(Boolean)));
  const referencias = new Map<string, string>();
  if (facturaIds.length) {
    const facturas = await supabase.from("facturas").select("id, proveedor, numero_factura, total").in("id", facturaIds);
    if (facturas.error) {
      throw facturas.error;
    }
    for (const row of facturas.data ?? []) {
      const id = String(row.id);
      const proveedor = textOrNull(row.proveedor, 120) ?? "Factura";
      const numero = textOrNull(row.numero_factura, 40);
      referencias.set(id, numero ? `${proveedor} ${numero}` : proveedor);
    }
  }
  const today = todayDayKey();
  return (data ?? [])
    .map((row) => mapDecision(row as Record<string, unknown>, referencias.get(String(row.factura_id ?? "")) ?? null, today))
    .filter((row): row is Decision => Boolean(row))
    .sort(compararDecisiones);
}

export async function abrirDecision(body: Record<string, unknown>, actor: Actor): Promise<Decision> {
  const autor = actorBot(actor);
  const pregunta = textOrNull(body.pregunta, 2000);
  if (!pregunta) {
    throw new Error("La pregunta no puede ir vacía");
  }
  const facturaId = textOrNull(body.facturaId ?? body.factura_id, 80);
  if (facturaId && !isUuid(facturaId)) {
    throw new Error("No encontramos esa factura");
  }
  const siNoContesta = textOrNull(body.siNoContesta ?? body.si_no_contesta, 400) ?? "queda en espera";
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("decisiones")
    .insert({
      factura_id: facturaId,
      autor,
      pregunta,
      monto: moneyOrNull(body.monto),
      vence_en: dayOrNull(body.venceEn ?? body.vence_en, "La fecha de vencimiento"),
      si_no_contesta: siNoContesta,
    })
    .select("*")
    .single();
  if (error) {
    throw error;
  }
  const decision = mapDecision(data as Record<string, unknown>, null, todayDayKey());
  if (!decision) {
    throw new Error("No pudimos guardar la decisión");
  }
  return decision;
}

export async function responderDecision(id: string, respuesta: DecisionEstado): Promise<Decision> {
  if (!isUuid(id)) {
    throw new Error("No encontramos esa decisión");
  }
  if (respuesta !== "si" && respuesta !== "no") {
    throw new Error("La respuesta tiene que ser sí o no");
  }
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("decisiones")
    .update({ estado: respuesta, resuelta_en: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error("No encontramos esa decisión");
  }
  const decision = mapDecision(data as Record<string, unknown>, null, todayDayKey());
  if (!decision) {
    throw new Error("No pudimos guardar la decisión");
  }
  return decision;
}

function mapExcepcion(row: Record<string, unknown>, referencia: string | null): Excepcion | null {
  const id = String(row.id ?? "");
  const autor = String(row.autor ?? "");
  const dueno = String(row.dueno ?? "");
  const estado = row.estado === "abierta" || row.estado === "resuelta" ? row.estado : null;
  const queFalta = textOrNull(row.que_falta, 2000);
  const abiertaEn = iso(row.abierta_en);
  if (!id || !esOperacionBot(autor) || !esOperacionBot(dueno) || !estado || !queFalta || !abiertaEn) {
    return null;
  }
  return {
    id,
    facturaId: typeof row.factura_id === "string" ? row.factura_id : null,
    facturaReferencia: referencia,
    autor,
    dueno,
    queFalta,
    caso: textOrNull(row.caso, 80),
    estado,
    resolucion: textOrNull(row.resolucion, 2000),
    abiertaEn,
    resueltaEn: iso(row.resuelta_en),
  };
}

export async function listarExcepciones(soloAbiertas = false): Promise<Excepcion[]> {
  const supabase = getSupabaseAdminClient();
  let query = supabase.from("excepciones").select("*").order("abierta_en", { ascending: true }).limit(500);
  if (soloAbiertas) {
    query = query.eq("estado", "abierta");
  }
  const { data, error } = await query;
  if (error) {
    throw error;
  }
  const facturaIds = Array.from(new Set((data ?? []).map((row) => (typeof row.factura_id === "string" ? row.factura_id : "")).filter(Boolean)));
  const referencias = new Map<string, string>();
  if (facturaIds.length) {
    const facturas = await supabase.from("facturas").select("id, proveedor, numero_factura").in("id", facturaIds);
    if (facturas.error) {
      throw facturas.error;
    }
    for (const row of facturas.data ?? []) {
      const proveedor = textOrNull(row.proveedor, 120) ?? "Factura";
      const numero = textOrNull(row.numero_factura, 40);
      referencias.set(String(row.id), numero ? `${proveedor} ${numero}` : proveedor);
    }
  }
  return (data ?? [])
    .map((row) => mapExcepcion(row as Record<string, unknown>, referencias.get(String(row.factura_id ?? "")) ?? null))
    .filter((row): row is Excepcion => Boolean(row));
}

export async function abrirExcepcion(body: Record<string, unknown>, actor: Actor): Promise<Excepcion> {
  if (actor !== "boris" && actor !== "hans" && actor !== "fred" && actor !== "matt" && actor !== "admin") {
    throw new Error("Este acceso no puede abrir una excepción");
  }
  const autor = actor === "admin" ? "matt" : actorBot(actor);
  const queFalta = textOrNull(body.queFalta ?? body.que_falta, 2000);
  if (!queFalta) {
    throw new Error("Hay que decir qué falta");
  }
  const duenoRaw = textOrNull(body.dueno, 40) ?? "matt";
  if (!esOperacionBot(duenoRaw)) {
    throw new Error("El dueño no es válido");
  }
  const facturaId = textOrNull(body.facturaId ?? body.factura_id, 80);
  if (facturaId && !isUuid(facturaId)) {
    throw new Error("No encontramos esa factura");
  }
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("excepciones")
    .insert({ factura_id: facturaId, autor, dueno: duenoRaw, que_falta: queFalta })
    .select("*")
    .single();
  if (error) {
    throw error;
  }
  const excepcion = mapExcepcion(data as Record<string, unknown>, null);
  if (!excepcion) {
    throw new Error("No pudimos guardar la excepción");
  }
  return excepcion;
}

export async function resolverExcepcion(id: string, body: Record<string, unknown>, actor: Actor): Promise<Excepcion> {
  if (actor !== "matt" && actor !== "admin") {
    throw new Error("Solo Matt cierra la excepción");
  }
  if (!isUuid(id)) {
    throw new Error("No encontramos esa excepción");
  }
  const resolucion = textOrNull(body.resolucion, 2000);
  if (!resolucion) {
    throw new Error("La resolución no puede ir vacía");
  }
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("excepciones")
    .update({ estado: "resuelta", resolucion, resuelta_en: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error("No encontramos esa excepción");
  }
  const excepcion = mapExcepcion(data as Record<string, unknown>, null);
  if (!excepcion) {
    throw new Error("No pudimos guardar la excepción");
  }
  return excepcion;
}

type VersionRow = {
  id: string;
  mes: string;
  numero: number;
  estado: CierreEstado;
  nota: string | null;
  corrige_numero: number | null;
  aprobada_en: string | null;
  creada_en: string;
};

async function listarVersiones(mes: string): Promise<VersionRow[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("cierre_versiones").select("*").eq("mes", mes).order("numero", { ascending: true });
  if (error) {
    throw error;
  }
  return (data ?? []).flatMap((row) => {
    const estado = row.estado === "preliminar" || row.estado === "aprobada" ? row.estado : null;
    const creadaEn = iso(row.creada_en);
    if (!row.id || !estado || !creadaEn) {
      return [];
    }
    return [
      {
        id: String(row.id),
        mes,
        numero: Number(row.numero),
        estado,
        nota: textOrNull(row.nota, 2000),
        corrige_numero: row.corrige_numero == null ? null : Number(row.corrige_numero),
        aprobada_en: iso(row.aprobada_en),
        creada_en: creadaEn,
      },
    ];
  });
}

async function crearVersion(mes: string, numero: number, corrigeNumero: number | null): Promise<VersionRow> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cierre_versiones")
    .insert({ mes, numero, estado: "preliminar", corrige_numero: corrigeNumero })
    .select("*")
    .single();
  if (error) {
    throw error;
  }
  const versionId = String(data.id);
  const entregas = CIERRE_BOTS.map((bot) => ({ version_id: versionId, bot, estado: "pendiente" }));
  const insert = await supabase.from("cierre_entregas").insert(entregas);
  if (insert.error) {
    throw insert.error;
  }
  const versions = await listarVersiones(mes);
  const created = versions.find((item) => item.id === versionId);
  if (!created) {
    throw new Error("No pudimos abrir la versión");
  }
  return created;
}

export async function abrirVersion(mesInput: string): Promise<VersionRow> {
  const mes = requireMes(mesInput);
  const versions = await listarVersiones(mes);
  const latest = versions[versions.length - 1] ?? null;
  if (!latest) {
    return crearVersion(mes, 1, null);
  }
  if (latest.estado === "preliminar") {
    return latest;
  }
  return crearVersion(mes, latest.numero + 1, latest.numero);
}

async function versionParaEscribir(mes: string): Promise<VersionRow> {
  const versions = await listarVersiones(mes);
  const latest = versions[versions.length - 1] ?? null;
  if (!latest) {
    return crearVersion(mes, 1, null);
  }
  assertVersionEditable(latest.estado);
  return latest;
}

function mapEntrega(row: Record<string, unknown>): CierreEntrega | null {
  const bot = String(row.bot ?? "");
  if (!esCierreBot(bot)) {
    return null;
  }
  return {
    bot,
    estado: row.estado === "entregado" ? "entregado" : "pendiente",
    resumen: textOrNull(row.resumen, 2000),
    entregadoEn: iso(row.entregado_en),
  };
}

function mapAsiento(row: Record<string, unknown>): Asiento | null {
  const id = String(row.id ?? "");
  const cuenta = textOrNull(row.cuenta, 200);
  const numero = Number(row.numero);
  if (!id || !cuenta || !Number.isFinite(numero)) {
    return null;
  }
  return {
    id,
    numero,
    fecha: typeof row.fecha === "string" ? row.fecha.slice(0, 10) : null,
    cuenta,
    debe: toMoney(row.debe),
    haber: toMoney(row.haber),
    facturaId: typeof row.factura_id === "string" ? row.factura_id : null,
    ledgerId: typeof row.ledger_id === "string" ? row.ledger_id : null,
    nota: textOrNull(row.nota, 1000),
  };
}

function idsDe(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string" && isUuid(item));
}

function mapLinea(row: Record<string, unknown>, anterior: Map<string, number>): ReporteLinea | null {
  const id = String(row.id ?? "");
  const tipo = REPORTE_TIPOS.find((item) => item.id === row.tipo)?.id as ReporteTipo | undefined;
  const concepto = textOrNull(row.concepto, 300);
  const orden = Number(row.orden);
  if (!id || !tipo || !concepto || !Number.isFinite(orden)) {
    return null;
  }
  return {
    id,
    tipo,
    orden,
    concepto,
    monto: toMoney(row.monto),
    montoAnterior: anterior.get(`${tipo}:${concepto.toLowerCase()}`) ?? null,
    facturaIds: idsDe(row.factura_ids),
    asientoIds: idsDe(row.asiento_ids),
    ledgerIds: idsDe(row.ledger_ids),
  };
}

async function cargarVersion(version: VersionRow, anterior: Map<string, number>): Promise<CierreVersion> {
  const supabase = getSupabaseAdminClient();
  const [entregas, asientos, lineas] = await Promise.all([
    supabase.from("cierre_entregas").select("*").eq("version_id", version.id),
    supabase.from("asientos").select("*").eq("version_id", version.id).order("numero", { ascending: true }),
    supabase.from("reporte_lineas").select("*").eq("version_id", version.id).order("orden", { ascending: true }),
  ]);
  if (entregas.error) {
    throw entregas.error;
  }
  if (asientos.error) {
    throw asientos.error;
  }
  if (lineas.error) {
    throw lineas.error;
  }
  const porBot = new Map<CierreBot, CierreEntrega>();
  for (const bot of CIERRE_BOTS) {
    porBot.set(bot, { bot, estado: "pendiente", resumen: null, entregadoEn: null });
  }
  for (const row of entregas.data ?? []) {
    const entrega = mapEntrega(row as Record<string, unknown>);
    if (entrega) {
      porBot.set(entrega.bot, entrega);
    }
  }
  return {
    id: version.id,
    mes: version.mes,
    numero: version.numero,
    estado: version.estado,
    nota: version.nota,
    corrigeNumero: version.corrige_numero,
    aprobadaEn: version.aprobada_en,
    creadaEn: version.creada_en,
    entregas: CIERRE_BOTS.map((bot) => porBot.get(bot) as CierreEntrega),
    asientos: (asientos.data ?? []).map((row) => mapAsiento(row as Record<string, unknown>)).filter((row): row is Asiento => Boolean(row)),
    lineas: (lineas.data ?? []).map((row) => mapLinea(row as Record<string, unknown>, anterior)).filter((row): row is ReporteLinea => Boolean(row)),
  };
}

async function montosAprobados(mes: string): Promise<Map<string, number>> {
  const versions = await listarVersiones(mes);
  const aprobada = [...versions].reverse().find((item) => item.estado === "aprobada");
  const map = new Map<string, number>();
  if (!aprobada) {
    return map;
  }
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("reporte_lineas").select("tipo, concepto, monto").eq("version_id", aprobada.id);
  if (error) {
    throw error;
  }
  for (const row of data ?? []) {
    const tipo = typeof row.tipo === "string" ? row.tipo : "";
    const concepto = textOrNull(row.concepto, 300);
    if (concepto) {
      map.set(`${tipo}:${concepto.toLowerCase()}`, toMoney(row.monto));
    }
  }
  return map;
}

function lineaDe(version: CierreVersion | null, match: (concepto: string) => boolean): ReporteLinea | null {
  return version?.lineas.find((linea) => linea.tipo === "resultados" && match(linea.concepto)) ?? null;
}

async function resumenNumeros(mes: string, aprobada: CierreVersion | null, actual: CierreVersion | null): Promise<CierreResumenNumeros> {
  const { desde, hasta } = monthBounds(mes);
  const supabase = getSupabaseAdminClient();
  const [ventas, meta, compras, personales, facturas, balances] = await Promise.all([
    supabase.from("ventas_diarias").select("venta_real").gte("fecha", desde).lte("fecha", hasta),
    supabase.from("metas_mensuales").select("meta").eq("mes", `${mes}-01`).maybeSingle(),
    supabase.from("compras").select("id, monto, due_date, pagado").eq("pagado", false).limit(2000),
    supabase.from("facturas").select("compra_id").eq("es_compra_personal", true).not("compra_id", "is", null),
    supabase.from("facturas").select("itbis_total, estado, fecha_emision").in("estado", ["verificada", "conciliada"]).gte("fecha_emision", desde).lte("fecha_emision", hasta),
    getTodosLosBalances(),
  ]);
  for (const result of [ventas, meta, compras, personales, facturas]) {
    if (result.error) {
      throw result.error;
    }
  }
  const personalIds = new Set((personales.data ?? []).map((row) => String(row.compra_id)));
  const today = todayDayKey();
  const week = new Date(`${today}T12:00:00.000Z`);
  week.setUTCDate(week.getUTCDate() + 7);
  const weekKey = week.toISOString().slice(0, 10);
  const porPagar = { vencido: 0, estaSemana: 0, despues: 0 };
  for (const row of compras.data ?? []) {
    if (personalIds.has(String(row.id))) {
      continue;
    }
    const monto = toMoney(row.monto);
    const due = typeof row.due_date === "string" ? row.due_date.slice(0, 10) : "";
    if (due && due < today) {
      porPagar.vencido = toMoney(porPagar.vencido + monto);
    } else if (due && due < weekKey) {
      porPagar.estaSemana = toMoney(porPagar.estaSemana + monto);
    } else {
      porPagar.despues = toMoney(porPagar.despues + monto);
    }
  }
  const ventaTotal = (ventas.data ?? []).reduce((sum, row) => sum + toMoney(row.venta_real), 0);
  const metaValor = meta.data?.meta == null ? null : toMoney(meta.data.meta);
  const margen = lineaDe(actual, conceptoEsMargen) ?? lineaDe(aprobada, conceptoEsMargen);
  const ganancia = lineaDe(actual, conceptoEsGanancia) ?? lineaDe(aprobada, conceptoEsGanancia);
  const itbis = (facturas.data ?? []).reduce((sum, row) => sum + toMoney(row.itbis_total), 0);
  return {
    ventas: toMoney(ventaTotal),
    meta: metaValor,
    diferenciaMeta: metaValor == null ? null : toMoney(ventaTotal - metaValor),
    cajaDisponibleDop: toMoney(balances.fuerteDop + balances.chicaDop),
    cajaFuerteUsd: balances.fuerteUsd,
    margenBruto: margen ? margen.monto : null,
    gananciaNeta: ganancia ? ganancia.monto : null,
    margenBrutoAnterior: margen?.montoAnterior ?? null,
    gananciaNetaAnterior: ganancia?.montoAnterior ?? null,
    itbisAFavor: toMoney(itbis),
    porPagar,
  };
}

export async function cargarCierre(mesInput: string): Promise<CierrePanel> {
  const mes = requireMes(mesInput);
  const versions = await listarVersiones(mes);
  const actualRow = versions[versions.length - 1] ?? null;
  const aprobadaRow = [...versions].reverse().find((item) => item.estado === "aprobada") ?? null;
  const previo = mesAnterior(mes);
  const anterior = previo ? await montosAprobados(previo) : new Map<string, number>();
  const actual = actualRow ? await cargarVersion(actualRow, anterior) : null;
  const aprobada = aprobadaRow && aprobadaRow.id !== actualRow?.id ? await cargarVersion(aprobadaRow, anterior) : actualRow?.estado === "aprobada" ? actual : null;
  return {
    mes,
    preliminar: !actual || actual.estado === "preliminar",
    actual,
    aprobada,
    versiones: versions.map((item) => ({ numero: item.numero, estado: item.estado, aprobadaEn: item.aprobada_en })),
    resumen: await resumenNumeros(mes, aprobada, actual),
  };
}

function leerAsientos(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("Manda los asientos en lineas");
  }
  return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
}

export async function publicarAsientos(mesInput: string, body: Record<string, unknown>, actor: Actor): Promise<CierreVersion> {
  if (actor !== "hans" && actor !== "admin") {
    throw new Error("Solo Hans publica los asientos");
  }
  const mes = requireMes(mesInput);
  const version = await versionParaEscribir(mes);
  const lineas = leerAsientos(body.lineas ?? body.asientos);
  const supabase = getSupabaseAdminClient();
  if (body.reemplazar === true) {
    const deleted = await supabase.from("asientos").delete().eq("version_id", version.id);
    if (deleted.error) {
      throw deleted.error;
    }
  }
  for (const linea of lineas) {
    const numero = Number(linea.numero);
    const cuenta = textOrNull(linea.cuenta, 200);
    if (!Number.isInteger(numero) || numero < 1 || !cuenta) {
      throw new Error("Cada asiento necesita numero y cuenta");
    }
    const debe = moneyOrNull(linea.debe) ?? 0;
    const haber = moneyOrNull(linea.haber) ?? 0;
    if (debe < 0 || haber < 0 || (debe === 0 && haber === 0)) {
      throw new Error("Cada asiento necesita debe o haber");
    }
    const facturaId = textOrNull(linea.facturaId ?? linea.factura_id, 80);
    const ledgerId = textOrNull(linea.ledgerId ?? linea.ledger_id, 80);
    if ((facturaId && !isUuid(facturaId)) || (ledgerId && !isUuid(ledgerId))) {
      throw new Error("La factura o el movimiento del asiento no es válido");
    }
    const saved = await supabase.from("asientos").upsert(
      {
        version_id: version.id,
        numero,
        fecha: dayOrNull(linea.fecha, "La fecha"),
        cuenta,
        debe,
        haber,
        factura_id: facturaId,
        ledger_id: ledgerId,
        nota: textOrNull(linea.nota, 1000),
      },
      { onConflict: "version_id,numero" }
    );
    if (saved.error) {
      throw saved.error;
    }
  }
  await marcarEntrega(version.id, "hans", textOrNull(body.resumen, 2000));
  const panel = await cargarCierre(mes);
  if (!panel.actual) {
    throw new Error("No pudimos leer el cierre");
  }
  return panel.actual;
}

async function marcarEntrega(versionId: string, bot: CierreBot, resumen: string | null): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("cierre_entregas").upsert(
    {
      version_id: versionId,
      bot,
      estado: "entregado",
      resumen,
      entregado_en: new Date().toISOString(),
    },
    { onConflict: "version_id,bot" }
  );
  if (error) {
    throw error;
  }
}

export async function publicarEntrega(mesInput: string, body: Record<string, unknown>, actor: Actor): Promise<CierreVersion> {
  const mes = requireMes(mesInput);
  const bot = textOrNull(body.bot, 40) ?? (esCierreBot(actor) ? actor : null);
  if (!bot || !esCierreBot(bot)) {
    throw new Error("La entrega tiene que ser de Hans, Fred o Robert");
  }
  if (actor !== bot && actor !== "admin") {
    throw new Error("Este acceso no puede escribir esa parte");
  }
  const version = await versionParaEscribir(mes);
  await marcarEntrega(version.id, bot, textOrNull(body.resumen, 2000));
  const panel = await cargarCierre(mes);
  if (!panel.actual) {
    throw new Error("No pudimos leer el cierre");
  }
  return panel.actual;
}

export async function publicarReporte(mesInput: string, body: Record<string, unknown>, actor: Actor): Promise<CierreVersion> {
  if (actor !== "robert" && actor !== "admin") {
    throw new Error("Solo Robert publica los estados");
  }
  const mes = requireMes(mesInput);
  const tipo = REPORTE_TIPOS.find((item) => item.id === body.tipo)?.id as ReporteTipo | undefined;
  if (!tipo) {
    throw new Error("El tipo tiene que ser resultados, balance o flujo");
  }
  const lineas = leerAsientos(body.lineas);
  const version = await versionParaEscribir(mes);
  const supabase = getSupabaseAdminClient();
  const deleted = await supabase.from("reporte_lineas").delete().eq("version_id", version.id).eq("tipo", tipo);
  if (deleted.error) {
    throw deleted.error;
  }
  const rows = lineas.map((linea, index) => {
    const concepto = textOrNull(linea.concepto, 300);
    if (!concepto) {
      throw new Error("Cada línea necesita concepto");
    }
    const orden = Number(linea.orden ?? index + 1);
    if (!Number.isInteger(orden) || orden < 1) {
      throw new Error("El orden de la línea no es válido");
    }
    return {
      version_id: version.id,
      tipo,
      orden,
      concepto,
      monto: moneyOrNull(linea.monto) ?? 0,
      factura_ids: idsDe(linea.facturaIds ?? linea.factura_ids),
      asiento_ids: idsDe(linea.asientoIds ?? linea.asiento_ids),
      ledger_ids: idsDe(linea.ledgerIds ?? linea.ledger_ids),
    };
  });
  const inserted = await supabase.from("reporte_lineas").insert(rows);
  if (inserted.error) {
    throw inserted.error;
  }
  await marcarEntrega(version.id, "robert", textOrNull(body.resumen, 2000));
  const panel = await cargarCierre(mes);
  if (!panel.actual) {
    throw new Error("No pudimos leer el cierre");
  }
  return panel.actual;
}

export async function aprobarCierre(mesInput: string, body: Record<string, unknown>, actor: Actor): Promise<CierrePanel> {
  if (actor !== "troy" && actor !== "admin") {
    throw new Error("Solo Troy aprueba el cierre");
  }
  const mes = requireMes(mesInput);
  const versions = await listarVersiones(mes);
  const latest = versions[versions.length - 1] ?? null;
  if (!latest) {
    throw new Error("Todavía no hay una versión de ese mes");
  }
  const nota = textOrNull(body.nota, 2000);
  const aprobar = body.aprobar === true;
  const supabase = getSupabaseAdminClient();
  if (!aprobar) {
    const { error } = await supabase.from("cierre_versiones").update({ nota }).eq("id", latest.id);
    if (error) {
      throw error;
    }
    return cargarCierre(mes);
  }
  assertVersionEditable(latest.estado);
  const { error } = await supabase
    .from("cierre_versiones")
    .update({ estado: "aprobada", nota, aprobada_en: new Date().toISOString() })
    .eq("id", latest.id);
  if (error) {
    throw error;
  }
  return cargarCierre(mes);
}

