import { COSTO_METODO, asociacionCanasta, coberturaDeFechas, estadoComparacion, estadoHora, promedioOcurrencia, variacionPct, type EstadoComparacion, type EstadoHora } from "@/lib/consumo-metricas";
import { precioMedio, semanaDe } from "@/lib/consumo-producto-ui";
import { addDaysToDayKey, isDayKey, yesterdayDayKey } from "@/lib/local-day";
import {
  CONSUMO_PAGE_DEFAULT,
  TIENDA_DEFAULT,
  decodeCursor,
  encodeCursor,
  ventanasSemana,
  margenConsumo,
  parseDias,
  parseLimit,
  parseMetrica,
  parseOrden,
  resolverPeriodo,
  tasaCatalogo,
  type ConsumoPeriodo,
  type OrdenConsumo,
} from "@/lib/pos-domain";
import { leerConsultaProductos, tiendaPermitida } from "@/lib/consumo-productos-ui";
import {
  cerrarTurnos,
  coberturaDe,
  construirMapa,
  elegirHallazgoHorario,
  type FilaHora,
  type HallazgoHorarioVista,
  type MapaHorario,
  type ProductoFranja,
  type RelojId,
  type TurnoCaja,
} from "@/lib/consumo-horarios-ui";
import { destacadosMiles } from "@/lib/miles-store";
import { getSupabaseAdminClient } from "@/lib/supabase";

type RpcError = { message?: string; code?: string } | null;

function fallar(error: RpcError): never {
  const message = error?.message ?? "";
  if (/does not exist|schema cache|Could not find the function|PGRST202|42P01/i.test(message)) {
    throw new Error("Falta aplicar la migración de consumo");
  }
  throw new Error(message || "No pudimos leer el consumo");
}

function num(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function numOrNull(value: unknown): number | null {
  if (value == null || value === "") {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function dia(value: unknown): string {
  return String(value ?? "").slice(0, 10);
}

export type FrescuraConsumo = {
  ultimaFecha: string | null;
  faltaAyer: boolean;
  pendientes: number;
  partesAbiertas: number;
  sincronizadoEn: string | null;
};

export type DiaConsumo = {
  fecha: string;
  venta: number;
  ordenes: number;
  ticket: number | null;
  unidades: number;
  unidadesPorTicket: number | null;
};

export type MixPago = {
  efectivo: number;
  tarjeta: number;
  banco: number;
  credito: number;
  otro: number;
};

export type KpisConsumo = {
  venta: number;
  ordenes: number;
  ticket: number | null;
  unidadesPorTicket: number | null;
  unidades: number;
  margen: number | null;
  margenPct: number | null;
  cobertura: number | null;
  ventaConCosto: number;
  ventaNetaConCosto: number;
  metodoCosto: typeof COSTO_METODO;
};

export type ProductoConsumo = {
  codigo: string;
  productId: string | null;
  nombre: string;
  marca: string | null;
  categoria: string;
  unidades: number;
  venta: number;
  ordenes: number;
  costo: number | null;
  costoOrigen: string | null;
  costoFecha: string | null;
  costoRef: string | null;
  margen: number | null;
  margenPct: number | null;
  ventaAnterior: number | null;
  variacion: number | null;
  matchEstado: "match" | "sin_match";
  ventaNeta: number | null;
  costoVentas: number | null;
  codigoBarras: string | null;
};

export type ResumenProductos = {
  nProductos: number;
  unidades: number;
  venta: number;
  ventaNeta: number;
  ventaConCosto: number;
  ventaNetaConCosto: number;
  costoVentas: number | null;
  margen: number | null;
  nSinCosto: number;
  ventaComparable: number | null;
  ventaAnterior: number | null;
};

export type ResumenConsumo = {
  periodo: ConsumoPeriodo;
  frescura: FrescuraConsumo;
  kpis: KpisConsumo;
  anterior: KpisConsumo | null;
  kpisComparados: KpisConsumo | null;
  comparacionEstado: EstadoComparacion;
  mix: MixPago;
  dias: DiaConsumo[];
  diasAnterior: DiaConsumo[];
  top: ProductoConsumo[];
  topMargen: ProductoConsumo[];
  horas: CeldaHorario[];
  turnos: Array<{ turno: "am" | "pm"; venta: number; ordenes: number; ticket: number | null; unidadesPorTicket: number | null }>;
  calidad: { sinMatchProductos: number; sinMatchVenta: number; sinCostoProductos: number; sinCostoVenta: number; descuadradas: number };
  tendencias: {
    semana: {
      actual: number;
      anterior: number;
      desde: string;
      hasta: string;
      anteriorDesde: string;
      anteriorHasta: string;
    };
    mes: { actual: number; anterior: number; desde: string; hasta: string };
  };
  categorias: Array<{ categoria: string; venta: number }>;
};

function kpisDe(
  dias: DiaConsumo[],
  margen: { venta: number; ventaConCosto: number; margen: number | null; unidades: number; ventaNetaConCosto: number } | null,
): KpisConsumo {
  const venta = dias.reduce((sum, dia) => sum + dia.venta, 0);
  const ordenes = dias.reduce((sum, dia) => sum + dia.ordenes, 0);
  const unidades = margen?.unidades ?? dias.reduce((sum, dia) => sum + dia.unidades, 0);
  const ventaConCosto = margen?.ventaConCosto ?? 0;
  const margenValor = margen?.margen ?? null;
  const ventaNeta = margen?.ventaNetaConCosto ?? 0;
  return {
    venta: Math.round(venta * 100) / 100,
    ordenes,
    ticket: ordenes > 0 ? Math.round((venta / ordenes) * 100) / 100 : null,
    unidadesPorTicket: ordenes > 0 ? Math.round((unidades / ordenes) * 1000) / 1000 : null,
    unidades,
    margen: margenValor,
    margenPct: margenValor == null || ventaNeta === 0 ? null : Math.round((margenValor / ventaNeta) * 10000) / 10000,
    cobertura: (margen?.venta ?? 0) > 0 ? Math.round((ventaConCosto / (margen?.venta ?? 0)) * 10000) / 10000 : null,
    ventaConCosto,
    ventaNetaConCosto: ventaNeta,
    metodoCosto: COSTO_METODO,
  };
}

function mapDia(row: Record<string, unknown>): DiaConsumo {
  return {
    fecha: dia(row.fecha),
    venta: num(row.venta),
    ordenes: num(row.n_ordenes),
    ticket: numOrNull(row.ticket_promedio),
    unidades: num(row.unidades),
    unidadesPorTicket: numOrNull(row.unidades_por_ticket),
  };
}

async function margenPeriodo(tienda: string, desde: string, hasta: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc("consumo_margen_periodo", {
    p_tienda: tienda,
    p_desde: desde,
    p_hasta: hasta,
  });
  if (error) {
    fallar(error);
  }
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) {
    return { venta: 0, ventaConCosto: 0, margen: null as number | null, unidades: 0, ventaNetaConCosto: 0 };
  }
  return {
    venta: num(row.venta),
    ventaConCosto: num(row.venta_con_costo),
    margen: numOrNull(row.margen),
    unidades: num(row.unidades),
    ventaNetaConCosto: num(row.venta_neta_con_costo),
  };
}

const PAGINA_RESUMEN = 1000;

async function paginar<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: RpcError }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGINA_RESUMEN) {
    const page = await fetchPage(from, from + PAGINA_RESUMEN - 1);
    if (page.error) {
      fallar(page.error);
    }
    const chunk = page.data ?? [];
    rows.push(...chunk);
    if (chunk.length < PAGINA_RESUMEN) {
      return rows;
    }
  }
}

function mapProducto(row: Record<string, unknown>): ProductoConsumo {
  const costo = numOrNull(row.costo_unit);
  const venta = num(row.venta);
  const unidades = num(row.unidades);
  return {
    codigo: String(row.codigo_odoo ?? ""),
    productId: row.product_id ? String(row.product_id) : null,
    nombre: String(row.nombre ?? row.codigo_odoo ?? ""),
    marca: row.marca ? String(row.marca) : null,
    categoria: String(row.categoria ?? "Sin categoría"),
    unidades,
    venta,
    ordenes: num(row.n_ordenes),
    costo,
    costoOrigen: row.costo_origen ? String(row.costo_origen) : null,
    costoFecha: row.costo_fecha ? dia(row.costo_fecha) : null,
    costoRef: row.costo_ref ? String(row.costo_ref) : null,
    margen: row.margen == null ? margenConsumo(venta, unidades, costo) : numOrNull(row.margen),
    margenPct: numOrNull(row.margen_pct),
    ventaAnterior: numOrNull(row.venta_anterior),
    variacion: numOrNull(row.variacion),
    matchEstado: row.match_estado === "sin_match" || row.product_id == null ? "sin_match" : "match",
    ventaNeta: numOrNull(row.venta_neta),
    costoVentas: numOrNull(row.costo_ventas),
    codigoBarras: row.codigo_barras ? String(row.codigo_barras) : null,
  };
}

