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

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function fechaDe(value: unknown): string | null {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null;
}

export async function pagosDe(facturaId: string): Promise<FacturaPago[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("factura_pagos")
    .select("id, ledger_id, monto, confirmado_por, confirmado_en, caja_ledger ( fecha, caja, concepto, referencia )")
    .eq("factura_id", facturaId)
    .order("confirmado_en", { ascending: true });
  if (error) {
    throw error;
  }
  return (data ?? []).map((row) => {
    const ledger = (Array.isArray(row.caja_ledger) ? row.caja_ledger[0] : row.caja_ledger) as LedgerRow | null;
    return {
      id: String(row.id),
      ledgerId: String(row.ledger_id),
      fecha: fechaDe(ledger?.fecha),
      caja: text(ledger?.caja),
      concepto: text(ledger?.concepto),
      referencia: text(ledger?.referencia),
      monto: toMoney(row.monto),
      confirmadoPor: text(row.confirmado_por) ?? "—",
      confirmadoEn: String(row.confirmado_en),
    };
  });
}

/** Salidas de caja en DOP a ±1 día y ±RD$ 5 del total que todavía no pagan otra factura. */
export async function candidatosPago(factura: FacturaResumen, yaLigados: string[]): Promise<FacturaPagoCandidato[]> {
  if (factura.moneda !== "DOP" || factura.total == null || factura.total <= 0 || factura.estado === "conciliada") {
    return [];
  }
  const fecha = factura.fechaEmision ?? localDayKey(factura.recibidoEn);
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
  const ids = (data ?? []).map((row) => String(row.id)).filter((id) => !yaLigados.includes(id));
  if (!ids.length) {
    return [];
  }
  const { data: usados, error: usadosError } = await supabase.from("factura_pagos").select("ledger_id").in("ledger_id", ids);
  if (usadosError) {
    throw usadosError;
  }
  const ocupados = new Set((usados ?? []).map((row) => String(row.ledger_id)));
  const candidatos: FacturaPagoCandidato[] = [];
  for (const row of data ?? []) {
    const ledgerId = String(row.id);
    const fechaPago = fechaDe(row.fecha);
    if (!fechaPago || ocupados.has(ledgerId) || yaLigados.includes(ledgerId)) {
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
    if (confianza == null) {
      continue;
    }
    candidatos.push({ ledgerId, fecha: fechaPago, caja: text(row.caja), concepto: text(row.concepto), referencia: text(row.referencia), monto, confianza });
  }
  return candidatos.sort((a, b) => b.confianza - a.confianza);
}

function puedeLigar(actor: Actor): void {
  if (actor !== "fred" && actor !== "admin") {
    throw new Error("Solo Fred liga los pagos de caja");
  }
}

/** Liga una salida de caja a la factura. Un movimiento solo puede pagar una factura. */
export async function ligarPago(facturaId: string, ledgerIdRaw: unknown, actor: Actor): Promise<{ fecha: string | null; monto: number }> {
  puedeLigar(actor);
  const ledgerId = typeof ledgerIdRaw === "string" ? ledgerIdRaw.trim() : "";
  if (!isUuid(ledgerId)) {
    throw new Error("Manda ledgerId del movimiento de caja");
  }
  const supabase = getSupabaseAdminClient();
  const { data: ledger, error: ledgerError } = await supabase
    .from("caja_ledger")
    .select("id, fecha, monto, tipo, moneda")
    .eq("id", ledgerId)
    .maybeSingle();
  if (ledgerError) {
    throw ledgerError;
  }
  if (!ledger) {
    throw new Error("No encontramos ese movimiento de caja");
  }
  if (ledger.tipo !== "Salida") {
    throw new Error("El movimiento tiene que ser una salida de caja");
  }
  const monto = toMoney(ledger.monto);
  const { data: existente, error: existenteError } = await supabase.from("factura_pagos").select("factura_id").eq("ledger_id", ledgerId).maybeSingle();
  if (existenteError) {
    throw existenteError;
  }
  if (existente && existente.factura_id !== facturaId) {
    throw new Error("Ese movimiento de caja ya paga otra factura");
  }
  if (!existente) {
    const { error } = await supabase
      .from("factura_pagos")
      .insert({ factura_id: facturaId, ledger_id: ledgerId, monto, confirmado_por: actor === "admin" ? "Admin" : "Fred" });
    if (error) {
      if (error.code === "23505") {
        throw new Error("Ese movimiento de caja ya paga otra factura");
      }
      throw error;
    }
  }
  return { fecha: fechaDe(ledger.fecha), monto };
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
