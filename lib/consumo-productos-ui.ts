import { coberturaMonetaria, codigoVisible, diasInclusivos, type EstadoComparacion } from "@/lib/consumo-metricas";
import { formatDayKey } from "@/lib/local-day";
import { buscarSeguro, formatPct, formatRd, parseLimit, parseOrden, resolverPeriodo, TIENDA_DEFAULT, type ConsumoPeriodo, type OrdenConsumo } from "@/lib/pos-domain";

export type VistaTabla = "ventas" | "rentabilidad";

export type ColumnaExtra = "categoria" | "marca" | "sku" | "costoUnitario" | "fuenteCosto" | "estadoCosto";

export const COLUMNAS_EXTRA: Array<{ id: ColumnaExtra; label: string }> = [
  { id: "categoria", label: "Categoría" },
  { id: "marca", label: "Marca" },
  { id: "sku", label: "SKU" },
  { id: "costoUnitario", label: "Costo unitario de referencia" },
  { id: "fuenteCosto", label: "Fuente y fecha del costo" },
  { id: "estadoCosto", label: "Estado del costo" },
];

export const PRESETS_ANALITICA = [
  { id: "7c", label: "Últimos 7 días completos" },
  { id: "30c", label: "Últimos 30 días completos" },
  { id: "mes", label: "Este mes" },
  { id: "mes_anterior", label: "Mes anterior" },
  { id: "custom", label: "Personalizado" },
] as const;

export const PRESETS_LEGACY: Record<string, string> = {
  "7d": "7 días, incluye hoy",
  "30d": "30 días, incluye hoy",
};

export const COMPARACIONES = [
  { id: "anterior", label: "Periodo anterior" },
  { id: "semana", label: "Mismos días de la semana" },
  { id: "anio", label: "Año anterior" },
  { id: "off", label: "Sin comparación" },
] as const;

export const LIMITES_PAGINA = [25, 50, 100] as const;

export const NOTA_RENTABILIDAD =
  "Las ventas incluyen ITBIS. La utilidad bruta usa la venta neta y solo las ventas con costo de referencia; no es el costo histórico de cada venta.";

export const DEFINICION_PARTICIPACION =
  "Venta del producto con ITBIS dividida entre la venta con ITBIS del conjunto filtrado, antes de paginar. No es la participación de la página ni de la venta sin ITBIS.";

export const DEFINICION_VARIACION =
  "Cambio de la venta con ITBIS frente al periodo comparado. Nuevo: no hay venta anterior. Sin base: la venta anterior es cero. No se calcula un porcentaje en esos casos.";

export const DEFINICION_COSTO =
  "El costo es el manual del producto si existe; si no, el de la última factura de compra. No es el costo del día de la venta. Aplicarlo a ventas anteriores es una estimación. Un producto sin costo no entra como cero.";

const ASC = new Set([
  "venta_asc",
  "unidades_asc",
  "margen_asc",
  "margen_pct_asc",
  "variacion_asc",
  "venta_neta_asc",
  "costo_ventas_asc",
]);

export function parseVista(raw: string | null): VistaTabla {
  return raw === "rentabilidad" ? "rentabilidad" : "ventas";
}

export function parsePagina(raw: string | null): number {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) return 1;
  return Math.min(parsed, 10000);
}

export function parseSinCosto(raw: string | null): boolean {
  return raw === "1" || raw === "true";
}

export function ordenEsAsc(orden: string): boolean {
  return ASC.has(orden);
}

export function ordenBase(orden: string): string {
  return orden.endsWith("_asc") ? orden.slice(0, -4) : orden;
}

export function ordenSiguiente(actual: string, columna: string): string {
  if (ordenBase(actual) !== columna) return columna;
  return ordenEsAsc(actual) ? columna : `${columna}_asc`;
}

export function etiquetaTienda(tienda: string): string {
  const id = tienda.trim().toLowerCase();
  if (id === "quick") return "Quick!";
  if (id === "pharmaquick") return "PharmaQuick!";
  return tienda;
}

export type EstadoCosto = "sin_costo" | "estimado" | "disponible";

