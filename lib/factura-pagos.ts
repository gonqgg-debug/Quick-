import { BANCO_DIAS_DESPUES, distanciaVentana, ventanaBanco } from "@/lib/banco-shared";
import {
  PAGO_DIAS,
  PAGO_TOLERANCIA,
  confianzaPago,
  isUuid,
  type FacturaPago,
  type FacturaPagoCandidato,
  type FacturaResumen,
} from "@/lib/facturas-shared";
import { addDaysToDayKey, diffDayKeys, localDayKey } from "@/lib/local-day";
import { toMoney } from "@/lib/money";
import type { Actor } from "@/lib/operacion-shared";
import { getSupabaseAdminClient } from "@/lib/supabase";

type LedgerRow = { id?: unknown; fecha?: unknown; caja?: unknown; concepto?: unknown; referencia?: unknown; monto?: unknown; tipo?: unknown; moneda?: unknown };
type MovimientoRow = { id?: unknown; fecha?: unknown; banco?: unknown; descripcion?: unknown; referencia?: unknown; monto?: unknown; tipo?: unknown; moneda?: unknown };

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function fechaDe(value: unknown): string | null {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null;
}

function uno<T>(value: T | T[] | null | undefined): T | null {
  return (Array.isArray(value) ? value[0] : value) ?? null;
}

export async function pagosDe(facturaId: string): Promise<FacturaPago[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("factura_pagos")
    .select(
      "id, ledger_id, movimiento_id, monto, confirmado_por, confirmado_en, confianza, razon, caja_ledger ( fecha, caja, concepto, referencia ), banco_movimientos ( fecha, banco, descripcion, referencia )"
    )
    .eq("factura_id", facturaId)
    .order("confirmado_en", { ascending: true });
  if (error) {
    throw error;
  }
  return (data ?? []).map((row) => {
    const ledger = uno(row.caja_ledger as LedgerRow | LedgerRow[] | null);
    const movimiento = uno(row.banco_movimientos as MovimientoRow | MovimientoRow[] | null);
    const banco = Boolean(row.movimiento_id);
    return {
      id: String(row.id),
      origen: banco ? "banco" : "caja",
      ledgerId: row.ledger_id ? String(row.ledger_id) : null,
      movimientoId: row.movimiento_id ? String(row.movimiento_id) : null,
      fecha: fechaDe(banco ? movimiento?.fecha : ledger?.fecha),
      caja: text(banco ? movimiento?.banco : ledger?.caja),
      concepto: text(banco ? movimiento?.descripcion : ledger?.concepto),
      referencia: text(banco ? movimiento?.referencia : ledger?.referencia),
      monto: toMoney(row.monto),
      confirmadoPor: text(row.confirmado_por) ?? "—",
      confirmadoEn: String(row.confirmado_en),
      confianza: row.confianza == null ? null : Number(row.confianza),
      razon: text(row.razon),
    };
  });
}

async function ocupados(columna: "ledger_id" | "movimiento_id", ids: string[]): Promise<Set<string>> {
  if (!ids.length) {
    return new Set();
  }
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("factura_pagos").select(columna).in(columna, ids);
  if (error) {
    throw error;
  }
  return new Set((data ?? []).map((row) => String((row as Record<string, unknown>)[columna])));
}

/** Salidas de caja en DOP a ±1 día y ±RD$ 5 del total que todavía no pagan otra factura. */
async function candidatosCaja(factura: FacturaResumen & { total: number }, fecha: string): Promise<FacturaPagoCandidato[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("caja_ledger")
    .select("id, fecha, caja, concepto, referencia, monto")
    .eq("tipo", "Salida")
    .eq("moneda", "DOP")
    .gte("fecha", addDaysToDayKey(fecha, -PAGO_DIAS))
    .lte("fecha", addDaysToDayKey(fecha, PAGO_DIAS))
    .gte("monto", factura.total - PAGO_TOLERANCIA)
    .lte("monto", factura.total + PAGO_TOLERANCIA)
    .limit(20);
  if (error) {
    throw error;
  }
  const usados = await ocupados("ledger_id", (data ?? []).map((row) => String(row.id)));
  const candidatos: FacturaPagoCandidato[] = [];
  for (const row of data ?? []) {
    const fechaPago = fechaDe(row.fecha);
    if (!fechaPago || usados.has(String(row.id))) {
      continue;
    }
    const monto = toMoney(row.monto);
    const confianza = confianzaPago({
      total: factura.total,
      monto,
      diasDeDiferencia: diffDayKeys(fecha, fechaPago),
      proveedor: factura.proveedor,
      concepto: text(row.concepto),
      referencia: text(row.referencia),
    });
    if (confianza != null) {
      candidatos.push({
        origen: "caja",
        ledgerId: String(row.id),
        movimientoId: null,
        fecha: fechaPago,
        caja: text(row.caja),
        concepto: text(row.concepto),
        referencia: text(row.referencia),
        monto,
        confianza,
      });
    }
  }
  return candidatos;
}