function valorDeOrden(row: ProductoConsumo, orden: OrdenConsumo): number | null {
  if (orden === "unidades" || orden === "unidades_asc") return row.unidades;
  if (orden === "margen" || orden === "margen_asc") return row.margen;
  if (orden === "margen_pct" || orden === "margen_pct_asc") return row.margenPct;
  if (orden === "variacion" || orden === "variacion_asc") return row.variacion;
  if (orden === "venta_neta" || orden === "venta_neta_asc") return row.ventaNeta;
  if (orden === "costo_ventas" || orden === "costo_ventas_asc") return row.costoVentas;
  return row.venta;
}

export async function cargarFrescura(now = Date.now(), tienda = TIENDA_DEFAULT): Promise<FrescuraConsumo> {
  const supabase = getSupabaseAdminClient();
  const ayer = yesterdayDayKey(now);
  const desde = addDaysToDayKey(ayer, -29);
  const [ultima, ayerRow, calidad, partes, sincronizado] = await Promise.all([
    supabase.from("pos_sesiones").select("fecha_operativa").eq("tienda", tienda).order("fecha_operativa", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("pos_sesiones").select("id").eq("tienda", tienda).eq("fecha_operativa", ayer).limit(1),
    supabase.rpc("consumo_calidad_conteos", { p_tienda: tienda, p_desde: desde, p_hasta: ayer }),
    supabase.from("pos_sesiones").select("id", { count: "exact", head: true }).eq("tienda", tienda).eq("ingesta", "parcial"),
    supabase.from("pos_sesiones").select("ingested_at").eq("tienda", tienda).order("ingested_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (ultima.error) {
    fallar(ultima.error);
  }
  if (ayerRow.error) {
    fallar(ayerRow.error);
  }
  if (calidad.error) {
    fallar(calidad.error);
  }
  if (partes.error) {
    fallar(partes.error);
  }
  if (sincronizado.error) {
    fallar(sincronizado.error);
  }
  const calidadRow = Array.isArray(calidad.data) ? calidad.data[0] : null;
  const ultimaFecha = ultima.data?.fecha_operativa ? dia(ultima.data.fecha_operativa) : null;
  const pendientes = num(calidadRow?.sin_match_productos) + num(calidadRow?.sin_costo_productos);
  const ingested = sincronizado.data?.ingested_at ? String(sincronizado.data.ingested_at) : null;
  return {
    ultimaFecha,
    faltaAyer: Boolean(ultimaFecha) && (ayerRow.data?.length ?? 0) === 0,
    pendientes,
    partesAbiertas: partes.count ?? 0,
    sincronizadoEn: ingested,
  };
}

export async function cargarResumen(periodo: ConsumoPeriodo, now = Date.now(), tienda = TIENDA_DEFAULT): Promise<ResumenConsumo> {
  const supabase = getSupabaseAdminClient();
  const semanaVentana = ventanasSemana(periodo.hasta);
  const lunesPrevio = semanaVentana.anterior.desde;
  const mesDesde = `${periodo.hasta.slice(0, 7)}-01`;
  const mesPrevioHasta = addDaysToDayKey(mesDesde, -1);
  const mesPrevioDesde = `${mesPrevioHasta.slice(0, 7)}-01`;
  const coberturaDesde = [periodo.desde, periodo.anterior.desde, lunesPrevio, mesPrevioDesde].sort()[0];

  const [diasTodos, margen, margenTramo, margenAnt, top, topMargen, horas, calidad, turnos, categorias, frescura] = await Promise.all([
    paginar((from, to) =>
      supabase
        .from("resumen_dia")
        .select("fecha, n_ordenes, venta, ticket_promedio, unidades_por_ticket, unidades, efectivo, banco, tarjeta, credito, otro")
        .eq("tienda", tienda)
        .gte("fecha", coberturaDesde)
        .lte("fecha", periodo.hasta)
        .order("fecha", { ascending: true })
        .range(from, to),
    ),
    margenPeriodo(tienda, periodo.desde, periodo.hasta),
    periodo.tramo ? margenPeriodo(tienda, periodo.tramo.desde, periodo.tramo.hasta) : Promise.resolve(null),
    periodo.comparar ? margenPeriodo(tienda, periodo.anterior.desde, periodo.anterior.hasta) : Promise.resolve(null),
    supabase.rpc("consumo_top_productos", {
      p_tienda: tienda,
      p_desde: periodo.desde,
      p_hasta: periodo.hasta,
      p_desde_ant: periodo.comparar ? periodo.anterior.desde : null,
      p_hasta_ant: periodo.comparar ? periodo.anterior.hasta : null,
      p_orden: "venta",
      p_categoria: null,
      p_q: null,
      p_limit: 8,
      p_cursor_null: null,
      p_cursor_valor: null,
      p_cursor_codigo: null,
    }),
    supabase.rpc("consumo_top_productos", {
      p_tienda: tienda,
      p_desde: periodo.desde,
      p_hasta: periodo.hasta,
      p_desde_ant: periodo.comparar ? periodo.anterior.desde : null,
      p_hasta_ant: periodo.comparar ? periodo.anterior.hasta : null,
      p_orden: "margen",
      p_categoria: null,
      p_q: null,
      p_limit: 8,
      p_cursor_null: null,
      p_cursor_valor: null,
      p_cursor_codigo: null,
    }),
    supabase.rpc("consumo_mapa_horas", {
      p_tienda: tienda,
      p_desde: periodo.desde,
      p_hasta: periodo.hasta,
      p_categoria: null,
      p_reloj: "real",
    }),
    supabase.rpc("consumo_calidad_conteos", { p_tienda: tienda, p_desde: periodo.desde, p_hasta: periodo.hasta }),
    paginar((from, to) =>
      supabase
        .from("resumen_turno_dia")
        .select("turno, n_ordenes, venta, ticket_promedio, unidades_por_ticket")
        .eq("tienda", tienda)
        .gte("fecha", periodo.desde)
        .lte("fecha", periodo.hasta)
        .range(from, to),
    ),
    supabase.rpc("consumo_categorias", { p_tienda: tienda, p_desde: periodo.desde, p_hasta: periodo.hasta }),
    cargarFrescura(now, tienda),
  ]);

  if (top.error) fallar(top.error);
  if (topMargen.error) fallar(topMargen.error);
  if (horas.error) fallar(horas.error);
  if (calidad.error) fallar(calidad.error);
  if (categorias.error) fallar(categorias.error);

  const todos = diasTodos.map((row) => ({ ...mapDia(row), mix: row }));
  const enRango = (desde: string, hasta: string) => todos.filter((row) => row.fecha >= desde && row.fecha <= hasta);
  const dias = enRango(periodo.desde, periodo.hasta);
  const diasAnterior = enRango(periodo.anterior.desde, periodo.anterior.hasta);
  const suma = (desde: string, hasta: string) =>
    Math.round(enRango(desde, hasta).reduce((sum, row) => sum + row.venta, 0) * 100) / 100;
  const mix = dias.reduce(
    (acc, row) => {
      const source = row.mix as Record<string, unknown>;
      acc.efectivo += num(source.efectivo);
      acc.tarjeta += num(source.tarjeta);
      acc.banco += num(source.banco);
      acc.credito += num(source.credito);
      acc.otro += num(source.otro);
      return acc;
    },
    { efectivo: 0, tarjeta: 0, banco: 0, credito: 0, otro: 0 },
  );
  const calidadRow = Array.isArray(calidad.data) ? calidad.data[0] : null;
  const turnosAgg = new Map<"am" | "pm", { venta: number; ordenes: number; unidadesTicket: number; tickets: number }>();
  for (const row of turnos) {
    const turno = row.turno === "pm" ? "pm" : "am";
    const current = turnosAgg.get(turno) ?? { venta: 0, ordenes: 0, unidadesTicket: 0, tickets: 0 };
    current.venta += num(row.venta);
    current.ordenes += num(row.n_ordenes);
    current.unidadesTicket += num(row.unidades_por_ticket) * num(row.n_ordenes);
    current.tickets += num(row.n_ordenes);
    turnosAgg.set(turno, current);
  }

  const fechas = todos.map((row) => row.fecha);
  const tramo = periodo.tramo;
  const coberturaTramo = tramo ? coberturaDeFechas(fechas, tramo.desde, tramo.hasta) : { completa: false, dias: 0, esperados: 0 };
  const coberturaAnterior = periodo.comparar ? coberturaDeFechas(fechas, periodo.anterior.desde, periodo.anterior.hasta) : { completa: false, dias: 0, esperados: 0 };
  const diasTramo = tramo ? enRango(tramo.desde, tramo.hasta) : [];
  const kpisTramo = tramo ? kpisDe(diasTramo, margenTramo) : null;
  const kpisAnterior = periodo.comparar ? kpisDe(diasAnterior, margenAnt) : null;
  const comparacionEstado = estadoComparacion({
    pedida: periodo.comparacion !== "off",
    coberturaCompleta: Boolean(tramo) && coberturaTramo.completa && coberturaAnterior.completa,
    base: kpisAnterior?.venta ?? null,
  });
  const comparacionVisible = comparacionEstado === "ok" || comparacionEstado === "sin_base";

  return {
    periodo,
    frescura,
    kpis: kpisDe(dias, margen),
    anterior: comparacionVisible ? kpisAnterior : null,
    kpisComparados: comparacionVisible ? kpisTramo : null,
    comparacionEstado,
    mix: {
      efectivo: Math.round(mix.efectivo * 100) / 100,
      tarjeta: Math.round(mix.tarjeta * 100) / 100,
      banco: Math.round(mix.banco * 100) / 100,
      credito: Math.round(mix.credito * 100) / 100,
      otro: Math.round(mix.otro * 100) / 100,
    },
    dias,
    diasAnterior,
    top: ((top.data ?? []) as Record<string, unknown>[]).map(mapProducto),
    topMargen: ((topMargen.data ?? []) as Record<string, unknown>[]).map(mapProducto).filter((row) => row.margen != null),
    horas: ((horas.data ?? []) as Record<string, unknown>[]).map((row) => mapCelda(row)),
    turnos: (["am", "pm"] as const).map((turno) => {
      const item = turnosAgg.get(turno);
      return {
        turno,
        venta: Math.round((item?.venta ?? 0) * 100) / 100,
        ordenes: item?.ordenes ?? 0,
        ticket: item && item.ordenes > 0 ? Math.round((item.venta / item.ordenes) * 100) / 100 : null,
        unidadesPorTicket: item && item.tickets > 0 ? Math.round((item.unidadesTicket / item.tickets) * 1000) / 1000 : null,
      };
    }),
    calidad: {
      sinMatchProductos: num(calidadRow?.sin_match_productos),
      sinMatchVenta: num(calidadRow?.sin_match_venta),
      sinCostoProductos: num(calidadRow?.sin_costo_productos),
      sinCostoVenta: num(calidadRow?.sin_costo_venta),
      descuadradas: num(calidadRow?.descuadradas),
    },
    tendencias: {
      semana: {
        actual: suma(semanaVentana.actual.desde, semanaVentana.actual.hasta),
        anterior: suma(semanaVentana.anterior.desde, semanaVentana.anterior.hasta),
        desde: semanaVentana.actual.desde,
        hasta: semanaVentana.actual.hasta,
        anteriorDesde: semanaVentana.anterior.desde,
        anteriorHasta: semanaVentana.anterior.hasta,
      },
      mes: {
        actual: suma(mesDesde, periodo.hasta),
        anterior: suma(mesPrevioDesde, mesPrevioHasta),
        desde: mesDesde,
        hasta: periodo.hasta,
      },
    },
    categorias: ((categorias.data ?? []) as Record<string, unknown>[]).map((row) => ({
      categoria: String(row.categoria ?? ""),
      venta: num(row.venta),
    })),
  };
}

export async function cargarProductos(input: {
  periodo: ConsumoPeriodo;
  orden: OrdenConsumo;
  categoria: string;
  q: string;
  cursor: string | null;
  limit?: number;
  offset?: number;
  sinCosto?: boolean;
  tienda?: string;
  conAlcance?: boolean;
}) {
  const supabase = getSupabaseAdminClient();
  const tienda = input.tienda || TIENDA_DEFAULT;
  const limite = parseLimit(input.limit == null ? null : String(input.limit), CONSUMO_PAGE_DEFAULT);
  const offset = Math.max(0, input.offset ?? 0);
  const cursor = offset > 0 ? null : decodeCursor(input.cursor, input.orden);
  const { data, error } = await supabase.rpc("consumo_top_productos", {
    p_tienda: tienda,
    p_desde: input.periodo.desde,
    p_hasta: input.periodo.hasta,
    p_desde_ant: input.periodo.comparar ? input.periodo.anterior.desde : null,
    p_hasta_ant: input.periodo.comparar ? input.periodo.anterior.hasta : null,
    p_orden: input.orden,
    p_categoria: input.categoria || null,
    p_q: input.q || null,
    p_limit: cursor || offset === 0 ? limite + 1 : limite,
    p_cursor_null: cursor ? cursor.n : null,
    p_cursor_valor: cursor ? cursor.v : null,
    p_cursor_codigo: cursor ? cursor.id : null,
    p_offset: offset,
    p_sin_costo: Boolean(input.sinCosto),
  });
  if (error) {
    fallar(error);
  }
  let ventaAlcance = 0;
  let ventaPeriodo = 0;
  if (input.conAlcance !== false) {
    const alcance = await supabase.rpc("consumo_venta_alcance", {
      p_tienda: tienda,
      p_desde: input.periodo.desde,
      p_hasta: input.periodo.hasta,
      p_categoria: input.categoria || null,
      p_q: input.q || null,
      p_sin_costo: Boolean(input.sinCosto),
    });
    if (alcance.error) {
      fallar(alcance.error);
    }
    const periodoTotal = await supabase.rpc("consumo_venta_alcance", {
      p_tienda: tienda,
      p_desde: input.periodo.desde,
      p_hasta: input.periodo.hasta,
      p_categoria: null,
      p_q: null,
      p_sin_costo: false,
    });
    if (periodoTotal.error) {
      fallar(periodoTotal.error);
    }
    ventaAlcance = num(alcance.data);
    ventaPeriodo = num(periodoTotal.data);
  }
  const rows = ((data ?? []) as Record<string, unknown>[]).map(mapProducto);
  const page = rows.slice(0, limite);
  const last = page[page.length - 1];
  const sortValor = last ? valorDeOrden(last, input.orden) : null;
  return {
    rows: page,
    ventaPeriodo,
    ventaAlcance,
    nextCursor:
      rows.length > limite && last
        ? encodeCursor({
            n: sortValor == null ? 1 : 0,
            v: sortValor ?? null,
            id: last.codigo,
            orden: input.orden,
          })
        : null,
  };
}

export async function cargarProducto(codigo: string, periodo: ConsumoPeriodo, tienda = TIENDA_DEFAULT) {
  const supabase = getSupabaseAdminClient();
  const comparar = periodo.comparar;
  const [dias, diasAnt, producto, cobertura, coberturaAnterior] = await Promise.all([
    paginar((from, to) =>
      supabase
        .from("resumen_producto_dia")
        .select("fecha, unidades, venta, venta_neta, unidades_sin_itbis, n_ordenes, nombre, product_id")
        .eq("tienda", tienda)
        .eq("codigo_odoo", codigo)
        .gte("fecha", periodo.desde)
        .lte("fecha", periodo.hasta)
        .order("fecha", { ascending: true })
        .range(from, to),
    ),
    comparar
      ? paginar((from, to) =>
          supabase
            .from("resumen_producto_dia")
            .select("fecha, unidades, venta, n_ordenes")
            .eq("tienda", tienda)
            .eq("codigo_odoo", codigo)
            .gte("fecha", periodo.anterior.desde)
            .lte("fecha", periodo.anterior.hasta)
            .order("fecha", { ascending: true })
            .range(from, to),
        )
      : Promise.resolve([]),
    supabase.from("products").select("id, nombre, marca, categoria, precio, tasa_itbis, codigo_odoo, codigo_barras").eq("codigo_odoo", codigo).limit(1).maybeSingle(),
    fechasResumen(tienda, periodo.desde, periodo.hasta),
    comparar ? fechasResumen(tienda, periodo.anterior.desde, periodo.anterior.hasta) : Promise.resolve([] as string[]),
  ]);
  if (producto.error) fallar(producto.error);

  const productId = producto.data?.id ? String(producto.data.id) : dias.find((row) => row.product_id)?.product_id ?? null;
  let presentacion: string | null = null;
  if (productId) {
    const presentaciones = await supabase.from("producto_presentaciones").select("presentacion").eq("producto_id", productId).limit(12);
    if (!presentaciones.error) {
      const unicas = Array.from(new Set((presentaciones.data ?? []).map((row) => String(row.presentacion ?? "")).filter(Boolean)));
      presentacion = unicas.length > 0 ? unicas.join(" · ") : null;
    }
  }
  const costo = productId
    ? await supabase.from("costo_producto_vigente").select("costo_unit, origen, fecha, ref").eq("product_id", productId).maybeSingle()
    : { data: null, error: null };
  if (costo.error) {
    fallar(costo.error);
  }
  const serie = dias.map((row) => ({
    fecha: dia(row.fecha),
    unidades: num(row.unidades),
    venta: num(row.venta),
    ordenes: num(row.n_ordenes),
  }));
  const venta = Math.round(serie.reduce((sum, row) => sum + row.venta, 0) * 100) / 100;
  const ventaNeta = Math.round(dias.reduce((sum, row) => sum + num(row.venta_neta), 0) * 100) / 100;
  const unidadesSinItbis = dias.reduce((sum, row) => sum + num(row.unidades_sin_itbis), 0);
  const unidades = serie.reduce((sum, row) => sum + row.unidades, 0);
  const costoUnit = numOrNull(costo.data?.costo_unit);
  const nombreResumen = dias.find((row) => row.nombre)?.nombre;
  const serieAnterior = comparar
    ? diasAnt.map((row) => ({
        fecha: dia(row.fecha),
        unidades: num(row.unidades),
        venta: num(row.venta),
      }))
    : null;
  const anteriorCompleta = comparar && coberturaDeFechas(coberturaAnterior, periodo.anterior.desde, periodo.anterior.hasta).completa;
  const ventaAnterior = !comparar
    ? null
    : serieAnterior && serieAnterior.length > 0
      ? Math.round(serieAnterior.reduce((sum, row) => sum + row.venta, 0) * 100) / 100
      : anteriorCompleta
        ? 0
        : null;
  const unidadesAnterior = !comparar
    ? null
    : serieAnterior && serieAnterior.length > 0
      ? Math.round(serieAnterior.reduce((sum, row) => sum + row.unidades, 0) * 1000) / 1000
      : anteriorCompleta
        ? 0
        : null;
  const margen = costoUnit == null ? null : Math.round((ventaNeta - costoUnit * unidadesSinItbis) * 100) / 100;
  const medio = precioMedio(venta, unidades);
  return {
    codigo,
    productId: productId ? String(productId) : null,
    nombre: String(producto.data?.nombre ?? nombreResumen ?? codigo),
    marca: producto.data?.marca ? String(producto.data.marca) : null,
    categoria: producto.data ? String(producto.data.categoria ?? "Sin categoría") : "Sin match",
    matchEstado: producto.data ? ("match" as const) : ("sin_match" as const),
    codigoBarras: producto.data?.codigo_barras ? String(producto.data.codigo_barras) : null,
    presentacion,
    precioCatalogo: producto.data?.precio == null ? null : num(producto.data.precio),
    tasaItbis: producto.data ? tasaCatalogo(producto.data.tasa_itbis) : null,
    venta,
    ventaNeta,
    unidades,
    ordenes: serie.reduce((sum, row) => sum + row.ordenes, 0),
    precioRealizado: medio,
    precioMedio: medio,
    precioMedioAnterior: comparar && ventaAnterior != null && unidadesAnterior != null ? precioMedio(ventaAnterior, unidadesAnterior) : null,
    costo: costoUnit,
    costoOrigen: costo.data?.origen ? String(costo.data.origen) : null,
    costoFecha: costo.data?.fecha ? dia(costo.data.fecha) : null,
    costoRef: costo.data?.ref ? String(costo.data.ref) : null,
    margen,
    margenPct: margen == null || ventaNeta === 0 ? null : Math.round((margen / ventaNeta) * 10000) / 10000,
    ventaAnterior,
    unidadesAnterior,
    variacion: variacionPct(venta, ventaAnterior),
    cobertura,
    coberturaAnterior,
    encontrado: Boolean(producto.data) || dias.length > 0,
    serie,
    serieAnterior,
  };
}

export type CeldaHorario = {
  dow: number;
  hora: number;
  venta: number;
  ordenes: number;
  unidades: number;
  ocurrencias: number;
  incompletas: number;
  promedio: number | null;
  ticket: number | null;
  estado: EstadoHora;
};

function mapCelda(row: Record<string, unknown>): CeldaHorario {
  const venta = num(row.venta);
  const ordenes = num(row.n_ordenes);
  const ocurrencias = num(row.ocurrencias);
  const incompletas = num(row.incompletas);
  return {
    dow: num(row.dow),
    hora: num(row.hora),
    venta,
    ordenes,
    unidades: num(row.unidades),
    ocurrencias,
    incompletas,
    promedio: promedioOcurrencia(venta, ocurrencias),
    ticket: ordenes > 0 ? Math.round((venta / ordenes) * 100) / 100 : null,
    estado: estadoHora({ ocurrencias, ordenes, incompletas }),
  };
}

export async function cargarHorarios(periodo: ConsumoPeriodo, categoria: string, reloj: "real" | "caja" = "real") {
  const supabase = getSupabaseAdminClient();
  const [horas, turnos, categorias] = await Promise.all([
    supabase.rpc("consumo_mapa_horas", {
      p_tienda: TIENDA_DEFAULT,
      p_desde: periodo.desde,
      p_hasta: periodo.hasta,
      p_categoria: categoria || null,
      p_reloj: reloj,
    }),
    paginar((from, to) =>
      supabase
        .from("resumen_turno_dia")
        .select("turno, n_ordenes, venta, ticket_promedio, unidades_por_ticket, unidades")
        .eq("tienda", TIENDA_DEFAULT)
        .gte("fecha", periodo.desde)
        .lte("fecha", periodo.hasta)
        .range(from, to),
    ),
    supabase.rpc("consumo_categorias", { p_tienda: TIENDA_DEFAULT, p_desde: periodo.desde, p_hasta: periodo.hasta }),
  ]);
  if (horas.error) fallar(horas.error);
  if (categorias.error) fallar(categorias.error);
  const celdas = ((horas.data ?? []) as Record<string, unknown>[]).map((row) => mapCelda(row));
  const porTurno = new Map<string, { venta: number; ordenes: number; unidades: number }>();
  for (const row of turnos) {
    const key = String(row.turno);
    const current = porTurno.get(key) ?? { venta: 0, ordenes: 0, unidades: 0 };
    current.venta += num(row.venta);
    current.ordenes += num(row.n_ordenes);
    current.unidades += num(row.unidades);
    porTurno.set(key, current);
  }
  return {
    reloj,
    celdas,
    turnos: (["am", "pm"] as const).map((turno) => {
      const item = porTurno.get(turno) ?? { venta: 0, ordenes: 0, unidades: 0 };
      return {
        turno,
        venta: Math.round(item.venta * 100) / 100,
        ordenes: item.ordenes,
        ticket: item.ordenes > 0 ? Math.round((item.venta / item.ordenes) * 100) / 100 : null,
        unidadesPorTicket: item.ordenes > 0 ? Math.round((item.unidades / item.ordenes) * 1000) / 1000 : null,
      };
    }),
    categorias: ((categorias.data ?? []) as Record<string, unknown>[]).map((row) => String(row.categoria ?? "")),
  };
}

async function filasHoras(tienda: string, desde: string, hasta: string, categoria: string, reloj: RelojId): Promise<FilaHora[]> {
  const supabase = getSupabaseAdminClient();
  const pagina = 1000;
  const filas: FilaHora[] = [];
  for (let offset = 0; offset < 20000; offset += pagina) {
    const { data, error } = await supabase.rpc("consumo_horas_fecha", {
      p_tienda: tienda,
      p_desde: desde,
      p_hasta: hasta,
      p_categoria: categoria || null,
      p_reloj: reloj,
      p_limit: pagina,
      p_offset: offset,
    });
    if (error) fallar(error);
    const rows = (data ?? []) as Record<string, unknown>[];
    for (const row of rows) {
      const fecha = dia(row.fecha);
      const hora = num(row.hora);
      if (!isDayKey(fecha) || hora < 0 || hora > 23) continue;
      filas.push({
        fecha,
        hora,
        venta: num(row.venta),
        tickets: num(row.n_ordenes),
        unidades: num(row.unidades),
        cobertura: coberturaDe(row.cobertura),
      });
    }
    if (rows.length < pagina) break;
  }
  return filas;
}

function mapTurno(turno: "am" | "pm", row: Record<string, unknown> | undefined): Omit<TurnoCaja, "participacion"> {
  const sesiones = num(row?.n_sesiones);
  const tickets = num(row?.n_ordenes);
  const venta = sesiones > 0 ? num(row?.venta) : null;
  const unidades = sesiones > 0 ? num(row?.unidades) : null;
  return {
    turno,
    venta,
    tickets: sesiones > 0 ? tickets : null,
    unidades,
    ticket: venta != null && tickets > 0 ? Math.round((venta / tickets) * 100) / 100 : null,
    unidadesPorTicket: unidades != null && tickets > 0 ? Math.round((unidades / tickets) * 1000) / 1000 : null,
    sesiones,
    aperturaMin: row?.apertura_min ? String(row.apertura_min) : null,
    aperturaMax: row?.apertura_max ? String(row.apertura_max) : null,
    cierreMin: row?.cierre_min ? String(row.cierre_min) : null,
    cierreMax: row?.cierre_max ? String(row.cierre_max) : null,
  };
}

export async function cargarProductosFranja(input: {
  tienda: string;
  desde: string;
  hasta: string;
  categoria: string;
  reloj: RelojId;
  dow: number;
  hora: number;
}): Promise<{ productos: ProductoFranja[]; truncado: boolean }> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc("consumo_productos_franja", {
    p_tienda: input.tienda,
    p_desde: input.desde,
    p_hasta: input.hasta,
    p_categoria: input.categoria || null,
    p_reloj: input.reloj,
    p_dow: input.dow,
    p_hora: input.hora,
    p_limit: 201,
  });
  if (error) fallar(error);
  const rows = ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    codigo: String(row.codigo ?? ""),
    productId: row.product_id ? String(row.product_id) : null,
    nombre: String(row.nombre ?? row.codigo ?? ""),
    unidades: num(row.unidades),
    venta: num(row.venta),
    tickets: num(row.n_ordenes),
  }));
  return { productos: rows.slice(0, 200), truncado: rows.length > 200 };
}

