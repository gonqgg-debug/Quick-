import { publishAgentEvent } from "@/lib/agent-events";
import { saldoCompra } from "@/lib/admin-compras-shared";
import { casosRecordatorio, RECEPCION_AVISO_HORAS, type RecordatorioCaso } from "@/lib/facturas-pendientes";
import { todayDayKey } from "@/lib/local-day";
import { toMoney } from "@/lib/money";
import { getSupabaseAdminClient } from "@/lib/supabase";

type FacturaRow = {
  id: string;
  clave: string | null;
  proveedor: string | null;
  estado: string;
  es_compra_personal: boolean | null;
  tipo_documento: string;
  recibido_en: string;
  compra_id: string | null;
};

const SELECT = "id, clave, proveedor, estado, es_compra_personal, tipo_documento, recibido_en, compra_id";
const LOTE = 100;

async function enLotes<T>(ids: string[], consulta: (lote: string[]) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const filas: T[] = [];
  for (let inicio = 0; inicio < ids.length; inicio += LOTE) {
    const { data, error } = await consulta(ids.slice(inicio, inicio + LOTE));
    if (error) {
      throw error;
    }
    filas.push(...(data ?? []));
  }
  return filas;
}

export type RecordatoriosResultado = { revisadas: number; abiertos: number; yaAbiertos: number; cerrados: number };

/**
 * Abre una excepción por cada caso nuevo y cierra las que ya no aplican.
 * El índice parcial (factura_id, caso) de excepciones abiertas evita duplicados aunque el cron corra dos veces.
 */
export async function correrRecordatorios(ahoraMs = Date.now()): Promise<RecordatoriosResultado> {
  const supabase = getSupabaseAdminClient();
  const hoy = todayDayKey(ahoraMs);
  const limiteRecepcion = new Date(ahoraMs - RECEPCION_AVISO_HORAS * 3_600_000).toISOString();

  const [recibidas, conCompra] = await Promise.all([
    supabase.from("facturas").select(SELECT).eq("estado", "recibida").eq("es_compra_personal", false).lte("recibido_en", limiteRecepcion).limit(1000),
    supabase.from("facturas").select(SELECT).neq("estado", "conciliada").neq("tipo_documento", "nota_credito").not("compra_id", "is", null).limit(1000),
  ]);
  if (recibidas.error) {
    throw recibidas.error;
  }
  if (conCompra.error) {
    throw conCompra.error;
  }
  const facturas = new Map<string, FacturaRow>();
  for (const row of [...(recibidas.data ?? []), ...(conCompra.data ?? [])] as FacturaRow[]) {
    facturas.set(row.id, row);
  }

  const idsRecibidas = (recibidas.data ?? []).map((row) => String(row.id));
  const lineasPendientes = await enLotes<{ factura_id: string }>(idsRecibidas, (lote) =>
    supabase.from("factura_lineas").select("factura_id").eq("recepcion", "pendiente").in("factura_id", lote)
  );
  const sinRecepcion = new Map<string, number>();
  for (const row of lineasPendientes) {
    sinRecepcion.set(row.factura_id, (sinRecepcion.get(row.factura_id) ?? 0) + 1);
  }

  const compraIds = Array.from(new Set((conCompra.data ?? []).map((row) => row.compra_id).filter((id): id is string => Boolean(id))));
  const compras = await enLotes<{ id: string; due_date: string; monto: unknown; notas_credito: unknown }>(compraIds, (lote) =>
    supabase.from("compras").select("id, due_date, monto, notas_credito").eq("pagado", false).in("id", lote)
  );
  const vencePorCompra = new Map<string, string>();
  for (const compra of compras) {
    if (saldoCompra(toMoney(compra.monto), toMoney(compra.notas_credito ?? 0)) > 0) {
      vencePorCompra.set(compra.id, String(compra.due_date).slice(0, 10));
    }
  }

  const vigentes = new Map<string, RecordatorioCaso & { facturaId: string; referencia: string }>();
  for (const factura of Array.from(facturas.values())) {
    const casos = casosRecordatorio(
      {
        estado: factura.estado as Parameters<typeof casosRecordatorio>[0]["estado"],
        esCompraPersonal: Boolean(factura.es_compra_personal),
        tipoDocumento: factura.tipo_documento as Parameters<typeof casosRecordatorio>[0]["tipoDocumento"],
        recibidoEn: factura.recibido_en,
        lineasSinRecepcion: sinRecepcion.get(factura.id) ?? 0,
        venceSinPagar: factura.compra_id ? vencePorCompra.get(factura.compra_id) ?? null : null,
      },
      { hoy, ms: ahoraMs }
    );
    for (const caso of casos) {
      vigentes.set(`${factura.id}|${caso.caso}`, { ...caso, facturaId: factura.id, referencia: factura.clave ?? factura.proveedor ?? factura.id });
    }
  }

  const { data: abiertas, error: abiertasError } = await supabase
    .from("excepciones")
    .select("id, factura_id, caso")
    .eq("estado", "abierta")
    .not("caso", "is", null)
    .limit(2000);
  if (abiertasError) {
    throw abiertasError;
  }
  const yaAbiertas = new Set((abiertas ?? []).map((row) => `${row.factura_id}|${row.caso}`));

  let abiertos = 0;
  let yaAbiertos = 0;
  for (const [clave, caso] of Array.from(vigentes.entries())) {
    if (yaAbiertas.has(clave)) {
      yaAbiertos += 1;
      continue;
    }
    const { data, error } = await supabase
      .from("excepciones")
      .insert({ factura_id: caso.facturaId, autor: "matt", dueno: caso.dueno, que_falta: caso.queFalta, caso: caso.caso })
      .select("id")
      .single();
    if (error) {
      if ((error as { code?: string }).code === "23505") {
        yaAbiertos += 1;
        continue;
      }
      throw error;
    }
    abiertos += 1;
    await publishAgentEvent("factura.recordatorio", {
      excepcionId: data.id,
      facturaId: caso.facturaId,
      referencia: caso.referencia,
      caso: caso.caso,
      dueno: caso.dueno,
      queFalta: caso.queFalta,
      fecha: hoy,
    });
  }

  const cerrar = (abiertas ?? []).filter((row) => row.factura_id && !vigentes.has(`${row.factura_id}|${row.caso}`)).map((row) => String(row.id));
  if (cerrar.length) {
    const { error } = await supabase
      .from("excepciones")
      .update({ estado: "resuelta", resolucion: "El recordatorio ya no aplica: se resolvió en la factura.", resuelta_en: new Date(ahoraMs).toISOString() })
      .in("id", cerrar);
    if (error) {
      throw error;
    }
  }

  return { revisadas: facturas.size, abiertos, yaAbiertos, cerrados: cerrar.length };
}