/** Débitos del banco en DOP por el total (±RD$ 5), desde un día antes de la emisión hasta 7 días después del vencimiento. */
async function candidatosBanco(factura: FacturaResumen & { total: number }, recibidaDia: string): Promise<FacturaPagoCandidato[]> {
  const ventana = ventanaBanco({ fechaEmision: factura.fechaEmision, fechaVencimiento: factura.fechaVencimiento, recibidaDia });
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("banco_movimientos")
    .select("id, fecha, banco, descripcion, referencia, monto")
    .eq("tipo", "debito")
    .eq("moneda", "DOP")
    .gte("fecha", ventana.desde)
    .lte("fecha", addDaysToDayKey(ventana.hasta, BANCO_DIAS_DESPUES))
    .gte("monto", factura.total - PAGO_TOLERANCIA)
    .lte("monto", factura.total + PAGO_TOLERANCIA)
    .limit(20);
  if (error) {
    throw error;
  }
  const usados = await ocupados("movimiento_id", (data ?? []).map((row) => String(row.id)));
  const candidatos: FacturaPagoCandidato[] = [];
  for (const row of data ?? []) {
    const fechaPago = fechaDe(row.fecha);
    if (!fechaPago || usados.has(String(row.id))) {
      continue;
    }
    const monto = toMoney(row.monto);
    const confianza = confianzaPago({
      total: factura.total,
      monto,
      diasDeDiferencia: distanciaVentana(fechaPago, ventana.desde, ventana.hasta),
      proveedor: factura.proveedor,
      concepto: text(row.descripcion),
      referencia: text(row.referencia),
      maxDias: BANCO_DIAS_DESPUES,
    });
    if (confianza != null) {
      candidatos.push({
        origen: "banco",
        ledgerId: null,
        movimientoId: String(row.id),
        fecha: fechaPago,
        caja: text(row.banco),
        concepto: text(row.descripcion),
        referencia: text(row.referencia),
        monto,
        confianza,
      });
    }
  }
  return candidatos;
}

/** Movimientos de caja y del banco que podrían ser el pago, los más seguros primero. */
export async function candidatosPago(factura: FacturaResumen): Promise<FacturaPagoCandidato[]> {
  if (factura.moneda !== "DOP" || factura.total == null || factura.total <= 0 || factura.estado === "conciliada" || factura.tipoDocumento === "nota_credito") {
    return [];
  }
  const conTotal = { ...factura, total: factura.total };
  const recibidaDia = localDayKey(factura.recibidoEn);
  const [caja, banco] = await Promise.all([candidatosCaja(conTotal, factura.fechaEmision ?? recibidaDia), candidatosBanco(conTotal, recibidaDia)]);
  return [...caja, ...banco].sort((a, b) => b.confianza - a.confianza);
}

function puedeLigar(actor: Actor): void {
  if (actor !== "fred" && actor !== "admin") {
    throw new Error("Solo Fred liga los pagos");
  }
}

export type PagoLigado = { origen: "caja" | "banco"; fecha: string | null; monto: number; referencia: string | null };

type Juicio = { confianza: number | null; razon: string | null };

/** Fred deja su confianza y su razón; el admin puede ligar sin ellas. */
function juicioDe(body: { confianza?: unknown; razon?: unknown }, actor: Actor): Juicio {
  const confianza = body.confianza == null || body.confianza === "" ? null : Number(body.confianza);
  if (confianza != null && (!Number.isFinite(confianza) || confianza < 0 || confianza > 100)) {
    throw new Error("La confianza tiene que ser un número de 0 a 100");
  }
  const razon = typeof body.razon === "string" && body.razon.trim() ? body.razon.trim().slice(0, 500) : null;
  if (actor === "fred" && (confianza == null || !razon || razon.length < 3)) {
    throw new Error("Manda confianza (0 a 100) y razon de por qué ese movimiento es el pago");
  }
  return { confianza: confianza == null ? null : Math.round(confianza), razon };
}

