import { addDaysToDayKey, isDayKey, yesterdayDayKey } from "@/lib/local-day";
import {
  CONSUMO_PAGE_DEFAULT,
  TIENDA_DEFAULT,
  decodeCursor,
  encodeCursor,
  lunesDe,
  margenConsumo,
  parseDias,
  parseLimit,
  parseMetrica,
  parseOrden,
  resolverPeriodo,
  type ConsumoPeriodo,
  type OrdenConsumo,
} from "@/lib/pos-domain";
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
};

export type ResumenConsumo = {
  periodo: ConsumoPeriodo;
  frescura: FrescuraConsumo;
  kpis: KpisConsumo;
  anterior: KpisConsumo | null;
  mix: MixPago;
  dias: DiaConsumo[];
  diasAnterior: DiaConsumo[];
  top: ProductoConsumo[];
  horas: Array<{ dow: number; hora: number; venta: number; ordenes: number; unidades: number }>;
  turnos: Array<{ turno: "am" | "pm"; venta: number; ordenes: number; ticket: number | null; unidadesPorTicket: number | null }>;
  calidad: { sinMatchProductos: number; sinMatchVenta: number; sinCostoProductos: number; sinCostoVenta: number; descuadradas: number };
  tendencias: {
    semana: { actual: number; anterior: number; desde: string; hasta: string };
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
  };
}