export type PayloadHorarios = {
  mapa: MapaHorario;
  turnos: TurnoCaja[];
  categorias: string[];
  frescura: FrescuraConsumo | null;
  periodo: ConsumoPeriodo;
  tienda: string;
  tiendas: string[];
  categoria: string;
  reloj: RelojId;
  miles: HallazgoHorarioVista | null;
  milesError: string | null;
};

export async function consultarHorarios(params: { get(name: string): string | null }, now = Date.now()): Promise<PayloadHorarios> {
  let tiendas = [TIENDA_DEFAULT];
  try {
    tiendas = await tiendasConsumo();
  } catch {
    tiendas = [TIENDA_DEFAULT];
  }
  const periodo = periodoDesdeParams(params, now);
  const tienda = tiendaPermitida(params.get("tienda"), tiendas, TIENDA_DEFAULT);
  const categoria = (params.get("categoria") ?? "").slice(0, 80);
  const reloj: RelojId = params.get("reloj") === "caja" ? "caja" : "real";
  const supabase = getSupabaseAdminClient();
  const comparar = Boolean(periodo.comparar && periodo.tramo && periodo.anterior);
  const [filas, filasComparadas, turnosRaw, categorias, frescura] = await Promise.all([
    filasHoras(tienda, periodo.desde, periodo.hasta, categoria, reloj),
    comparar && periodo.anterior ? filasHoras(tienda, periodo.anterior.desde, periodo.anterior.hasta, categoria, reloj) : Promise.resolve([] as FilaHora[]),
    supabase.rpc("consumo_turnos_periodo", {
      p_tienda: tienda,
      p_desde: periodo.desde,
      p_hasta: periodo.hasta,
      p_categoria: categoria || null,
      p_reloj: reloj,
    }),
    supabase.rpc("consumo_categorias", { p_tienda: tienda, p_desde: periodo.desde, p_hasta: periodo.hasta }),
    cargarFrescura(now, tienda).catch(() => null),
  ]);
  if (turnosRaw.error) fallar(turnosRaw.error);
  if (categorias.error) fallar(categorias.error);
  const porTurno = new Map<string, Record<string, unknown>>();
  for (const row of (turnosRaw.data ?? []) as Record<string, unknown>[]) porTurno.set(String(row.turno), row);
  const mapa = construirMapa({
    desde: periodo.desde,
    hasta: periodo.hasta,
    filas,
    filasComparadas,
    comparar,
    modo: periodo.comparacion,
    tramo: periodo.tramo,
    anterior: comparar ? periodo.anterior : null,
  });
  let miles: HallazgoHorarioVista | null = null;
  let milesError: string | null = null;
  try {
    const hallazgos = await supabase
      .from("miles_hallazgos")
      .select("id, titulo, tipo, resumen, periodo_desde, periodo_hasta, publicado_en, actualizado_en, visual, metricas, evidencia, estado, resolucion, recomendacion_estado, recomendacion, limitaciones, muestras, tienda")
      .eq("estado", "vigente")
      .eq("tienda", tienda)
      .order("publicado_en", { ascending: false })
      .limit(60);
    if (hallazgos.error) throw new Error(hallazgos.error.message);
    miles = elegirHallazgoHorario((hallazgos.data ?? []) as Record<string, unknown>[], { desde: periodo.desde, hasta: periodo.hasta });
  } catch (error) {
    milesError = error instanceof Error ? error.message : "No pudimos leer los hallazgos";
  }
  const nombres = ((categorias.data ?? []) as Record<string, unknown>[]).map((row) => String(row.categoria ?? "")).filter(Boolean);
  return {
    mapa,
    turnos: cerrarTurnos(["am", "pm"].map((turno) => mapTurno(turno as "am" | "pm", porTurno.get(turno)))),
    categorias: nombres.includes("Sin match") ? nombres : [...nombres, "Sin match"],
    frescura,
    periodo,
    tienda,
    tiendas,
    categoria,
    reloj,
    miles,
    milesError,
  };
}

