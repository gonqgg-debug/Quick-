import { leerEstadoCuenta, llavesMovimientos, type BancoColumnas, type BancoMovimiento, type BancoTipo } from "@/lib/banco-shared";
import { referenciaFactura, type FacturaMoneda } from "@/lib/facturas-shared";
import { isDayKey } from "@/lib/local-day";
import { toMoney } from "@/lib/money";
import type { Actor } from "@/lib/operacion-shared";
import { parseSpreadsheet } from "@/lib/read-spreadsheet";
import { getSupabaseAdminClient } from "@/lib/supabase";

export const BANCO_ARCHIVO_MAX = 4 * 1024 * 1024;
const LOTE = 500;

export type ImportacionBanco = {
  banco: string;
  cuenta: string | null;
  nuevos: number;
  repetidos: number;
  descartadas: number;
  desde: string | null;
  hasta: string | null;
  encabezados: string[];
  columnas: BancoColumnas;
};

function texto(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

/** Fred o el admin suben el estado de cuenta en CSV o Excel. Reimportar el mismo archivo no duplica filas. */
export async function importarEstadoCuenta(
  archivo: { buffer: Buffer; nombre: string },
  opciones: { banco: unknown; cuenta?: unknown; moneda?: unknown },
  actor: Actor
): Promise<ImportacionBanco> {
  if (actor !== "fred" && actor !== "admin") {
    throw new Error("Solo Fred importa el estado de cuenta");
  }
  const banco = texto(opciones.banco, 80);
  if (!banco) {
    throw new Error("Manda banco con el nombre del banco (por ejemplo Popular o BHD)");
  }
  const cuenta = texto(opciones.cuenta, 40);
  const moneda: FacturaMoneda = opciones.moneda === "USD" ? "USD" : "DOP";
  if (archivo.buffer.length > BANCO_ARCHIVO_MAX) {
    throw new Error("El archivo pasa de 4 MB");
  }
  const leido = leerEstadoCuenta(parseSpreadsheet(archivo.buffer, archivo.nombre));
  if (!leido.movimientos.length) {
    throw new Error("El archivo no tiene movimientos con fecha y monto debajo del encabezado");
  }
  const llaves = llavesMovimientos(banco, cuenta, leido.movimientos);
  const quien = actor === "admin" ? "Admin" : "Fred";
  const supabase = getSupabaseAdminClient();
  let nuevos = 0;
  for (let inicio = 0; inicio < leido.movimientos.length; inicio += LOTE) {
    const filas = leido.movimientos.slice(inicio, inicio + LOTE).map((movimiento, indice) => ({
      banco,
      cuenta,
      moneda,
      fecha: movimiento.fecha,
      descripcion: movimiento.descripcion,
      referencia: movimiento.referencia,
      tipo: movimiento.tipo,
      monto: movimiento.monto,
      huella: llaves[inicio + indice],
      archivo: archivo.nombre.slice(0, 200),
      importado_por: quien,
    }));
    const { data, error } = await supabase.from("banco_movimientos").upsert(filas, { onConflict: "huella", ignoreDuplicates: true }).select("id");
    if (error) {
      throw error;
    }
    nuevos += data?.length ?? 0;
  }
  const fechas = leido.movimientos.map((movimiento) => movimiento.fecha).sort();
  return {
    banco,
    cuenta,
    nuevos,
    repetidos: leido.movimientos.length - nuevos,
    descartadas: leido.descartadas,
    desde: fechas[0] ?? null,
    hasta: fechas[fechas.length - 1] ?? null,
    encabezados: leido.encabezados,
    columnas: leido.columnas,
  };
}

type FacturaEmbed = { id?: unknown; proveedor?: unknown; fecha_emision?: unknown; total?: unknown; moneda?: unknown; tienda?: unknown };

export async function listarMovimientos(filtro: { desde?: string | null; hasta?: string | null; tipo?: BancoTipo | null; sinLigar?: boolean }): Promise<BancoMovimiento[]> {
  for (const fecha of [filtro.desde, filtro.hasta]) {
    if (fecha && !isDayKey(fecha)) {
      throw new Error("La fecha tiene que ser YYYY-MM-DD");
    }
  }
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("banco_movimientos")
    .select("id, banco, cuenta, fecha, descripcion, referencia, tipo, monto, moneda, importado_por, importado_en, factura_pagos ( facturas ( id, proveedor, fecha_emision, total, moneda, tienda ) )")
    .order("fecha", { ascending: false })
    .limit(500);
  if (filtro.desde) {
    query = query.gte("fecha", filtro.desde);
  }
  if (filtro.hasta) {
    query = query.lte("fecha", filtro.hasta);
  }
  if (filtro.tipo) {
    query = query.eq("tipo", filtro.tipo);
  }
  const { data, error } = await query;
  if (error) {
    throw error;
  }
  const movimientos: BancoMovimiento[] = [];
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const pagos = (Array.isArray(row.factura_pagos) ? row.factura_pagos : row.factura_pagos ? [row.factura_pagos] : []) as Array<{ facturas?: FacturaEmbed | FacturaEmbed[] | null }>;
    const embed = pagos.map((pago) => (Array.isArray(pago.facturas) ? pago.facturas[0] : pago.facturas)).find(Boolean) ?? null;
    if (filtro.sinLigar && embed) {
      continue;
    }
    movimientos.push({
      id: String(row.id),
      banco: String(row.banco),
      cuenta: texto(row.cuenta, 40),
      fecha: String(row.fecha).slice(0, 10),
      descripcion: texto(row.descripcion, 500),
      referencia: texto(row.referencia, 160),
      tipo: row.tipo === "credito" ? "credito" : "debito",
      monto: toMoney(row.monto),
      moneda: row.moneda === "USD" ? "USD" : "DOP",
      importadoPor: String(row.importado_por ?? ""),
      importadoEn: String(row.importado_en ?? ""),
      factura: embed?.id
        ? {
            id: String(embed.id),
            referencia: referenciaFactura({
              proveedor: texto(embed.proveedor, 200),
              fechaEmision: texto(embed.fecha_emision, 10),
              total: embed.total == null ? null : toMoney(embed.total),
              moneda: embed.moneda === "USD" ? "USD" : "DOP",
              tienda: texto(embed.tienda, 120),
            }),
          }
        : null,
    });
  }
  return movimientos;
}
