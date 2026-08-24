import { parsePrice } from "@/lib/catalog-import";
import { toMoney } from "@/lib/money";
import {
  monthStartFromInput,
  parsePercentOrRatio,
  pesosSumanUno,
  pesosSumaPercent,
  type MetaMensual,
  type ParametrosConfig,
} from "@/lib/admin-parametros-shared";
import { getSupabaseAdminClient } from "@/lib/supabase";

export type { MetaMensual, ParametrosConfig } from "@/lib/admin-parametros-shared";

const PARAMETROS_FIELDS =
  "id, mes_activo, ratio_recompra, umbral_cuidado, umbral_stop, peso_reciente, peso_intermedio, peso_antiguo";
const METAS_LIMIT = 240;

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "23505");
}

function mapParametros(row: Record<string, unknown> | null): ParametrosConfig {
  if (!row) {
    throw new Error("No hay parámetros configurados");
  }
  const mesActivo = monthStartFromInput(row.mes_activo) ?? "";
  if (!mesActivo) {
    throw new Error("El mes activo no es válido");
  }
  const ratioRecompra = toMoney(row.ratio_recompra);
  if (!(ratioRecompra > 0)) {
    throw new Error("El ratio de recompra no es válido");
  }
  return {
    mesActivo,
    ratioRecompra,
    umbralCuidado: parsePercentOrRatio(row.umbral_cuidado) ?? 0,
    umbralStop: parsePercentOrRatio(row.umbral_stop) ?? 0,
    pesoReciente: parsePercentOrRatio(row.peso_reciente) ?? 0,
    pesoIntermedio: parsePercentOrRatio(row.peso_intermedio) ?? 0,
    pesoAntiguo: parsePercentOrRatio(row.peso_antiguo) ?? 0,
  };
}

function mapMeta(row: { mes?: unknown; meta?: unknown }): MetaMensual | null {
  const mes = monthStartFromInput(row.mes);
  if (!mes) {
    return null;
  }
  return { mes, meta: toMoney(row.meta) };
}

async function parametrosRowId(): Promise<string | number> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("parametros").select("id").limit(1).maybeSingle();
  if (error) {
    throw error;
  }
  if (!data || data.id == null) {
    throw new Error("No hay parámetros configurados");
  }
  return data.id as string | number;
}

export async function getParametrosConfig(): Promise<ParametrosConfig> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("parametros").select(PARAMETROS_FIELDS).limit(1).maybeSingle();
  if (error) {
    throw error;
  }
  return mapParametros(data as Record<string, unknown> | null);
}

export function parseParametrosPatch(body: {
  mesActivo?: unknown;
  ratioRecompra?: unknown;
  umbralCuidado?: unknown;
  umbralStop?: unknown;
  pesoReciente?: unknown;
  pesoIntermedio?: unknown;
  pesoAntiguo?: unknown;
}): { ok: true; data: ParametrosConfig } | { ok: false; message: string } {
  const mesActivo = monthStartFromInput(body.mesActivo);
  if (!mesActivo) {
    return { ok: false, message: "El mes activo no es válido" };
  }

  const ratioRaw =
    typeof body.ratioRecompra === "number"
      ? body.ratioRecompra
      : typeof body.ratioRecompra === "string"
        ? Number(body.ratioRecompra.trim().replace(",", "."))
        : NaN;
  if (!Number.isFinite(ratioRaw) || !(ratioRaw > 0) || ratioRaw > 50) {
    return { ok: false, message: "El ratio de recompra tiene que ser mayor que 0" };
  }

  const umbralCuidado = parsePercentOrRatio(body.umbralCuidado);
  const umbralStop = parsePercentOrRatio(body.umbralStop);
  if (umbralCuidado == null || umbralStop == null) {
    return { ok: false, message: "Los umbrales de cuidado y stop no son válidos" };
  }
  if (umbralCuidado > umbralStop) {
    return { ok: false, message: "El umbral de cuidado tiene que ser menor o igual que el de stop" };
  }

  const pesoReciente = parsePercentOrRatio(body.pesoReciente);
  const pesoIntermedio = parsePercentOrRatio(body.pesoIntermedio);
  const pesoAntiguo = parsePercentOrRatio(body.pesoAntiguo);
  if (pesoReciente == null || pesoIntermedio == null || pesoAntiguo == null) {
    return { ok: false, message: "Los pesos del promedio no son válidos" };
  }
  if (!pesosSumanUno(pesoReciente, pesoIntermedio, pesoAntiguo)) {
    return {
      ok: false,
      message: `Los pesos tienen que sumar 100%. Ahora suman ${pesosSumaPercent(pesoReciente, pesoIntermedio, pesoAntiguo)}%.`,
    };
  }

  return {
    ok: true,
    data: {
      mesActivo,
      ratioRecompra: toMoney(ratioRaw),
      umbralCuidado,
      umbralStop,
      pesoReciente,
      pesoIntermedio,
      pesoAntiguo,
    },
  };
}

