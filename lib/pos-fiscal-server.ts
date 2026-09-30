import { negocioEmiteNcf, type NegocioFiscal, type NegocioRecibo, type NcfTipo } from "@/lib/pos-fiscal";
import { getSupabaseAdminClient } from "@/lib/supabase";

const NEGOCIO_ID = "quick";

type NegocioRow = {
  nombre_comercial: string;
  razon_social: string;
  rnc: string | null;
  direccion: string;
  telefono: string | null;
  ncf_tipo: string | null;
  ncf_siguiente: number | string | null;
  ncf_hasta: number | string | null;
  ncf_vence: string | null;
};

function missingDbObject(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String((error as { message?: string } | null)?.message ?? "");
  return /does not exist|schema cache|42883|42703|PGRST202|PGRST204|PGRST205/i.test(message);
}

function asInt(value: number | string | null | undefined): number | null {
  if (value == null || value === "") {
    return null;
  }
  const number = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(number) ? number : null;
}

function asTipo(value: string | null): NcfTipo | null {
  return value === "B02" || value === "E32" ? value : null;
}

function mapRow(row: NegocioRow): NegocioFiscal {
  const ncfVence = typeof row.ncf_vence === "string" ? row.ncf_vence.slice(0, 10) : null;
  const value: NegocioFiscal = {
    nombreComercial: row.nombre_comercial,
    razonSocial: row.razon_social,
    rnc: row.rnc,
    direccion: row.direccion,
    telefono: row.telefono,
    ncfTipo: asTipo(row.ncf_tipo),
    ncfSiguiente: asInt(row.ncf_siguiente),
    ncfHasta: asInt(row.ncf_hasta),
    ncfVence,
    emiteNcf: false,
  };
  value.emiteNcf = negocioEmiteNcf(value);
  return value;
}

export function reciboDe(negocio: NegocioFiscal): NegocioRecibo {
  return {
    nombreComercial: negocio.nombreComercial,
    razonSocial: negocio.razonSocial,
    rnc: negocio.rnc,
    direccion: negocio.direccion,
    telefono: negocio.telefono,
    ncfVence: negocio.ncfVence,
    emiteNcf: negocio.emiteNcf,
  };
}

export async function leerNegocioFiscal(): Promise<{ negocio: NegocioFiscal; persistido: boolean; emitidos: number }> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("pos_negocio")
    .select("nombre_comercial, razon_social, rnc, direccion, telefono, ncf_tipo, ncf_siguiente, ncf_hasta, ncf_vence")
    .eq("id", NEGOCIO_ID)
    .maybeSingle();
  if (error) {
    if (missingDbObject(error)) {
      return { negocio: fiscalVacio(), persistido: false, emitidos: 0 };
    }
    throw error;
  }
  if (!data) {
    return { negocio: fiscalVacio(), persistido: false, emitidos: 0 };
  }
  const emitidos = await contarNcfEmitidos();
  return { negocio: mapRow(data as NegocioRow), persistido: true, emitidos };
}

function fiscalVacio(): NegocioFiscal {
  return {
    nombreComercial: "QUICK!",
    razonSocial: "Quick! Mini Market",
    rnc: null,
    direccion: "Residencial Jardines 3, Pueblo Bávaro, La Altagracia",
    telefono: "809-226-4986",
    ncfTipo: null,
    ncfSiguiente: null,
    ncfHasta: null,
    ncfVence: null,
    emiteNcf: false,
  };
}

async function contarNcfEmitidos(): Promise<number> {
  const supabase = getSupabaseAdminClient();
  const { count, error } = await supabase.from("ventas_pos").select("id", { count: "exact", head: true }).not("ncf", "is", null);
  if (error) {
    if (missingDbObject(error)) {
      return 0;
    }
    throw error;
  }
  return count ?? 0;
}

export async function guardarNegocioFiscal(value: NegocioFiscal): Promise<NegocioFiscal> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("pos_negocio")
    .update({
      nombre_comercial: value.nombreComercial,
      razon_social: value.razonSocial,
      rnc: value.rnc,
      direccion: value.direccion,
      telefono: value.telefono,
      ncf_tipo: value.ncfTipo,
      ncf_siguiente: value.ncfSiguiente,
      ncf_hasta: value.ncfHasta,
      ncf_vence: value.ncfVence,
    })
    .eq("id", NEGOCIO_ID)
    .select("nombre_comercial, razon_social, rnc, direccion, telefono, ncf_tipo, ncf_siguiente, ncf_hasta, ncf_vence")
    .maybeSingle();
  if (error) {
    if (missingDbObject(error)) {
      throw new Error("Falta crear la tabla de datos fiscales. Corre la migración en Supabase.");
    }
    throw error;
  }
  if (!data) {
    throw new Error("No está la ficha del negocio. Corre la migración en Supabase.");
  }
  return mapRow(data as NegocioRow);
}

/** Asigna el siguiente NCF de la secuencia, o devuelve el que esa venta ya tiene. Null si no hay rango. */
export async function asignarNcfVenta(clientId: string): Promise<string | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc("asignar_ncf_venta", { p_client_id: clientId });
  if (error) {
    if (missingDbObject(error)) {
      return null;
    }
    throw error;
  }
  return typeof data === "string" && data.trim() ? data.trim() : null;
}