export async function cargarAsociacion(periodo: ConsumoPeriodo, codigoA: string, codigoB: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc("consumo_canasta_par", {
    p_tienda: TIENDA_DEFAULT,
    p_desde: periodo.desde,
    p_hasta: periodo.hasta,
    p_a: codigoA,
    p_b: codigoB,
  });
  if (error) fallar(error);
  const row = Array.isArray(data) ? data[0] : null;
  return {
    elegibles: num(row?.elegibles),
    conA: num(row?.con_a),
    conB: num(row?.con_b),
    conAmbos: num(row?.con_ambos),
  };
}

export async function cargarCanasta(semana: string, cursor: string | null, limit = CONSUMO_PAGE_DEFAULT) {
  const supabase = getSupabaseAdminClient();
  const limite = parseLimit(String(limit));
  const decoded = decodeCursor(cursor, "lift");
  const partes = decoded?.id.split("\u0000") ?? [];
  const { data, error } = await supabase.rpc("consumo_canasta", {
    p_tienda: TIENDA_DEFAULT,
    p_semana: semana,
    p_limit: limite + 1,
    p_cursor_lift: decoded?.v ?? null,
    p_cursor_a: partes[0] || null,
    p_cursor_b: partes[1] || null,
  });
  if (error) {
    fallar(error);
  }
  const rows = ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    productoA: String(row.producto_a ?? ""),
    productoB: String(row.producto_b ?? ""),
    ordenesJuntas: num(row.n_ordenes_juntos),
    soporte: num(row.soporte),
    lift: numOrNull(row.lift),
    ordenesSemana: num(row.n_ordenes_semana),
  }));
  const page = rows.slice(0, limite);
  const last = page[page.length - 1];
  return {
    semana,
    rows: page,
    nextCursor: rows.length > limite && last
      ? encodeCursor({ n: 0, v: last.lift, id: `${last.productoA}\u0000${last.productoB}`, orden: "lift" })
      : null,
  };
}

