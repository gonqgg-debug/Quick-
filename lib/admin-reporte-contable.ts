import { getParametrosConfig } from "@/lib/admin-parametros";
import {
  buildReporteContable,
  reporteContablePeriodo,
  type ContableCompraInput,
  type ContableLedgerInput,
  type ContableOmitida,
  type ContablePedidoInput,
  type ContableProveedorInput,
  type ContableTurnoInput,
  type ContableVentaInput,
  type ReporteContable,
} from "@/lib/admin-reporte-contable-shared";
import { parseReporteMesParam } from "@/lib/admin-reporte-shared";
import { getCajaParametros } from "@/lib/caja";
import { addDaysToDayKey, calendarDayKey, isDayKey, localDayKey, todayDayKey } from "@/lib/local-day";
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

function textOrNull(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

function proveedorNombre(embed: unknown): string {
  const row = Array.isArray(embed) ? embed[0] : embed;
  if (!row || typeof row !== "object") {
    return "";
  }
  return String((row as { nombre?: unknown }).nombre ?? "").trim();
}

function pushOmitida(omitidas: ContableOmitida[], fuente: string, id: unknown, motivo: string) {
  omitidas.push({ fuente, id: id == null || id === "" ? null : String(id), motivo });
}

async function listVentas(from: string, to: string, omitidas: ContableOmitida[]): Promise<ContableVentaInput[]> {
  const supabase = getSupabaseAdminClient();
  const rows = await listAll<Record<string, unknown>>(async (start, end) =>
    supabase
      .from("ventas_diarias")
      .select("id, fecha, dia_semana, venta_real")
      .gte("fecha", from)
      .lte("fecha", to)
      .order("fecha", { ascending: true })
      .order("id", { ascending: true })
      .range(start, end)
  );
  return rows.flatMap((row) => {
    const fecha = calendarDayKey(row.fecha);
    const id = String(row.id ?? "");
    if (!id || !isDayKey(fecha)) {
      pushOmitida(omitidas, "ventas_diarias", row.id, "Sin id o sin fecha válida");
      return [];
    }
    return [
      {
        id,
        fecha,
        ventaReal: toMoney(row.venta_real),
        diaSemanaRegistrado: textOrNull(row.dia_semana),
      },
    ];
  });
}

async function listCompras(from: string, to: string, omitidas: ContableOmitida[]): Promise<ContableCompraInput[]> {
  const supabase = getSupabaseAdminClient();
  const mapRows = (rows: Record<string, unknown>[]): ContableCompraInput[] =>
    rows.flatMap((row) => {
      const fecha = calendarDayKey(row.fecha);
      const dueDate = calendarDayKey(row.due_date);
      const id = String(row.id ?? "");
      const proveedorId = String(row.proveedor_id ?? "");
      if (!id || !proveedorId || !isDayKey(fecha) || !isDayKey(dueDate)) {
        pushOmitida(omitidas, "compras", row.id, "Sin id, proveedor o fechas válidas");
        return [];
      }
      const pagadoEn = calendarDayKey(row.pagado_en);
      return [
        {
          id,
          proveedorId,
          proveedorNombre: proveedorNombre(row.proveedores),
          monto: toMoney(row.monto),
          fecha,
          dueDate,
          pagado: Boolean(row.pagado),
          pagadoEn: isDayKey(pagadoEn) ? pagadoEn : null,
        },
      ];
    });

  const [porFecha, porPago] = await Promise.all([
    listAll<Record<string, unknown>>(async (start, end) =>
      supabase
        .from("compras")
        .select("id, proveedor_id, monto, fecha, due_date, pagado, pagado_en, proveedores ( nombre )")
        .gte("fecha", from)
        .lte("fecha", to)
        .order("fecha", { ascending: true })
        .order("id", { ascending: true })
        .range(start, end)
    ),
    listAll<Record<string, unknown>>(async (start, end) =>
      supabase
        .from("compras")
        .select("id, proveedor_id, monto, fecha, due_date, pagado, pagado_en, proveedores ( nombre )")
        .gte("pagado_en", from)
        .lte("pagado_en", to)
        .order("pagado_en", { ascending: true })
        .order("id", { ascending: true })
        .range(start, end)
    ),
  ]);

  const merged = new Map<string, ContableCompraInput>();
  for (const compra of [...mapRows(porFecha), ...mapRows(porPago)]) {
    merged.set(compra.id, compra);
  }
  return Array.from(merged.values());
}

async function listProveedores(omitidas: ContableOmitida[]): Promise<ContableProveedorInput[]> {
  const supabase = getSupabaseAdminClient();
  const rows = await listAll<Record<string, unknown>>(async (start, end) =>
    supabase
      .from("proveedores")
      .select("id, nombre, tiene_credito, dias_credito, notas")
      .order("nombre", { ascending: true })
      .range(start, end)
  );
  return rows.flatMap((row) => {
    const id = String(row.id ?? "");
    const nombre = String(row.nombre ?? "").trim();
    if (!id || !nombre) {
      pushOmitida(omitidas, "proveedores", row.id, "Sin id o sin nombre");
      return [];
    }
    const dias = Number(row.dias_credito);
    return [
      {
        id,
        nombre,
        tieneCredito: Boolean(row.tiene_credito),
        diasCredito: Number.isFinite(dias) && dias > 0 ? Math.trunc(dias) : 0,
        notas: textOrNull(row.notas),
      },
    ];
  });
}

async function listTurnos(to: string, omitidas: ContableOmitida[]): Promise<ContableTurnoInput[]> {
  const supabase = getSupabaseAdminClient();
  const rows = await listAll<Record<string, unknown>>(async (start, end) =>
    supabase
      .from("caja_turnos")
      .select(
        "id, fecha, turno, sistema_tarjeta, sistema_efectivo, reportado_tarjeta, reportado_efectivo, reportado_usd, verificado, notas"
      )
      .lte("fecha", to)
      .order("fecha", { ascending: true })
      .order("id", { ascending: true })
      .range(start, end)
  );
  return rows.flatMap((row) => {
    const fecha = calendarDayKey(row.fecha);
    const id = String(row.id ?? "");
    const turno = String(row.turno ?? "").trim();
    if (!id || !isDayKey(fecha) || !turno) {
      pushOmitida(omitidas, "caja_turnos", row.id, "Sin id, fecha o turno");
      return [];
    }
    return [
      {
        id,
        fecha,
        turno,
        sistemaTarjeta: toMoney(row.sistema_tarjeta),
        sistemaEfectivo: toMoney(row.sistema_efectivo),
        reportadoTarjeta: toMoney(row.reportado_tarjeta),
        reportadoEfectivo: toMoney(row.reportado_efectivo),
        reportadoUsd: toMoney(row.reportado_usd),
        verificado: Boolean(row.verificado),
        notas: textOrNull(row.notas),
      },
    ];
  });
}

async function listLedger(to: string, omitidas: ContableOmitida[]): Promise<ContableLedgerInput[]> {
  const supabase = getSupabaseAdminClient();
  const rows = await listAll<Record<string, unknown>>(async (start, end) =>
    supabase
      .from("caja_ledger")
      .select("id, fecha, caja, moneda, tipo, monto, concepto, referencia")
      .lte("fecha", to)
      .order("fecha", { ascending: true })
      .order("id", { ascending: true })
      .range(start, end)
  );
  return rows.flatMap((row) => {
    const fecha = calendarDayKey(row.fecha);
    const id = String(row.id ?? "");
    const caja = row.caja === "Fuerte" || row.caja === "Chica" ? row.caja : null;
    const moneda = row.moneda === "DOP" || row.moneda === "USD" ? row.moneda : null;
    const tipo = row.tipo === "Entrada" || row.tipo === "Salida" ? row.tipo : null;
    if (!id || !isDayKey(fecha) || !caja || !moneda || !tipo) {
      pushOmitida(omitidas, "caja_ledger", row.id, "Sin id, fecha, caja, moneda o tipo válido");
      return [];
    }
    return [
      {
        id,
        fecha,
        caja,
        moneda,
        tipo,
        monto: toMoney(row.monto),
        concepto: textOrNull(row.concepto),
        referencia: textOrNull(row.referencia),
      },
    ];
  });
}

async function listPedidos(from: string, to: string, omitidas: ContableOmitida[]): Promise<ContablePedidoInput[]> {
  const supabase = getSupabaseAdminClient();
  const startIso = `${addDaysToDayKey(from, -1)}T00:00:00.000Z`;
  const endIso = `${addDaysToDayKey(to, 2)}T00:00:00.000Z`;
  const rows = await listAll<Record<string, unknown>>(async (start, end) =>
    supabase
      .from("orders")
      .select("id, created_at, estado, metodo_pago, total_estimado, pago_con, tienda, es_prueba")
      .gte("created_at", startIso)
      .lt("created_at", endIso)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(start, end)
  );
  return rows.flatMap((row) => {
    const createdAt = String(row.created_at ?? "");
    const fecha = localDayKey(createdAt);
    const id = String(row.id ?? "");
    if (!id || !createdAt || !isDayKey(fecha)) {
      pushOmitida(omitidas, "orders", row.id, "Sin id o sin fecha válida");
      return [];
    }
    if (fecha < from || fecha > to) {
      return [];
    }
    const pagoCon = row.pago_con == null || row.pago_con === "" ? null : toMoney(row.pago_con);
    return [
      {
        id,
        createdAt,
        fecha,
        estado: String(row.estado ?? ""),
        metodoPago: String(row.metodo_pago ?? ""),
        totalEstimado: toMoney(row.total_estimado),
        pagoCon,
        tienda: String(row.tienda ?? ""),
        esPrueba: Boolean(row.es_prueba),
      },
    ];
  });
}

async function cajaConfig(): Promise<{
  tasaUsdDop: number | null;
  objetivoCajaChicaDop: number | null;
  saldosIniciales: { fuerteDop: number; fuerteUsd: number; chicaDop: number } | null;
}> {
  try {
    const parametros = await getCajaParametros();
    return {
      tasaUsdDop: parametros.tasaUsdDop,
      objetivoCajaChicaDop: parametros.objetivoCajaChicaDop,
      saldosIniciales: {
        fuerteDop: parametros.saldoInicialCajaFuerteDop,
        fuerteUsd: parametros.saldoInicialCajaFuerteUsd,
        chicaDop: parametros.saldoInicialCajaChicaDop,
      },
    };
  } catch (error) {
    console.error("[admin] reporte contable sin parámetros de caja", error);
    return { tasaUsdDop: null, objetivoCajaChicaDop: null, saldosIniciales: null };
  }
}

async function metaDelMes(mes: string): Promise<number | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.from("metas_mensuales").select("meta").eq("mes", mes).maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) {
    return null;
  }
  return toMoney((data as { meta?: unknown }).meta);
}

