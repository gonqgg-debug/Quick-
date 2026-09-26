import { isDayKey, todayDayKey, diffDayKeys } from "@/lib/local-day";
import { toMoney } from "@/lib/money";
import { getSupabaseAdminClient } from "@/lib/supabase";

const MAX_RANGE_DAYS = 93;
const PAGE_SIZE = 100;

export type AgentRange = { from: string; to: string };

export function parseAgentRange(search: URLSearchParams, today = todayDayKey()): { ok: true; range: AgentRange } | { ok: false; error: string } {
  const fecha = search.get("fecha")?.trim() ?? "";
  if (fecha) {
    if (!isDayKey(fecha)) {
      return { ok: false, error: "La fecha no es válida" };
    }
    return { ok: true, range: { from: fecha, to: fecha } };
  }
  const from = search.get("from")?.trim() || today;
  const to = search.get("to")?.trim() || from;
  if (!isDayKey(from) || !isDayKey(to) || from > to) {
    return { ok: false, error: "El rango no es válido" };
  }
  if (diffDayKeys(from, to) > MAX_RANGE_DAYS) {
    return { ok: false, error: "El rango máximo es 93 días. Para un mes completo usa /api/agent/contable." };
  }
  return { ok: true, range: { from, to } };
}

export async function listAgentVentas(range: AgentRange) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("ventas_diarias")
    .select("id, fecha, venta_real")
    .gte("fecha", range.from)
    .lte("fecha", range.to)
    .order("fecha", { ascending: true })
    .limit(MAX_RANGE_DAYS + 5);
  if (error) {
    throw error;
  }
  const ventas = (data ?? []).map((row) => ({
    id: String(row.id),
    fecha: String(row.fecha).slice(0, 10),
    ventaReal: toMoney(row.venta_real),
  }));
  return {
    desde: range.from,
    hasta: range.to,
    total: ventas.reduce((sum, venta) => sum + venta.ventaReal, 0),
    ventas,
  };
}

export async function listAgentCompras(range: AgentRange) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("compras")
    .select("id, proveedor_id, monto, fecha, due_date, pagado, pagado_en, proveedores ( nombre )")
    .gte("fecha", range.from)
    .lte("fecha", range.to)
    .order("fecha", { ascending: true })
    .limit(1000);
  if (error) {
    throw error;
  }
  const compras = (data ?? []).map((row) => {
    const embed = Array.isArray(row.proveedores) ? row.proveedores[0] : row.proveedores;
    return {
      id: String(row.id),
      proveedorId: String(row.proveedor_id),
      proveedorNombre: String(embed?.nombre ?? "").trim() || "Sin proveedor",
      monto: toMoney(row.monto),
      fecha: String(row.fecha).slice(0, 10),
      dueDate: String(row.due_date).slice(0, 10),
      pagado: Boolean(row.pagado),
      pagadoEn: row.pagado_en ? String(row.pagado_en).slice(0, 10) : null,
    };
  });
  return {
    desde: range.from,
    hasta: range.to,
    total: compras.reduce((sum, compra) => sum + compra.monto, 0),
    compras,
  };
}

export async function listAgentCaja(range: AgentRange) {
  const supabase = getSupabaseAdminClient();
  const [turnosResult, ledgerResult] = await Promise.all([
    supabase
      .from("caja_turnos")
      .select("id, fecha, turno, sistema_tarjeta, sistema_efectivo, reportado_tarjeta, reportado_efectivo, reportado_usd, verificado, notas")
      .gte("fecha", range.from)
      .lte("fecha", range.to)
      .order("fecha", { ascending: true })
      .limit(500),
    supabase
      .from("caja_ledger")
      .select("id, fecha, caja, moneda, tipo, monto, concepto, referencia")
      .gte("fecha", range.from)
      .lte("fecha", range.to)
      .order("fecha", { ascending: true })
      .limit(1000),
  ]);
  if (turnosResult.error) {
    throw turnosResult.error;
  }
  if (ledgerResult.error) {
    throw ledgerResult.error;
  }
  return {
    desde: range.from,
    hasta: range.to,
    turnos: (turnosResult.data ?? []).map((row) => ({
      id: String(row.id),
      fecha: String(row.fecha).slice(0, 10),
      turno: String(row.turno),
      sistemaTarjeta: toMoney(row.sistema_tarjeta),
      sistemaEfectivo: toMoney(row.sistema_efectivo),
      reportadoTarjeta: toMoney(row.reportado_tarjeta),
      reportadoEfectivo: toMoney(row.reportado_efectivo),
      reportadoUsd: toMoney(row.reportado_usd),
      verificado: Boolean(row.verificado),
      notas: row.notas ? String(row.notas) : null,
    })),
    ledger: (ledgerResult.data ?? []).map((row) => ({
      id: String(row.id),
      fecha: String(row.fecha).slice(0, 10),
      caja: row.caja,
      moneda: row.moneda,
      tipo: row.tipo,
      monto: toMoney(row.monto),
      concepto: row.concepto ? String(row.concepto) : null,
      referencia: row.referencia ? String(row.referencia) : null,
    })),
  };
}

export async function listAgentCatalogo(search: URLSearchParams) {
  const q = (search.get("q") ?? "").trim().replace(/[%_,()]/g, " ").replace(/\s+/g, " ").slice(0, 80);
  const cursor = (search.get("cursor") ?? "").trim();
  const supabase = getSupabaseAdminClient();
  let query = supabase
    .from("products")
    .select("id, nombre, marca, categoria, precio, codigo_odoo, codigo_barras, activo")
    .order("id", { ascending: true })
    .limit(PAGE_SIZE + 1);
  if (cursor) {
    query = query.gt("id", cursor);
  }
  if (q) {
    query = query.or(`nombre.ilike.%${q}%,codigo_odoo.ilike.%${q}%,codigo_barras.ilike.%${q}%`);
  }
  const { data, error } = await query;
  if (error) {
    throw error;
  }
  const rows = data ?? [];
  const page = rows.slice(0, PAGE_SIZE);
  const next = rows.length > PAGE_SIZE ? String(page[page.length - 1]?.id ?? "") : null;
  return {
    nota: "El catálogo no guarda existencias. activo indica si el producto se ofrece; precio es el de venta.",
    productos: page.map((row) => ({
      id: String(row.id),
      nombre: String(row.nombre),
      marca: row.marca ? String(row.marca) : null,
      categoria: String(row.categoria ?? ""),
      precio: toMoney(row.precio),
      codigoOdoo: row.codigo_odoo ? String(row.codigo_odoo) : null,
      codigoBarras: row.codigo_barras ? String(row.codigo_barras) : null,
      activo: Boolean(row.activo),
      stock: null,
    })),
    nextCursor: next || null,
  };
}
