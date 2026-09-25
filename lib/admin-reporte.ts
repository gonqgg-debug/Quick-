import { getParametrosConfig, listMetasMensuales } from "@/lib/admin-parametros";
import {
  buildReporteFinanciero,
  parseReporteMesParam,
  type ReporteCompra,
  type ReporteFinanciero,
  type ReporteLedger,
  type ReportePedido,
  type ReporteTurno,
  type ReporteVenta,
} from "@/lib/admin-reporte-shared";
import { getCajaParametros } from "@/lib/caja";
import { calendarDayKey, isDayKey, localDayKey, todayDayKey } from "@/lib/local-day";
import { toMoney } from "@/lib/money";
import { getSupabaseAdminClient } from "@/lib/supabase";

const PAGE_SIZE = 1000;

type PageResult<T> = { data: T[] | null; error: { message?: string } | null };

async function listAll<T>(fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) {
      throw error;
    }
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) {
      return rows;
    }
    from += PAGE_SIZE;
  }
}

function proveedorNombre(embed: unknown): string {
  const row = Array.isArray(embed) ? embed[0] : embed;
  if (!row || typeof row !== "object") {
    return "";
  }
  return String((row as { nombre?: unknown }).nombre ?? "").trim();
}

async function listVentas(): Promise<ReporteVenta[]> {
  const supabase = getSupabaseAdminClient();
  const rows = await listAll<Record<string, unknown>>(async (from, to) =>
    supabase
      .from("ventas_diarias")
      .select("fecha, venta_real")
      .order("fecha", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to)
  );
  return rows.flatMap((row) => {
    const fecha = calendarDayKey(row.fecha);
    if (!isDayKey(fecha)) {
      return [];
    }
    return [{ fecha, ventaReal: toMoney(row.venta_real) }];
  });
}

async function listCompras(): Promise<ReporteCompra[]> {
  const supabase = getSupabaseAdminClient();
  const rows = await listAll<Record<string, unknown>>(async (from, to) =>
    supabase
      .from("compras")
      .select("monto, fecha, pagado, pagado_en, proveedores ( nombre )")
      .order("fecha", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to)
  );
  return rows.flatMap((row) => {
    const fecha = calendarDayKey(row.fecha);
    if (!isDayKey(fecha)) {
      return [];
    }
    const pagadoEn = calendarDayKey(row.pagado_en);
    return [
      {
        monto: toMoney(row.monto),
        fecha,
        pagado: Boolean(row.pagado),
        pagadoEn: isDayKey(pagadoEn) ? pagadoEn : null,
        proveedor: proveedorNombre(row.proveedores),
      },
    ];
  });
}

async function listTurnos(): Promise<ReporteTurno[]> {
  const supabase = getSupabaseAdminClient();
  const rows = await listAll<Record<string, unknown>>(async (from, to) =>
    supabase
      .from("caja_turnos")
      .select(
        "fecha, sistema_tarjeta, sistema_efectivo, reportado_tarjeta, reportado_efectivo, reportado_usd, verificado"
      )
      .order("fecha", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to)
  );
  return rows.flatMap((row) => {
    const fecha = calendarDayKey(row.fecha);
    if (!isDayKey(fecha)) {
      return [];
    }
    return [
      {
        fecha,
        sistemaTarjeta: toMoney(row.sistema_tarjeta),
        sistemaEfectivo: toMoney(row.sistema_efectivo),
        reportadoTarjeta: toMoney(row.reportado_tarjeta),
        reportadoEfectivo: toMoney(row.reportado_efectivo),
        reportadoUsd: toMoney(row.reportado_usd),
        verificado: Boolean(row.verificado),
      },
    ];
  });
}

async function listLedger(): Promise<ReporteLedger[]> {
  const supabase = getSupabaseAdminClient();
  const rows = await listAll<Record<string, unknown>>(async (from, to) =>
    supabase
      .from("caja_ledger")
      .select("fecha, moneda, tipo, monto, concepto")
      .order("fecha", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to)
  );
  return rows.flatMap((row) => {
    const fecha = calendarDayKey(row.fecha);
    const moneda = row.moneda === "USD" ? "USD" : row.moneda === "DOP" ? "DOP" : null;
    const tipo = row.tipo === "Salida" ? "Salida" : row.tipo === "Entrada" ? "Entrada" : null;
    if (!isDayKey(fecha) || !moneda || !tipo) {
      return [];
    }
    return [
      {
        fecha,
        moneda,
        tipo,
        monto: toMoney(row.monto),
        concepto: typeof row.concepto === "string" ? row.concepto : null,
      },
    ];
  });
}

async function listPedidos(): Promise<ReportePedido[]> {
  const supabase = getSupabaseAdminClient();
  const rows = await listAll<Record<string, unknown>>(async (from, to) =>
    supabase
      .from("orders")
      .select("created_at, estado, metodo_pago, total_estimado, tienda")
      .eq("es_prueba", false)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to)
  );
  return rows.flatMap((row) => {
    const fecha = localDayKey(String(row.created_at ?? ""));
    if (!isDayKey(fecha)) {
      return [];
    }
    return [
      {
        fecha,
        estado: String(row.estado ?? ""),
        metodoPago: String(row.metodo_pago ?? ""),
        total: toMoney(row.total_estimado),
        tienda: String(row.tienda ?? ""),
      },
    ];
  });
}

async function tasaUsdDop(): Promise<number> {
  try {
    const parametros = await getCajaParametros();
    return parametros.tasaUsdDop;
  } catch (error) {
    console.error("[admin] reporte sin tasa de caja", error);
    return 0;
  }
}

export async function loadReporteFinanciero(mesParam?: string | null): Promise<ReporteFinanciero> {
  const requestedMes = mesParam != null && mesParam.trim() !== "" ? parseReporteMesParam(mesParam) : null;
  if (mesParam != null && mesParam.trim() !== "" && !requestedMes) {
    throw new Error("El mes no es válido");
  }

  const [parametros, metas, ventas, compras, turnos, ledger, pedidos, tasa] = await Promise.all([
    getParametrosConfig(),
    listMetasMensuales(),
    listVentas(),
    listCompras(),
    listTurnos(),
    listLedger(),
    listPedidos(),
    tasaUsdDop(),
  ]);

  return buildReporteFinanciero({
    mesActivo: parametros.mesActivo,
    ratioRecompra: parametros.ratioRecompra,
    tasaUsdDop: tasa,
    requestedMes,
    today: todayDayKey(),
    ventas,
    compras,
    metas,
    turnos,
    ledger,
    pedidos,
  });
}