export async function cargarSinMatch(periodo: ConsumoPeriodo, cursor: string | null, limit = CONSUMO_PAGE_DEFAULT) {
  const supabase = getSupabaseAdminClient();
  const limite = parseLimit(String(limit));
  const decoded = decodeCursor(cursor, "venta");
  const { data, error } = await supabase.rpc("consumo_sin_match", {
    p_tienda: TIENDA_DEFAULT,
    p_desde: periodo.desde,
    p_hasta: periodo.hasta,
    p_limit: limite + 1,
    p_cursor_venta: decoded?.v ?? null,
    p_cursor_codigo: decoded?.id ?? null,
  });
  if (error) {
    fallar(error);
  }
  const rows = ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    codigo: String(row.codigo_odoo ?? ""),
    nombre: String(row.nombre ?? ""),
    unidades: num(row.unidades),
    venta: num(row.venta),
    ultima: dia(row.ultima),
  }));
  const page = rows.slice(0, limite);
  const last = page[page.length - 1];
  return {
    rows: page,
    nextCursor: rows.length > limite && last ? encodeCursor({ n: 0, v: last.venta, id: last.codigo, orden: "venta" }) : null,
  };
}

export async function cargarSinCosto(desde: string, hasta: string, cursor: string | null, limit = CONSUMO_PAGE_DEFAULT) {
  const supabase = getSupabaseAdminClient();
  const limite = parseLimit(String(limit));
  const decoded = decodeCursor(cursor, "venta");
  const { data, error } = await supabase.rpc("consumo_sin_costo", {
    p_tienda: TIENDA_DEFAULT,
    p_desde: desde,
    p_hasta: hasta,
    p_limit: limite + 1,
    p_cursor_venta: decoded?.v ?? null,
    p_cursor_codigo: decoded?.id ?? null,
  });
  if (error) {
    fallar(error);
  }
  const rows = ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    codigo: String(row.codigo_odoo ?? ""),
    productId: String(row.product_id ?? ""),
    nombre: String(row.nombre ?? ""),
    marca: row.marca ? String(row.marca) : null,
    categoria: String(row.categoria ?? ""),
    unidades: num(row.unidades),
    venta: num(row.venta),
    ultima: dia(row.ultima),
  }));
  const page = rows.slice(0, limite);
  const last = page[page.length - 1];
  return {
    rows: page,
    nextCursor: rows.length > limite && last ? encodeCursor({ n: 0, v: last.venta, id: last.codigo, orden: "venta" }) : null,
  };
}

