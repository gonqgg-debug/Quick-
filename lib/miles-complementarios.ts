import { afirmarPeriodoCanasta, CANASTA_PERIODO_MAX_DIAS } from "@/lib/canasta-periodo";
import { addDaysToDayKey, diffDayKeys, isDayKey, yesterdayDayKey } from "@/lib/local-day";
import { metricaAsociacion } from "@/lib/miles-casos";
import { cargarAsociacion, cargarCanastaPeriodo } from "@/lib/pos-consumo";
import { lunesDe, resolverPeriodo } from "@/lib/pos-domain";
import { getSupabaseAdminClient } from "@/lib/supabase";

export type ParCanasta = {
  productoA: string;
  productoB: string;
  nombreA: string;
  nombreB: string;
  fotoA: string | null;
  fotoB: string | null;
  ordenesJuntas: number;
  soporte: number;
  lift: number | null;
  ordenesSemana: number;
  juntosPrevios: number | null;
  deltaJuntos: number | null;
};

export type PuntoSerie = { semana: string; juntos: number; soporte: number; lift: number | null; elegibles: number };

export async function cargarComplementarios(input: { desde: string | null; hasta: string | null; semana: string | null; par: string | null }) {
  const ayer = yesterdayDayKey();
  const ventana = ventanaPedida(input, ayer);
  const lista = await cargarCanastaPeriodo({ desde: ventana.desde, hasta: ventana.hasta, minJuntos: 5, limit: 500, cursor: null, categoria: null });
  const largo = diffDayKeys(ventana.desde, ventana.hasta);
  const previoHasta = addDaysToDayKey(ventana.desde, -1);
  const previoDesde = addDaysToDayKey(previoHasta, -largo);
  const previa = await cargarCanastaPeriodo({ desde: previoDesde, hasta: previoHasta, minJuntos: 5, limit: 500, cursor: null, categoria: null }).catch(() => null);
  const previos = new Map((previa?.rows ?? []).map((row) => [`${row.codigoA}|${row.codigoB}`, row.nAB]));
  const codigos = Array.from(new Set(lista.rows.flatMap((row) => [row.codigoA, row.codigoB])));
  const nombres = await nombresDe(codigos);
  const pares: ParCanasta[] = lista.rows.map((row) => {
    const clave = `${row.codigoA}|${row.codigoB}`;
    const metrica = metricaAsociacion({ elegibles: row.n, conA: row.nA, conB: row.nB, conAmbos: row.nAB }).metrica;
    const juntosPrevios = previos.has(clave) ? previos.get(clave) ?? null : null;
    return {
      productoA: row.codigoA,
      productoB: row.codigoB,
      nombreA: nombres.get(row.codigoA)?.nombre ?? row.nombreA ?? row.codigoA,
      nombreB: nombres.get(row.codigoB)?.nombre ?? row.nombreB ?? row.codigoB,
      fotoA: nombres.get(row.codigoA)?.foto ?? null,
      fotoB: nombres.get(row.codigoB)?.foto ?? null,
      ordenesJuntas: row.nAB,
      soporte: metrica?.soporte ?? 0,
      lift: metrica?.afinidad ?? null,
      ordenesSemana: row.n,
      juntosPrevios,
      deltaJuntos: juntosPrevios == null ? null : row.nAB - juntosPrevios,
    };
  });
  const elegido = elegirPar(input.par, pares);
  let detalle: {
    conteos: { elegibles: number; conA: number; conB: number; conAmbos: number };
    metrica: ReturnType<typeof metricaAsociacion>;
    serie: PuntoSerie[];
    desde: string;
    hasta: string;
    parcial: boolean;
  } | null = null;
  if (elegido) {
    const conteos = await cargarAsociacion(resolverPeriodo({ desde: ventana.desde, hasta: ventana.hasta, preset: "custom", comparacion: "off" }), elegido.productoA, elegido.productoB);
    detalle = {
      conteos,
      metrica: metricaAsociacion(conteos),
      serie: await seriePar(elegido.productoA, elegido.productoB),
      desde: ventana.desde,
      hasta: ventana.hasta,
      parcial: ventana.parcial,
    };
  }
  const avisoRecorte = lista.pares > lista.rows.length ? ` Hay ${lista.pares} pares con al menos 5 tickets juntos. Aquí están los ${lista.rows.length} de mayor volumen.` : "";
  return {
    desde: ventana.desde,
    hasta: ventana.hasta,
    aviso: `${ventana.aviso ?? ""}${avisoRecorte}`.trim() || null,
    pares,
    paresTotal: lista.pares,
    elegido,
    detalle,
    umbral: `Del ${ventana.desde} al ${ventana.hasta}: ${lista.elegibles} tickets elegibles y ${lista.pares} pares con al menos 5 tickets juntos. Un producto cuenta una vez por ticket. No se eligen categorías ni se arman grupos de tres.`,
  };
}

