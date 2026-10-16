import { getSupabaseAdminClient } from "@/lib/supabase";
import { TIENDA_DEFAULT, parseLimit, type PosNormalizado } from "@/lib/pos-domain";

export type IngestaRespuesta = {
  tienda: string;
  ignoradas: Array<{ odooId: number; estado: string }>;
  sesion: { odooId: number; fechaOperativa: string } | null;
  insertados: { sesiones: number; ordenes: number; lineas: number; pagos: number };
  actualizados: { sesiones: number; ordenes: number; lineas: number; pagos: number };
  borrados: { ordenes: number; lineas: number; pagos: number };
  sinMatch: number;
  totalSesion: number | null;
  sumaOrdenes: number;
  sumaPagos: number;
  alerta: boolean;
  ventaDia: {
    fecha: string;
    ventaReal: number;
    ventaPos: number;
    origen: string | null;
    overrideManual: boolean;
  } | null;
};

export async function ingestarPosSesion(payload: PosNormalizado): Promise<IngestaRespuesta> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc("ingestar_pos_sesion", { p_payload: payload });
  if (error) {
    throw error;
  }
  if (!data || typeof data !== "object") {
    throw new Error("La ingesta no respondió");
  }
  return data as IngestaRespuesta;
}

export async function listarSesionesCargadas(input: { desde: string | null; cursor: number | null; limit: number }) {
  const supabase = getSupabaseAdminClient();
  const tienda = TIENDA_DEFAULT;
  const limite = parseLimit(String(input.limit));
  const ultimo = await supabase
    .from("pos_sesiones")
    .select("odoo_id")
    .eq("tienda", tienda)
    .order("odoo_id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (ultimo.error) {
    throw ultimo.error;
  }

  let query = supabase
    .from("pos_sesiones")
    .select("odoo_id, nombre, fecha_operativa, total_pagos")
    .eq("tienda", tienda)
    .order("odoo_id", { ascending: true })
    .limit(limite + 1);
  if (input.desde) {
    query = query.gte("fecha_operativa", input.desde);
  }
  if (input.cursor) {
    query = query.gt("odoo_id", input.cursor);
  }
  const { data, error } = await query;
  if (error) {
    throw error;
  }
  const rows = data ?? [];
  const page = rows.slice(0, limite);
  const last = page[page.length - 1];
  return {
    tienda,
    ultimoOdooId: ultimo.data?.odoo_id == null ? null : Number(ultimo.data.odoo_id),
    sesiones: page.map((row) => ({
      odooId: Number(row.odoo_id),
      nombre: String(row.nombre ?? ""),
      fechaOperativa: String(row.fecha_operativa),
      totalPagos: row.total_pagos == null ? null : Number(row.total_pagos),
    })),
    nextCursor: rows.length > limite && last ? String(last.odoo_id) : null,
  };
}

export async function listarPartesAbiertas() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("pos_sesiones")
    .select("odoo_id, nombre, fecha_operativa, lote_abierto, ingested_at")
    .eq("tienda", TIENDA_DEFAULT)
    .eq("ingesta", "parcial")
    .order("fecha_operativa", { ascending: true })
    .limit(100);
  if (error) {
    throw error;
  }
  return {
    tienda: TIENDA_DEFAULT,
    partes: (data ?? []).map((row) => ({
      odooId: Number(row.odoo_id),
      nombre: String(row.nombre ?? ""),
      fechaOperativa: String(row.fecha_operativa),
      loteId: row.lote_abierto ? String(row.lote_abierto) : null,
      ingestedAt: row.ingested_at ? String(row.ingested_at) : null,
    })),
  };
}