export async function cargarSinMovimiento(desde: string, hasta: string, cursor: string | null, limit = CONSUMO_PAGE_DEFAULT) {
  const supabase = getSupabaseAdminClient();
  const limite = parseLimit(String(limit));
  const decoded = decodeCursor(cursor, "movimiento");
  const [ultima, nombre, id] = (decoded?.id ?? "").split("\u0000");
  const { data, error } = await supabase.rpc("consumo_sin_movimiento", {
    p_tienda: TIENDA_DEFAULT,
    p_desde: desde,
    p_hasta: hasta,
    p_limit: limite + 1,
    p_cursor_ultima: ultima && isDayKey(ultima) ? ultima : null,
    p_cursor_nombre: nombre || null,
    p_cursor_id: id || null,
  });
  if (error) {
    fallar(error);
  }
  const rows = ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    productId: String(row.product_id ?? ""),
    codigo: row.codigo_odoo ? String(row.codigo_odoo) : null,
    nombre: String(row.nombre ?? ""),
    marca: row.marca ? String(row.marca) : null,
    categoria: row.categoria ? String(row.categoria) : null,
    ultima: row.ultima ? dia(row.ultima) : null,
  }));
  const page = rows.slice(0, limite);
  const last = page[page.length - 1];
  return {
    rows: page,
    nextCursor:
      rows.length > limite && last
        ? encodeCursor({
            n: last.ultima ? 0 : 1,
            v: null,
            id: `${last.ultima ?? ""}\u0000${last.nombre}\u0000${last.productId}`,
            orden: "movimiento",
          })
        : null,
  };
}

export async function cargarConciliacion(periodo: ConsumoPeriodo, cursor: string | null, limit = CONSUMO_PAGE_DEFAULT) {
  const supabase = getSupabaseAdminClient();
  const limite = parseLimit(String(limit));
  let query = supabase
    .from("pos_sesiones")
    .select("id, odoo_id, nombre, fecha_operativa, total_pagos, suma_ordenes, suma_pagos")
    .eq("tienda", TIENDA_DEFAULT)
    .eq("descuadrada", true)
    .gte("fecha_operativa", periodo.desde)
    .lte("fecha_operativa", periodo.hasta)
    .order("odoo_id", { ascending: false })
    .limit(limite + 1);
  if (cursor && Number.isInteger(Number(cursor))) {
    query = query.lt("odoo_id", Number(cursor));
  }
  const { data, error } = await query;
  if (error) {
    fallar(error);
  }
  const rows = (data ?? []).map((row) => ({
    id: String(row.id),
    odooId: num(row.odoo_id),
    nombre: String(row.nombre ?? ""),
    fecha: dia(row.fecha_operativa),
    totalPagos: num(row.total_pagos),
    sumaOrdenes: num(row.suma_ordenes),
    sumaPagos: num(row.suma_pagos),
  }));
  const page = rows.slice(0, limite);
  const last = page[page.length - 1];
  return {
    rows: page,
    nextCursor: rows.length > limite && last ? String(last.odooId) : null,
  };
}

export async function cargarTicket(periodo: ConsumoPeriodo) {
  const supabase = getSupabaseAdminClient();
  const [dias, turnos] = await Promise.all([
    paginar((from, to) =>
      supabase
        .from("resumen_dia")
        .select("fecha, n_ordenes, venta, ticket_promedio, unidades_por_ticket, unidades")
        .eq("tienda", TIENDA_DEFAULT)
        .gte("fecha", periodo.desde)
        .lte("fecha", periodo.hasta)
        .order("fecha", { ascending: true })
        .range(from, to),
    ),
    paginar((from, to) =>
      supabase
        .from("resumen_turno_dia")
        .select("fecha, turno, n_ordenes, venta, ticket_promedio, unidades_por_ticket")
        .eq("tienda", TIENDA_DEFAULT)
        .gte("fecha", periodo.desde)
        .lte("fecha", periodo.hasta)
        .order("fecha", { ascending: true })
        .range(from, to),
    ),
  ]);
  return {
    dias: dias.map((row) => mapDia(row)),
    turnos: turnos.map((row) => ({
      fecha: dia(row.fecha),
      turno: row.turno === "pm" ? "pm" : "am",
      ordenes: num(row.n_ordenes),
      venta: num(row.venta),
      ticket: numOrNull(row.ticket_promedio),
      unidadesPorTicket: numOrNull(row.unidades_por_ticket),
    })),
  };
}

export async function cargarTendencias(hasta: string) {
  const periodo = resolverPeriodo({ desde: addDaysToDayKey(hasta, -27), hasta, comparar: "1" });
  const [resumen, suben, caen] = await Promise.all([
    cargarResumen({ ...periodo, comparar: true }),
    cargarProductos({ periodo, orden: "variacion", categoria: "", q: "", cursor: null, limit: 10 }),
    cargarProductos({ periodo, orden: "variacion_asc" as OrdenConsumo, categoria: "", q: "", cursor: null, limit: 10 }),
  ]);
  const subenRows = suben.rows.filter((row) => (row.variacion ?? 0) > 0);
  const caenRows = caen.rows.filter((row) => (row.variacion ?? 0) < 0);
  return {
    semana: resumen.tendencias.semana,
    mes: resumen.tendencias.mes,
    suben: subenRows,
    caen: caenRows,
  };
}

export function rangoDeDias(dias: number, now = Date.now()) {
  const hasta = yesterdayDayKey(now);
  return { desde: addDaysToDayKey(hasta, -(dias - 1)), hasta };
}

export function paramsDe(input: Record<string, string | string[] | undefined>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string") {
      params.set(key, value);
    }
  }
  return params;
}

export function periodoDesdeParams(params: { get(name: string): string | null }, now = Date.now()): ConsumoPeriodo {
  return resolverPeriodo(
    {
      desde: params.get("desde"),
      hasta: params.get("hasta"),
      preset: params.get("preset"),
      comparar: params.get("comparar"),
      comparacion: params.get("comparacion"),
    },
    now,
  );
}