function ventanaPedida(input: { desde: string | null; hasta: string | null; semana: string | null }, ayer: string): { desde: string; hasta: string; aviso: string | null; parcial: boolean } {
  let desde = addDaysToDayKey(ayer, -29);
  let hasta = ayer;
  let aviso: string | null = null;
  if (input.desde && isDayKey(input.desde)) desde = input.desde;
  if (input.hasta && isDayKey(input.hasta)) hasta = input.hasta;
  if (!(input.desde && isDayKey(input.desde)) && !(input.hasta && isDayKey(input.hasta)) && input.semana && isDayKey(input.semana)) {
    desde = lunesDe(input.semana);
    hasta = addDaysToDayKey(desde, 6);
  }
  if (hasta > ayer) hasta = ayer;
  if (desde > hasta) desde = hasta;
  if (diffDayKeys(desde, hasta) > CANASTA_PERIODO_MAX_DIAS - 1) {
    desde = addDaysToDayKey(hasta, -(CANASTA_PERIODO_MAX_DIAS - 1));
    aviso = `El periodo se recortó a ${CANASTA_PERIODO_MAX_DIAS} días.`;
  }
  afirmarPeriodoCanasta(desde, hasta);
  return { desde, hasta, aviso, parcial: Boolean(input.hasta && isDayKey(input.hasta) && input.hasta > ayer) };
}

function elegirPar(par: string | null, pares: ParCanasta[]): ParCanasta | null {
  if (par) {
    const [a, b] = par.split("|");
    if (a && b) {
      const [x, y] = a < b ? [a, b] : [b, a];
      const hallado = pares.find((row) => row.productoA === x && row.productoB === y);
      if (hallado) return hallado;
    }
  }
  return pares[0] ?? null;
}

async function nombresDe(codigos: string[]) {
  const mapa = new Map<string, { nombre: string; foto: string | null }>();
  if (codigos.length === 0) return mapa;
  const supabase = getSupabaseAdminClient();
  const { data } = await supabase.from("products").select("codigo_odoo, nombre, foto_url").in("codigo_odoo", codigos);
  for (const row of data ?? []) {
    mapa.set(String(row.codigo_odoo), { nombre: String(row.nombre ?? row.codigo_odoo), foto: row.foto_url ? String(row.foto_url) : null });
  }
  return mapa;
}

async function seriePar(a: string, b: string): Promise<PuntoSerie[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("resumen_canasta_semana")
    .select("semana, n_ordenes_juntos, soporte, lift, n_ordenes_semana")
    .eq("tienda", "quick")
    .eq("producto_a", a)
    .eq("producto_b", b)
    .order("semana", { ascending: true })
    .limit(16);
  if (error) return [];
  return (data ?? []).map((row) => ({
    semana: String(row.semana).slice(0, 10),
    juntos: Number(row.n_ordenes_juntos ?? 0),
    soporte: Number(row.soporte ?? 0),
    lift: row.lift == null ? null : Number(row.lift),
    elegibles: Number(row.n_ordenes_semana ?? 0),
  }));
}