async function insertarPago(
  facturaId: string,
  fila: { ledger_id: string } | { movimiento_id: string },
  monto: number,
  actor: Actor,
  body: { confianza?: unknown; razon?: unknown }
): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const columna = "ledger_id" in fila ? "ledger_id" : "movimiento_id";
  const valor = "ledger_id" in fila ? fila.ledger_id : fila.movimiento_id;
  const { data: existente, error: existenteError } = await supabase.from("factura_pagos").select("factura_id").eq(columna, valor).maybeSingle();
  if (existenteError) {
    throw existenteError;
  }
  if (existente && existente.factura_id !== facturaId) {
    throw new Error("Ese movimiento ya paga otra factura");
  }
  if (existente) {
    return;
  }
  const juicio = juicioDe(body, actor);
  const { error } = await supabase
    .from("factura_pagos")
    .insert({ factura_id: facturaId, ...fila, monto, confirmado_por: actor === "admin" ? "Admin" : "Fred", confianza: juicio.confianza, razon: juicio.razon });
  if (error) {
    if (error.code === "23505") {
      throw new Error("Ese movimiento ya paga otra factura");
    }
    throw error;
  }
}

function idDe(value: unknown): string | null {
  const id = typeof value === "string" ? value.trim() : "";
  return id ? id : null;
}

/** Liga una salida de caja (ledgerId) o un débito del banco (movimientoId). Un movimiento solo puede pagar una factura. */
export async function ligarPago(
  facturaId: string,
  body: { ledgerId?: unknown; movimientoId?: unknown; confianza?: unknown; razon?: unknown },
  actor: Actor
): Promise<PagoLigado> {
  puedeLigar(actor);
  const ledgerId = idDe(body.ledgerId);
  const movimientoId = idDe(body.movimientoId);
  if ((ledgerId ? 1 : 0) + (movimientoId ? 1 : 0) !== 1) {
    throw new Error("Manda ledgerId (caja) o movimientoId (banco), uno de los dos");
  }
  const supabase = getSupabaseAdminClient();
  if (ledgerId) {
    if (!isUuid(ledgerId)) {
      throw new Error("No encontramos ese movimiento de caja");
    }
    const { data, error } = await supabase.from("caja_ledger").select("id, fecha, monto, tipo, referencia").eq("id", ledgerId).maybeSingle();
    if (error) {
      throw error;
    }
    if (!data) {
      throw new Error("No encontramos ese movimiento de caja");
    }
    if (data.tipo !== "Salida") {
      throw new Error("El movimiento tiene que ser una salida de caja");
    }
    const monto = toMoney(data.monto);
    await insertarPago(facturaId, { ledger_id: ledgerId }, monto, actor, body);
    return { origen: "caja", fecha: fechaDe(data.fecha), monto, referencia: text(data.referencia) };
  }
  if (!movimientoId || !isUuid(movimientoId)) {
    throw new Error("No encontramos ese movimiento del banco");
  }
  const { data, error } = await supabase.from("banco_movimientos").select("id, fecha, monto, tipo, referencia").eq("id", movimientoId).maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error("No encontramos ese movimiento del banco");
  }
  if (data.tipo !== "debito") {
    throw new Error("El movimiento del banco tiene que ser un débito");
  }
  const monto = toMoney(data.monto);
  await insertarPago(facturaId, { movimiento_id: movimientoId }, monto, actor, body);
  return { origen: "banco", fecha: fechaDe(data.fecha), monto, referencia: text(data.referencia) };
}

export async function quitarPago(facturaId: string, pagoId: string, actor: Actor): Promise<void> {
  puedeLigar(actor);
  if (!isUuid(pagoId)) {
    throw new Error("No encontramos ese pago");
  }
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("factura_pagos").delete().eq("id", pagoId).eq("factura_id", facturaId).select("id").maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    throw new Error("No encontramos ese pago");
  }
}