function mapResumenProductos(row: Record<string, unknown> | null): ResumenProductos {
  return {
    nProductos: num(row?.n_productos),
    unidades: num(row?.unidades),
    venta: num(row?.venta),
    ventaNeta: num(row?.venta_neta),
    ventaConCosto: num(row?.venta_con_costo),
    ventaNetaConCosto: num(row?.venta_neta_con_costo),
    costoVentas: numOrNull(row?.costo_ventas),
    margen: numOrNull(row?.margen),
    nSinCosto: num(row?.n_sin_costo),
    ventaComparable: numOrNull(row?.venta_comparable),
    ventaAnterior: numOrNull(row?.venta_anterior),
  };
}

export async function cargarResumenProductos(input: {
  tienda: string;
  periodo: ConsumoPeriodo;
  categoria: string;
  q: string;
  sinCosto: boolean;
}): Promise<ResumenProductos> {
  const supabase = getSupabaseAdminClient();
  const tramo = input.periodo.comparar ? input.periodo.tramo : null;
  const { data, error } = await supabase.rpc("consumo_productos_resumen", {
    p_tienda: input.tienda,
    p_desde: input.periodo.desde,
    p_hasta: input.periodo.hasta,
    p_desde_cmp: tramo?.desde ?? null,
    p_hasta_cmp: tramo?.hasta ?? null,
    p_desde_ant: input.periodo.comparar ? input.periodo.anterior.desde : null,
    p_hasta_ant: input.periodo.comparar ? input.periodo.anterior.hasta : null,
    p_categoria: input.categoria || null,
    p_q: input.q || null,
    p_sin_costo: input.sinCosto,
  });
  if (error) fallar(error);
  const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : null;
  return mapResumenProductos(row ?? null);
}

export async function cargarCategoriasConsumo(tienda: string, desde: string, hasta: string): Promise<string[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc("consumo_categorias", {
    p_tienda: tienda,
    p_desde: desde,
    p_hasta: hasta,
  });
  if (error) fallar(error);
  const nombres = ((data ?? []) as Array<{ categoria?: string }>).map((row) => String(row.categoria ?? "")).filter(Boolean);
  return nombres.includes("Sin match") ? nombres : [...nombres, "Sin match"];
}

export async function tiendasConsumo(): Promise<string[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc("consumo_tiendas");
  if (error) fallar(error);
  const tiendas = ((data ?? []) as Array<{ tienda?: string }>).map((row) => String(row.tienda ?? "")).filter(Boolean);
  return tiendas.length > 0 ? tiendas : [TIENDA_DEFAULT];
}

async function fechasResumen(tienda: string, desde: string, hasta: string): Promise<string[]> {
  const supabase = getSupabaseAdminClient();
  const rows = await paginar((from, to) =>
    supabase.from("resumen_dia").select("fecha").eq("tienda", tienda).gte("fecha", desde).lte("fecha", hasta).order("fecha", { ascending: true }).range(from, to),
  );
  return rows.map((row) => dia(row.fecha));
}

export async function estadoComparacionProductos(tienda: string, periodo: ConsumoPeriodo, ventaAnterior: number | null): Promise<EstadoComparacion> {
  if (periodo.comparacion === "off") return "off";
  if (!periodo.tramo || !periodo.comparar) return "no_disponible";
  const desde = periodo.anterior.desde < periodo.tramo.desde ? periodo.anterior.desde : periodo.tramo.desde;
  const hasta = periodo.tramo.hasta > periodo.anterior.hasta ? periodo.tramo.hasta : periodo.anterior.hasta;
  const fechas = await fechasResumen(tienda, desde, hasta);
  const tramo = coberturaDeFechas(fechas, periodo.tramo.desde, periodo.tramo.hasta);
  const anterior = coberturaDeFechas(fechas, periodo.anterior.desde, periodo.anterior.hasta);
  return estadoComparacion({
    pedida: true,
    coberturaCompleta: tramo.completa && anterior.completa,
    base: ventaAnterior,
  });
}

export type DetalleProducto = Awaited<ReturnType<typeof cargarProducto>>;

export type HoraDetalle = { hora: number; ordenes: number; venta: number; unidades: number; ocurrencias: number | null };

export type AsociadoProducto = {
  codigo: string;
  nombre: string;
  ticketsCompartidos: number;
  ticketsBase: number;
  ticketsElegibles: number;
  proporcion: number | null;
  lift: number | null;
  muestraPequena: boolean;
  limitacion: string | null;
};

export type VinculoMiles = {
  origen: "hallazgo" | "propuesta";
  id: string;
  titulo: string;
  tipo: string;
  resumen: string;
  periodoDesde: string | null;
  periodoHasta: string | null;
  estado: string;
  actualizadoEn: string | null;
};

function esUuid(value: string | null): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value));
}

function faltaFuncion(error: RpcError): boolean {
  return /does not exist|schema cache|Could not find the function|PGRST202|42P01/i.test(error?.message ?? "");
}

export async function cargarHorasProducto(
  codigo: string,
  periodo: ConsumoPeriodo,
  tienda: string,
  reloj: "real" | "caja",
): Promise<{ reloj: "real" | "caja"; distingueCero: boolean; filas: HoraDetalle[] }> {
  const supabase = getSupabaseAdminClient();
  const vista = await supabase.rpc("consumo_producto_horas_vista", {
    p_tienda: tienda,
    p_codigo: codigo,
    p_desde: periodo.desde,
    p_hasta: periodo.hasta,
    p_reloj: reloj,
  });
  if (!vista.error) {
    return {
      reloj,
      distingueCero: true,
      filas: ((vista.data ?? []) as Record<string, unknown>[]).map((row) => ({
        hora: num(row.hora),
        ordenes: num(row.n_ordenes),
        venta: num(row.venta),
        unidades: num(row.unidades),
        ocurrencias: num(row.ocurrencias),
      })),
    };
  }
  if (!faltaFuncion(vista.error)) fallar(vista.error);
  const legacy = await supabase.rpc("consumo_producto_horas", {
    p_tienda: tienda,
    p_codigo: codigo,
    p_desde: periodo.desde,
    p_hasta: periodo.hasta,
  });
  if (legacy.error) fallar(legacy.error);
  return {
    reloj: "caja",
    distingueCero: false,
    filas: ((legacy.data ?? []) as Record<string, unknown>[]).map((row) => ({
      hora: num(row.hora),
      ordenes: num(row.n_ordenes),
      venta: num(row.venta),
      unidades: num(row.unidades),
      ocurrencias: null,
    })),
  };
}

export async function cargarAsociadosProducto(
  codigo: string,
  periodo: ConsumoPeriodo,
  tienda: string,
): Promise<{ asociados: AsociadoProducto[]; nota: string | null }> {
  const supabase = getSupabaseAdminClient();
  const filtro = (columna: "producto_a" | "producto_b") =>
    supabase
      .from("resumen_canasta_semana")
      .select("producto_a, producto_b, n_ordenes_juntos")
      .eq("tienda", tienda)
      .eq(columna, codigo)
      .gte("semana", semanaDe(periodo.desde))
      .lte("semana", semanaDe(periodo.hasta))
      .limit(40);
  const [comoA, comoB] = await Promise.all([filtro("producto_a"), filtro("producto_b")]);
  if (comoA.error || comoB.error) return { asociados: [], nota: null };
  const juntos = new Map<string, number>();
  for (const row of [...(comoA.data ?? []), ...(comoB.data ?? [])]) {
    const otro = String(row.producto_a) === codigo ? String(row.producto_b ?? "") : String(row.producto_a ?? "");
    if (!otro || otro === codigo) continue;
    juntos.set(otro, (juntos.get(otro) ?? 0) + num(row.n_ordenes_juntos));
  }
  const top = Array.from(juntos.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5);
  if (top.length === 0) return { asociados: [], nota: null };
  const medidos = await Promise.all(
    top.map(async ([companero]) => {
      const { data, error } = await supabase.rpc("consumo_canasta_par", {
        p_tienda: tienda,
        p_desde: periodo.desde,
        p_hasta: periodo.hasta,
        p_a: codigo,
        p_b: companero,
      });
      if (error) return null;
      const row = Array.isArray(data) ? data[0] : null;
      const cuentas = {
        elegibles: num(row?.elegibles),
        conA: num(row?.con_a),
        conB: num(row?.con_b),
        conAmbos: num(row?.con_ambos),
      };
      const asociacion = asociacionCanasta(cuentas);
      if (cuentas.conAmbos <= 0) return null;
      return { codigo: companero, cuentas, asociacion };
    }),
  );
  const vigentes = medidos.filter((item): item is NonNullable<typeof item> => item != null);
  if (vigentes.length === 0) {
    return {
      asociados: [],
      nota: "La canasta semanal registra este producto junto a otros, pero en el periodo seleccionado no hay tickets compartidos.",
    };
  }
  const nombres = await supabase.from("products").select("codigo_odoo, nombre").in(
    "codigo_odoo",
    vigentes.map((item) => item.codigo),
  );
  const porCodigo = new Map(
    ((nombres.data ?? []) as Array<{ codigo_odoo?: string; nombre?: string }>).map((row) => [String(row.codigo_odoo ?? ""), String(row.nombre ?? "")]),
  );
  return {
    nota: "Pares de la canasta semanal que toca este periodo, contados otra vez en los tickets del periodo. Compartir ticket no significa que un descuento vaya a funcionar.",
    asociados: vigentes.map((item) => ({
      codigo: item.codigo,
      nombre: porCodigo.get(item.codigo) || item.codigo,
      ticketsCompartidos: item.cuentas.conAmbos,
      ticketsBase: item.cuentas.conA,
      ticketsElegibles: item.cuentas.elegibles,
      proporcion: item.asociacion.dadoA,
      lift: item.asociacion.fuerza,
      muestraPequena: item.asociacion.muestraPequena,
      limitacion: item.asociacion.limitacion,
    })),
  };
}