export async function updateParametrosConfig(input: ParametrosConfig): Promise<ParametrosConfig> {
  const id = await parametrosRowId();
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("parametros")
    .update({
      mes_activo: input.mesActivo,
      ratio_recompra: input.ratioRecompra,
      umbral_cuidado: input.umbralCuidado,
      umbral_stop: input.umbralStop,
      peso_reciente: input.pesoReciente,
      peso_intermedio: input.pesoIntermedio,
      peso_antiguo: input.pesoAntiguo,
    })
    .eq("id", id)
    .select(PARAMETROS_FIELDS)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return mapParametros(data as Record<string, unknown> | null);
}

export async function listMetasMensuales(): Promise<MetaMensual[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("metas_mensuales").select("mes, meta").order("mes", { ascending: false }).limit(METAS_LIMIT);
  if (error) {
    throw error;
  }
  return (data ?? []).map((row) => mapMeta(row)).filter((row): row is MetaMensual => Boolean(row));
}

export function parseMetaInput(body: { mes?: unknown; meta?: unknown }, { requireMes }: { requireMes: boolean }): { ok: true; mes: string | null; meta: number } | { ok: false; message: string } {
  let mes: string | null = null;
  if (requireMes || body.mes != null) {
    mes = monthStartFromInput(body.mes);
    if (!mes) {
      return { ok: false, message: "El mes no es válido" };
    }
  }

  const metaRaw =
    typeof body.meta === "number"
      ? body.meta
      : typeof body.meta === "string"
        ? parsePrice(body.meta)
        : null;
  const meta = metaRaw == null ? null : toMoney(metaRaw);
  if (meta == null || !(meta > 0)) {
    return { ok: false, message: "La meta tiene que ser mayor que 0" };
  }
  return { ok: true, mes, meta };
}

export async function createMetaMensual(mes: string, meta: number): Promise<MetaMensual> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("metas_mensuales").insert({ mes, meta }).select("mes, meta").single();
  if (error) {
    if (isUniqueViolation(error)) {
      throw new Error("Ya existe una meta para ese mes");
    }
    throw error;
  }
  const mapped = mapMeta(data);
  if (!mapped) {
    throw new Error("No pudimos guardar la meta");
  }
  return mapped;
}

export async function updateMetaMensual(mes: string, meta: number): Promise<MetaMensual> {
  const mesKey = monthStartFromInput(mes);
  if (!mesKey) {
    throw new Error("El mes no es válido");
  }
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("metas_mensuales").update({ meta }).eq("mes", mesKey).select("mes, meta").maybeSingle();
  if (error) {
    throw error;
  }
  const mapped = data ? mapMeta(data) : null;
  if (!mapped) {
    throw new Error("No encontramos la meta de ese mes");
  }
  return mapped;
}
