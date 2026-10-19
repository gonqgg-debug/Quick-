import { addDaysToDayKey, isDayKey, yesterdayDayKey } from "@/lib/local-day";
import { metricaAsociacion } from "@/lib/miles-casos";
import { cargarAsociacion, cargarCanasta } from "@/lib/pos-consumo";
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

export async function cargarComplementarios(input: { semana: string | null; par: string | null }) {
  const ayer = yesterdayDayKey();
  const pedida = input.semana && isDayKey(input.semana) ? lunesDe(input.semana) : lunesDe(ayer);
  const domingo = addDaysToDayKey(pedida, 6);
  const hastaDetalle = domingo > ayer ? ayer : domingo;
  const lista = await cargarCanasta(pedida, null, 40);
  let aviso: string | null = null;
  let semana = pedida;
  let rows = lista.rows;
  if (rows.length === 0) {
    const previa = addDaysToDayKey(pedida, -7);
    const otra = await cargarCanasta(previa, null, 40);
    if (otra.rows.length > 0) {
      rows = otra.rows;
      semana = previa;
      aviso = `La semana del ${pedida} no tiene pares con al menos 5 tickets. Esta lista es de la semana anterior.`;
    }
  }
  const codigos = Array.from(new Set(rows.flatMap((row) => [row.productoA, row.productoB])));
  const nombres = await nombresDe(codigos);
  const previos = await semanaPrevia(semana);
  const pares: ParCanasta[] = rows.map((row) => {
    const clave = `${row.productoA}|${row.productoB}`;
    const juntosPrevios = previos.has(clave) ? previos.get(clave) ?? null : null;
    return {
      ...row,
      nombreA: nombres.get(row.productoA)?.nombre ?? row.productoA,
      nombreB: nombres.get(row.productoB)?.nombre ?? row.productoB,
      fotoA: nombres.get(row.productoA)?.foto ?? null,
      fotoB: nombres.get(row.productoB)?.foto ?? null,
      juntosPrevios,
      deltaJuntos: juntosPrevios == null ? null : row.ordenesJuntas - juntosPrevios,
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
    const desde = semana;
    const hasta = addDaysToDayKey(semana, 6) > ayer && semana === pedida ? hastaDetalle : addDaysToDayKey(semana, 6);
    const conteos = await cargarAsociacion(resolverPeriodo({ desde, hasta, preset: "custom", comparacion: "off" }), elegido.productoA, elegido.productoB);
    const metrica = metricaAsociacion(conteos);
    const serie = await seriePar(elegido.productoA, elegido.productoB);
    detalle = { conteos, metrica, serie, desde, hasta, parcial: hasta < addDaysToDayKey(semana, 6) };
  }
  return {
    semanaPedida: pedida,
    semana,
    hasta: addDaysToDayKey(semana, 6),
    aviso,
    pares,
    elegido,
    detalle,
    umbral: "El listado reutiliza la canasta semanal: un ticket cuenta una vez por producto y el par entra con al menos 5 tickets juntos. No se arman grupos de tres productos a partir de estos pares.",
  };
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

async function semanaPrevia(semana: string): Promise<Map<string, number>> {
  const mapa = new Map<string, number>();
  const previa = addDaysToDayKey(semana, -7);
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("resumen_canasta_semana")
    .select("producto_a, producto_b, n_ordenes_juntos")
    .eq("tienda", "quick")
    .eq("semana", previa)
    .limit(500);
  if (error) return mapa;
  for (const row of data ?? []) {
    mapa.set(`${row.producto_a}|${row.producto_b}`, Number(row.n_ordenes_juntos ?? 0));
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