export async function cargarMilesProducto(codigo: string, productId: string | null, tienda: string): Promise<VinculoMiles[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc("miles_producto_vinculos", {
    p_tienda: tienda,
    p_codigo: codigo,
    p_product_id: esUuid(productId) ? productId : null,
  });
  if (error) return [];
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    origen: row.origen === "propuesta" ? ("propuesta" as const) : ("hallazgo" as const),
    id: String(row.id ?? ""),
    titulo: String(row.titulo ?? ""),
    tipo: String(row.tipo ?? ""),
    resumen: String(row.resumen ?? ""),
    periodoDesde: row.periodo_desde ? dia(row.periodo_desde) : null,
    periodoHasta: row.periodo_hasta ? dia(row.periodo_hasta) : null,
    estado: String(row.estado ?? ""),
    actualizadoEn: row.actualizado_en ? String(row.actualizado_en) : null,
  })).filter((item) => item.id && item.titulo);
}

export async function consultarProducto(codigo: string, params: { get(name: string): string | null }, now = Date.now()) {
  let tiendas = [TIENDA_DEFAULT];
  try {
    tiendas = await tiendasConsumo();
  } catch {
    tiendas = [TIENDA_DEFAULT];
  }
  const periodo = periodoDesdeParams(params, now);
  const tienda = tiendaPermitida(params.get("tienda"), tiendas, TIENDA_DEFAULT);
  const reloj = params.get("reloj") === "caja" ? "caja" : "real";
  const producto = await cargarProducto(codigo, periodo, tienda);
  const [frescura, comparacionEstado, horas, canasta, miles] = await Promise.all([
    cargarFrescura(now, tienda),
    estadoComparacionProductos(tienda, periodo, producto.ventaAnterior),
    cargarHorasProducto(codigo, periodo, tienda, reloj),
    cargarAsociadosProducto(codigo, periodo, tienda),
    cargarMilesProducto(codigo, producto.productId, tienda),
  ]);
  return { producto, periodo, tienda, tiendas, frescura, comparacionEstado, horas, asociados: canasta.asociados, canastaNota: canasta.nota, miles };
}

export async function cargarPaginaProductos(input: {
  periodo: ConsumoPeriodo;
  orden: OrdenConsumo;
  categoria: string;
  q: string;
  sinCosto: boolean;
  offset: number;
  limit: number;
  tienda: string;
  detalle: string | null;
}) {
  const [lista, resumen, categorias, frescura] = await Promise.all([
    cargarProductos({
      periodo: input.periodo,
      orden: input.orden,
      categoria: input.categoria,
      q: input.q,
      cursor: null,
      limit: input.limit,
      offset: input.offset,
      sinCosto: input.sinCosto,
      tienda: input.tienda,
      conAlcance: false,
    }),
    cargarResumenProductos(input),
    cargarCategoriasConsumo(input.tienda, input.periodo.desde, input.periodo.hasta),
    cargarFrescura(Date.now(), input.tienda),
  ]);
  const comparacionEstado = await estadoComparacionProductos(input.tienda, input.periodo, resumen.ventaAnterior);
  let detalle: DetalleProducto | null = null;
  let detalleError: string | null = null;
  if (input.detalle) {
    try {
      detalle = await cargarProducto(input.detalle, input.periodo, input.tienda);
    } catch (error) {
      detalleError = error instanceof Error ? error.message : "No pudimos cargar el producto";
    }
  }
  return {
    rows: lista.rows,
    resumen,
    categorias,
    frescura,
    comparacionEstado,
    detalle,
    detalleError,
    detalleCodigo: input.detalle,
    periodo: input.periodo,
    tienda: input.tienda,
  };
}

export async function consultarResumen(params: { get(name: string): string | null }, now = Date.now()) {
  let tiendas = [TIENDA_DEFAULT];
  try {
    tiendas = await tiendasConsumo();
  } catch {
    tiendas = [TIENDA_DEFAULT];
  }
  const periodo = periodoDesdeParams(params, now);
  const tienda = tiendaPermitida(params.get("tienda"), tiendas, TIENDA_DEFAULT);
  const detalleCodigo = (params.get("detalle") ?? "").trim().slice(0, 160) || null;
  const resumen = await cargarResumen(periodo, now, tienda);
  let detalle: Awaited<ReturnType<typeof cargarProducto>> | null = null;
  let detalleError: string | null = null;
  if (detalleCodigo) {
    try {
      detalle = await cargarProducto(detalleCodigo, periodo, tienda);
    } catch (error) {
      detalleError = error instanceof Error ? error.message : "No pudimos cargar el producto";
    }
  }
  let miles: Awaited<ReturnType<typeof destacadosMiles>> | null = null;
  try {
    miles = await destacadosMiles(periodo);
  } catch {
    miles = null;
  }
  return { resumen, miles, tiendas, tienda, detalle, detalleError, detalleCodigo };
}

export async function consultarProductos(params: { get(name: string): string | null }, now = Date.now()) {
  let tiendas = [TIENDA_DEFAULT];
  try {
    tiendas = await tiendasConsumo();
  } catch {
    tiendas = [TIENDA_DEFAULT];
  }
  const consulta = leerConsultaProductos(params, tiendas, now);
  const pagina = await cargarPaginaProductos({
    periodo: consulta.periodo,
    orden: consulta.orden,
    categoria: consulta.categoria,
    q: consulta.q,
    sinCosto: consulta.sinCosto,
    offset: consulta.offset,
    limit: consulta.limit,
    tienda: consulta.tienda,
    detalle: consulta.detalle,
  });
  return { ...pagina, tiendas };
}

export async function exportarProductos(params: { get(name: string): string | null }, now = Date.now()) {
  let tiendas = [TIENDA_DEFAULT];
  try {
    tiendas = await tiendasConsumo();
  } catch {
    tiendas = [TIENDA_DEFAULT];
  }
  const consulta = leerConsultaProductos(params, tiendas, now);
  const resumen = await cargarResumenProductos({
    tienda: consulta.tienda,
    periodo: consulta.periodo,
    categoria: consulta.categoria,
    q: consulta.q,
    sinCosto: consulta.sinCosto,
  });
  const estado = await estadoComparacionProductos(consulta.tienda, consulta.periodo, resumen.ventaAnterior);
  const rows: ProductoConsumo[] = [];
  const limite = 500;
  for (let offset = 0; offset < Math.min(resumen.nProductos, 20000); offset += limite) {
    const pagina = await cargarProductos({
      periodo: consulta.periodo,
      orden: consulta.orden,
      categoria: consulta.categoria,
      q: consulta.q,
      cursor: null,
      limit: limite,
      offset,
      sinCosto: consulta.sinCosto,
      tienda: consulta.tienda,
      conAlcance: false,
    });
    rows.push(...pagina.rows);
    if (pagina.rows.length < limite) break;
  }
  return { rows, resumen, estado, periodo: consulta.periodo, tienda: consulta.tienda };
}

export { parseDias, parseLimit, parseMetrica, parseOrden };