export async function loadReporteContable(mesParam?: string | null): Promise<ReporteContable> {
  const requested = mesParam != null && mesParam.trim() !== "" ? parseReporteMesParam(mesParam) : null;
  if (mesParam != null && mesParam.trim() !== "" && !requested) {
    throw new Error("El mes no es válido");
  }

  const parametros = await getParametrosConfig();
  const monthKey = requested ?? parseReporteMesParam(parametros.mesActivo);
  const periodo = monthKey ? reporteContablePeriodo(monthKey) : null;
  if (!monthKey || !periodo) {
    throw new Error("El mes no es válido");
  }

  const omitidas: ContableOmitida[] = [];
  const [caja, meta, ventas, compras, proveedores, turnos, ledger, pedidos] = await Promise.all([
    cajaConfig(),
    metaDelMes(periodo.mes),
    listVentas(periodo.from, periodo.to, omitidas),
    listCompras(periodo.from, periodo.to, omitidas),
    listProveedores(omitidas),
    listTurnos(periodo.to, omitidas),
    listLedger(periodo.to, omitidas),
    listPedidos(periodo.from, periodo.to, omitidas),
  ]);

  return buildReporteContable({
    generadoEn: new Date().toISOString(),
    today: todayDayKey(),
    monthKey,
    mesActivo: parametros.mesActivo,
    ratioRecompra: parametros.ratioRecompra,
    umbralCuidado: parametros.umbralCuidado,
    umbralStop: parametros.umbralStop,
    pesoReciente: parametros.pesoReciente,
    pesoIntermedio: parametros.pesoIntermedio,
    pesoAntiguo: parametros.pesoAntiguo,
    meta,
    tasaUsdDop: caja.tasaUsdDop,
    objetivoCajaChicaDop: caja.objetivoCajaChicaDop,
    saldosIniciales: caja.saldosIniciales,
    ventas,
    compras,
    proveedores,
    turnos,
    ledger,
    pedidos,
    filasOmitidas: omitidas,
  });
}
