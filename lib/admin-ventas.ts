import { publishAgentEvent } from "@/lib/agent-events";
import { parsePrice } from "@/lib/catalog-import";
import { calendarDayKey, isDayKey, yesterdayDayKey } from "@/lib/local-day";
import { toMoney } from "@/lib/money";
import { getSupabaseAdminClient } from "@/lib/supabase";
import {
  VENTAS_DEFAULT_LIMIT,
  VENTAS_MAX_LIMIT,
  diaSemanaFromFecha,
  type VentaDiaria,
} from "@/lib/admin-ventas-shared";

export type { VentaDiaria } from "@/lib/admin-ventas-shared";
export { VENTAS_DEFAULT_LIMIT, parseVentasLimit } from "@/lib/admin-ventas-shared";

const VENTA_SELECT = "id, fecha, dia_semana, venta_real";

type VentaRow = {
  id?: unknown;
  fecha?: unknown;
  dia_semana?: unknown;
  venta_real?: unknown;
};

function isMissingConflictTarget(error: unknown): boolean {
  const message = error && typeof error === "object" && "message" in error ? String(error.message) : "";
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  return code === "42P10" || /no unique or exclusion constraint/i.test(message);
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "23505");
}

function hasOwn(input: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(input, key);
}

function parseMontoInput(value: unknown): number {
  const montoRaw =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? parsePrice(value)
        : null;
  const monto = montoRaw == null ? null : toMoney(montoRaw);
  if (monto == null || !(monto > 0)) {
    throw new Error("El monto tiene que ser mayor que 0");
  }
  return monto;
}

function mapVenta(row: VentaRow | null): VentaDiaria | null {
  if (!row) {
    return null;
  }
  const fecha = calendarDayKey(row.fecha);
  if (!fecha) {
    return null;
  }
  return {
    id: String(row.id ?? fecha),
    fecha,
    diaSemana: diaSemanaFromFecha(fecha),
    monto: toMoney(row.venta_real),
  };
}

export function parseVentaInput(body: { fecha?: unknown; monto?: unknown }): { fecha: string; monto: number } {
  const fecha = typeof body.fecha === "string" ? body.fecha.trim() : "";
  if (!isDayKey(fecha) || fecha > yesterdayDayKey()) {
    throw new Error("La fecha no es válida");
  }
  return { fecha, monto: parseMontoInput(body.monto) };
}

export async function listVentasDiarias(limit = VENTAS_DEFAULT_LIMIT): Promise<VentaDiaria[]> {
  const take = Math.min(VENTAS_MAX_LIMIT, Math.max(1, Math.trunc(limit)));
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("ventas_diarias")
    .select(VENTA_SELECT)
    .order("fecha", { ascending: false })
    .limit(take);
  if (error) {
    throw error;
  }
  return (data ?? []).map((row) => mapVenta(row)).filter((row): row is VentaDiaria => Boolean(row));
}

export async function upsertVentaDiaria(fecha: string, monto: number): Promise<VentaDiaria> {
  const diaSemana = diaSemanaFromFecha(fecha);
  if (!diaSemana) {
    throw new Error("La fecha no es válida");
  }

  const supabase = getSupabaseAdminClient();
  const payload = { fecha, dia_semana: diaSemana, venta_real: monto };

  const { data: upserted, error: upsertError } = await supabase
    .from("ventas_diarias")
    .upsert(payload, { onConflict: "fecha" })
    .select(VENTA_SELECT)
    .maybeSingle();
  if (!upsertError) {
    const mapped = mapVenta(upserted);
    if (mapped) {
      await publishAgentEvent("venta.guardada", { ...mapped });
      return mapped;
    }
  } else if (!isMissingConflictTarget(upsertError)) {
    throw upsertError;
  }

  const { data: updated, error: updateError } = await supabase
    .from("ventas_diarias")
    .update({ dia_semana: diaSemana, venta_real: monto })
    .eq("fecha", fecha)
    .select(VENTA_SELECT)
    .maybeSingle();
  if (updateError) {
    throw updateError;
  }
  const updatedMapped = mapVenta(updated);
  if (updatedMapped) {
    await publishAgentEvent("venta.guardada", { ...updatedMapped });
    return updatedMapped;
  }

  const { data: inserted, error: insertError } = await supabase
    .from("ventas_diarias")
    .insert(payload)
    .select(VENTA_SELECT)
    .single();
  if (insertError) {
    throw insertError;
  }
  const insertedMapped = mapVenta(inserted);
  if (!insertedMapped) {
    throw new Error("No pudimos guardar la venta");
  }
  await publishAgentEvent("venta.guardada", { ...insertedMapped });
  return insertedMapped;
}

export type VentaPatch = {
  fecha?: unknown;
  monto?: unknown;
};

export async function updateVentaDiaria(id: string, patch: VentaPatch): Promise<VentaDiaria> {
  const ventaId = id.trim();
  if (!ventaId) {
    throw new Error("Falta la venta");
  }
  if (!hasOwn(patch, "fecha") && !hasOwn(patch, "monto")) {
    throw new Error("No hay cambios");
  }

  const supabase = getSupabaseAdminClient();
  const { data: current, error: loadError } = await supabase
    .from("ventas_diarias")
    .select(VENTA_SELECT)
    .eq("id", ventaId)
    .maybeSingle();
  if (loadError) {
    throw loadError;
  }
  const mapped = mapVenta(current);
  if (!mapped) {
    throw new Error("No encontramos esa venta");
  }

  const nextFecha = hasOwn(patch, "fecha")
    ? typeof patch.fecha === "string"
      ? patch.fecha.trim()
      : ""
    : mapped.fecha;
  if (!isDayKey(nextFecha) || nextFecha > yesterdayDayKey()) {
    throw new Error("La fecha no es válida");
  }

  const nextMonto = hasOwn(patch, "monto") ? parseMontoInput(patch.monto) : mapped.monto;
  const diaSemana = diaSemanaFromFecha(nextFecha);
  if (!diaSemana) {
    throw new Error("La fecha no es válida");
  }

  const { data, error } = await supabase
    .from("ventas_diarias")
    .update({ fecha: nextFecha, dia_semana: diaSemana, venta_real: nextMonto })
    .eq("id", ventaId)
    .select(VENTA_SELECT)
    .maybeSingle();
  if (error) {
    if (isUniqueViolation(error)) {
      throw new Error("Ya existe una venta para esa fecha");
    }
    throw error;
  }
  const updated = mapVenta(data);
  if (!updated) {
    throw new Error("No encontramos esa venta");
  }
  await publishAgentEvent("venta.guardada", { ...updated });
  return updated;
}
