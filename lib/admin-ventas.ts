import { parsePrice } from "@/lib/catalog-import";
import { isDayKey } from "@/lib/local-day";
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

function mapVenta(row: VentaRow | null): VentaDiaria | null {
  if (!row) {
    return null;
  }
  const fecha = String(row.fecha ?? "");
  if (!isDayKey(fecha)) {
    return null;
  }
  return {
    id: String(row.id ?? fecha),
    fecha,
    diaSemana: String(row.dia_semana ?? "") || diaSemanaFromFecha(fecha),
    monto: toMoney(row.venta_real),
  };
}

export function parseVentaInput(body: { fecha?: unknown; monto?: unknown }): { fecha: string; monto: number } {
  const fecha = typeof body.fecha === "string" ? body.fecha.trim() : "";
  if (!isDayKey(fecha)) {
    throw new Error("La fecha no es válida");
  }

  const montoRaw =
    typeof body.monto === "number"
      ? body.monto
      : typeof body.monto === "string"
        ? parsePrice(body.monto)
        : null;
  const monto = montoRaw == null ? null : toMoney(montoRaw);
  if (monto == null || !(monto > 0)) {
    throw new Error("El monto tiene que ser mayor que 0");
  }
  return { fecha, monto };
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
  return insertedMapped;
}