export function estadoCosto(origen: string | null, costo: number | null): EstadoCosto {
  if (costo == null || !Number.isFinite(costo)) return "sin_costo";
  if (origen === "manual") return "disponible";
  return "estimado";
}

export function etiquetaEstadoCosto(estado: EstadoCosto): string {
  if (estado === "sin_costo") return "Sin costo";
  if (estado === "disponible") return "Disponible";
  return "Estimado";
}

export function detalleEstadoCosto(estado: EstadoCosto): string {
  if (estado === "sin_costo") return "No hay costo manual ni factura. No se usa cero.";
  if (estado === "disponible") return "Costo manual vigente. No es el costo del día de la venta.";
  return "Última factura de compra, usada como referencia. No es el costo histórico de cada venta.";
}

export function textoFuenteCosto(origen: string | null, fecha: string | null, ref: string | null): string | null {
  if (!origen && !fecha) return null;
  const origenTexto = origen === "manual" ? "Manual" : origen === "factura" ? "Última factura" : origen;
  const fechaTexto = fecha ? formatDayKey(fecha) : null;
  const refTexto = ref && ref.length <= 40 && !/^[0-9a-f-]{32,}$/i.test(ref) ? ref : null;
  const partes = [origenTexto, refTexto, fechaTexto].filter(Boolean);
  return partes.length > 0 ? partes.join(" · ") : null;
}

export function subtituloProducto(input: { nombre: string; marca: string | null; codigo: string }): string | null {
  const nombre = input.nombre.toLowerCase();
  const partes: string[] = [];
  if (input.marca && !nombre.includes(input.marca.trim().toLowerCase())) {
    partes.push(input.marca);
  }
  const sku = codigoVisible(input.codigo);
  if (sku && !nombre.includes(sku.toLowerCase())) {
    partes.push(sku);
  }
  return partes.length > 0 ? partes.join(" · ") : null;
}

export function margenAgregado(margen: number | null, ventaNetaConCosto: number | null): number | null {
  if (margen == null || ventaNetaConCosto == null || !(ventaNetaConCosto > 0) || !Number.isFinite(margen)) {
    return null;
  }
  return margen / ventaNetaConCosto;
}

export function coberturaCostos(ventaConCosto: number | null, venta: number | null): number | null {
  if (ventaConCosto == null || venta == null) return null;
  return coberturaMonetaria(ventaConCosto, venta);
}

export type TextoVariacion = { texto: string; tono: "sube" | "baja" | "igual" | "neutro" };

export function variacionAgregada(
  estado: EstadoComparacion,
  actual: number | null,
  anterior: number | null,
): TextoVariacion | null {
  if (estado === "off") return null;
  if (estado === "no_disponible") return { texto: "Comparación no disponible", tono: "neutro" };
  if (estado === "sin_base" || anterior == null || anterior === 0 || actual == null || !Number.isFinite(actual) || !Number.isFinite(anterior)) {
    return { texto: "Sin base", tono: "neutro" };
  }
  const pct = (actual - anterior) / Math.abs(anterior);
  if (!Number.isFinite(pct)) return { texto: "Sin base", tono: "neutro" };
  if (Math.abs(pct) < 0.0005) return { texto: "0,0% ventas", tono: "igual" };
  return { texto: `${formatPct(pct)} ventas`, tono: pct > 0 ? "sube" : "baja" };
}

export function variacionProducto(
  estado: EstadoComparacion,
  variacion: number | null,
  ventaAnterior: number | null,
): TextoVariacion | null {
  if (estado === "off") return null;
  if (estado === "no_disponible") return { texto: "Comparación no disponible", tono: "neutro" };
  if (ventaAnterior == null) return { texto: "Nuevo", tono: "neutro" };
  if (ventaAnterior === 0 || variacion == null || !Number.isFinite(variacion)) return { texto: "Sin base", tono: "neutro" };
  if (Math.abs(variacion) < 0.0005) return { texto: "0,0% ventas", tono: "igual" };
  return { texto: `${formatPct(variacion)} ventas`, tono: variacion > 0 ? "sube" : "baja" };
}