export async function cargarFrescura(now = Date.now()): Promise<FrescuraConsumo> {
  const supabase = getSupabaseAdminClient();
  const tienda = TIENDA_DEFAULT;
  const ayer = yesterdayDayKey(now);
  const desde = addDaysToDayKey(ayer, -29);
  const [ultima, ayerRow, calidad] = await Promise.all([
    supabase.from("pos_sesiones").select("fecha_operativa").eq("tienda", tienda).order("fecha_operativa", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("pos_sesiones").select("id").eq("tienda", tienda).eq("fecha_operativa", ayer).limit(1),
    supabase.rpc("consumo_calidad_conteos", { p_tienda: tienda, p_desde: desde, p_hasta: ayer }),
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
  const calidadRow = Array.isArray(calidad.data) ? calidad.data[0] : null;
  const ultimaFecha = ultima.data?.fecha_operativa ? dia(ultima.data.fecha_operativa) : null;
  const pendientes = num(calidadRow?.sin_match_productos) + num(calidadRow?.sin_costo_productos);
  return {
    ultimaFecha,
    faltaAyer: Boolean(ultimaFecha) && (ayerRow.data?.length ?? 0) === 0,
    pendientes,
  };
}

export async function cargarResumen(periodo: ConsumoPeriodo, now = Date.now()): Promise<ResumenConsumo> {
  const supabase = getSupabaseAdminClient();
  const tienda = TIENDA_DEFAULT;
  const lunes = lunesDe(periodo.hasta);
  const lunesPrevio = addDaysToDayKey(lunes, -7);
  const mesDesde = `${periodo.hasta.slice(0, 7)}-01`;
  const mesPrevioHasta = addDaysToDayKey(mesDesde, -1);
  const mesPrevioDesde = `${mesPrevioHasta.slice(0, 7)}-01`;
  const coberturaDesde = [periodo.desde, periodo.anterior.desde, lunesPrevio, mesPrevioDesde].sort()[0];

  const [diasTodos, margen, margenAnt, top, horas, calidad, turnos, categorias, frescura] = await Promise.all([
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
    supabase.rpc("consumo_horarios", {
      p_tienda: tienda,
      p_desde: periodo.desde,
      p_hasta: periodo.hasta,
      p_categoria: null,
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
    cargarFrescura(now),
  ]);

  if (top.error) fallar(top.error);
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

  return {
    periodo,
    frescura,
    kpis: kpisDe(dias, margen),
    anterior: periodo.comparar ? kpisDe(diasAnterior, margenAnt) : null,
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
    horas: ((horas.data ?? []) as Record<string, unknown>[]).map((row) => ({
      dow: num(row.dow),
      hora: num(row.hora),
      venta: num(row.venta),
      ordenes: num(row.n_ordenes),
      unidades: num(row.unidades),
    })),
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
        actual: suma(lunes, addDaysToDayKey(lunes, 6)),
        anterior: suma(lunesPrevio, addDaysToDayKey(lunesPrevio, 6)),
        desde: lunes,
        hasta: addDaysToDayKey(lunes, 6),
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
}) {
  const supabase = getSupabaseAdminClient();
  const limite = parseLimit(input.limit == null ? null : String(input.limit), CONSUMO_PAGE_DEFAULT);
  const cursor = decodeCursor(input.cursor, input.orden);
  const { data, error } = await supabase.rpc("consumo_top_productos", {
    p_tienda: TIENDA_DEFAULT,
    p_desde: input.periodo.desde,
    p_hasta: input.periodo.hasta,
    p_desde_ant: input.periodo.comparar ? input.periodo.anterior.desde : null,
    p_hasta_ant: input.periodo.comparar ? input.periodo.anterior.hasta : null,
    p_orden: input.orden,
    p_categoria: input.categoria || null,
    p_q: input.q || null,
    p_limit: limite + 1,
    p_cursor_null: cursor ? cursor.n : null,
    p_cursor_valor: cursor ? cursor.v : null,
    p_cursor_codigo: cursor ? cursor.id : null,
  });
  if (error) {
    fallar(error);
  }
  const rows = ((data ?? []) as Record<string, unknown>[]).map(mapProducto);
  const page = rows.slice(0, limite);
  const last = page[page.length - 1];
  const sortValor =
    input.orden === "unidades"
      ? last?.unidades
      : input.orden === "margen"
        ? last?.margen
        : input.orden === "variacion" || input.orden === "variacion_asc"
          ? last?.variacion
          : last?.venta;
  return {
    rows: page,
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

export async function cargarProducto(codigo: string, periodo: ConsumoPeriodo) {
  const supabase = getSupabaseAdminClient();
  const tienda = TIENDA_DEFAULT;
  const [dias, horas, producto] = await Promise.all([
    paginar((from, to) =>
      supabase
        .from("resumen_producto_dia")
        .select("fecha, unidades, venta, venta_neta, n_ordenes, nombre, product_id")
        .eq("tienda", tienda)
        .eq("codigo_odoo", codigo)
        .gte("fecha", periodo.desde)
        .lte("fecha", periodo.hasta)
        .order("fecha", { ascending: true })
        .range(from, to),
    ),
    supabase.rpc("consumo_producto_horas", {
      p_tienda: tienda,
      p_codigo: codigo,
      p_desde: periodo.desde,
      p_hasta: periodo.hasta,
    }),
    supabase.from("products").select("id, nombre, marca, categoria, codigo_odoo").eq("codigo_odoo", codigo).limit(1).maybeSingle(),
  ]);
  if (horas.error) fallar(horas.error);
  if (producto.error) fallar(producto.error);

  const productId = producto.data?.id ? String(producto.data.id) : dias.find((row) => row.product_id)?.product_id ?? null;
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
  const venta = serie.reduce((sum, row) => sum + row.venta, 0);
  const ventaNeta = dias.reduce((sum, row) => sum + num(row.venta_neta), 0);
  const unidades = serie.reduce((sum, row) => sum + row.unidades, 0);
  const costoUnit = numOrNull(costo.data?.costo_unit);
  const nombreResumen = dias.find((row) => row.nombre)?.nombre;
  return {
    codigo,
    productId: productId ? String(productId) : null,
    nombre: String(producto.data?.nombre ?? nombreResumen ?? codigo),
    marca: producto.data?.marca ? String(producto.data.marca) : null,
    categoria: producto.data ? String(producto.data.categoria ?? "Sin categoría") : "Sin match",
    matchEstado: producto.data ? ("match" as const) : ("sin_match" as const),
    venta: Math.round(venta * 100) / 100,
    unidades,
    ordenes: serie.reduce((sum, row) => sum + row.ordenes, 0),
    precioRealizado: unidades !== 0 ? Math.round((venta / unidades) * 100) / 100 : null,
    costo: costoUnit,
    costoOrigen: costo.data?.origen ? String(costo.data.origen) : null,
    costoFecha: costo.data?.fecha ? dia(costo.data.fecha) : null,
    costoRef: costo.data?.ref ? String(costo.data.ref) : null,
    margen: costoUnit == null ? null : Math.round((ventaNeta - unidades * costoUnit) * 100) / 100,
    serie,
    horas: ((horas.data ?? []) as Record<string, unknown>[]).map((row) => ({
      hora: num(row.hora),
      ordenes: num(row.n_ordenes),
      venta: num(row.venta),
      unidades: num(row.unidades),
    })),
  };
}

export async function cargarHorarios(periodo: ConsumoPeriodo, categoria: string) {
  const supabase = getSupabaseAdminClient();
  const [horas, turnos, categorias] = await Promise.all([
    supabase.rpc("consumo_horarios", {
      p_tienda: TIENDA_DEFAULT,
      p_desde: periodo.desde,
      p_hasta: periodo.hasta,
      p_categoria: categoria || null,
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
  const celdas = ((horas.data ?? []) as Record<string, unknown>[]).map((row) => ({
    dow: num(row.dow),
    hora: num(row.hora),
    venta: num(row.venta),
    ordenes: num(row.n_ordenes),
    unidades: num(row.unidades),
  }));
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
    },
    now,
  );
}

export { parseDias, parseLimit, parseMetrica, parseOrden };