export function describirPeriodo(periodo: ConsumoPeriodo): {
  rango: string;
  dias: number;
  comparado: string | null;
  diasComparados: number | null;
  diasCompletos: number | null;
  aviso: string | null;
} {
  const dias = Math.max(0, diasInclusivos(periodo.desde, periodo.hasta));
  const rango = `${formatDayKey(periodo.desde)} – ${formatDayKey(periodo.hasta)}`;
  if (periodo.comparacion === "off") {
    return { rango, dias, comparado: null, diasComparados: null, diasCompletos: null, aviso: null };
  }
  if (!periodo.tramo || !periodo.comparar) {
    return {
      rango,
      dias,
      comparado: null,
      diasComparados: null,
      diasCompletos: null,
      aviso: "Este periodo todavía no tiene un día completo. La comparación espera a que cierre el día.",
    };
  }
  const diasTramo = diasInclusivos(periodo.tramo.desde, periodo.tramo.hasta);
  const diasAnt = diasInclusivos(periodo.anterior.desde, periodo.anterior.hasta);
  const recortado = periodo.tramo.desde !== periodo.desde || periodo.tramo.hasta !== periodo.hasta;
  return {
    rango,
    dias,
    comparado: `${formatDayKey(periodo.anterior.desde)} – ${formatDayKey(periodo.anterior.hasta)}`,
    diasComparados: diasAnt,
    diasCompletos: diasTramo,
    aviso: recortado
      ? `La comparación usa los días completos ${formatDayKey(periodo.tramo.desde)} – ${formatDayKey(periodo.tramo.hasta)} (${diasTramo} ${diasTramo === 1 ? "día" : "días"}). El día en curso queda fuera.`
      : null,
  };
}

export function formatPctPlano(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return formatPct(value).replace(/^\+/, "");
}

export function dinero(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return formatRd(value);
}

export function columnasGuardadas(raw: string | null): ColumnaExtra[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const validas = new Set(COLUMNAS_EXTRA.map((columna) => columna.id));
    return parsed.filter((item): item is ColumnaExtra => typeof item === "string" && validas.has(item as ColumnaExtra));
  } catch {
    return null;
  }
}

export function tiendaPermitida(pedida: string | null, tiendas: string[], fallback: string): string {
  if (pedida && tiendas.includes(pedida)) return pedida;
  if (tiendas.length === 1) return tiendas[0];
  return fallback;
}

export type ConsultaProductos = {
  periodo: ConsumoPeriodo;
  orden: OrdenConsumo;
  categoria: string;
  q: string;
  sinCosto: boolean;
  pagina: number;
  limit: number;
  offset: number;
  tienda: string;
  detalle: string | null;
  vista: VistaTabla;
};

export function leerConsultaProductos(
  params: { get(name: string): string | null },
  tiendas: string[],
  now = Date.now(),
): ConsultaProductos {
  const periodo = resolverPeriodo(
    {
      desde: params.get("desde"),
      hasta: params.get("hasta"),
      preset: params.get("preset"),
      comparar: params.get("comparar"),
      comparacion: params.get("comparacion"),
    },
    now,
  );
  const limit = parseLimit(params.get("limit"));
  const pagina = parsePagina(params.get("pagina"));
  const detalle = (params.get("detalle") ?? "").trim().slice(0, 160);
  return {
    periodo,
    orden: parseOrden(params.get("orden")),
    categoria: (params.get("categoria") ?? "").slice(0, 80),
    q: buscarSeguro(params.get("q")),
    sinCosto: parseSinCosto(params.get("sin_costo")),
    pagina,
    limit,
    offset: (pagina - 1) * limit,
    tienda: tiendaPermitida(params.get("tienda"), tiendas, TIENDA_DEFAULT),
    detalle: detalle || null,
    vista: parseVista(params.get("vista")),
  };
}

export function claveLista(consulta: string): string {
  const params = new URLSearchParams(consulta);
  params.delete("detalle");
  return params.toString();
}

export function consultaExportacion(consulta: string): string {
  const params = new URLSearchParams(consulta);
  params.delete("detalle");
  params.delete("pagina");
  params.delete("cursor");
  return params.toString();
}
