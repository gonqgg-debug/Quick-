import {
  codigoVisible,
  diasInclusivos,
  fechasEsperadas,
  type ModoComparacion,
} from "@/lib/consumo-metricas";
import { fechaComparadaDe, granularidadDe, type Granularidad } from "@/lib/consumo-resumen-ui";
import { formatPct, lunesDe } from "@/lib/pos-domain";

export type MetricaSerie = "ventas" | "unidades" | "precio";

export type DiaProducto = { fecha: string; venta: number; unidades: number };

export type PuntoProducto = {
  id: string;
  etiqueta: string;
  desde: string;
  hasta: string;
  venta: number | null;
  unidades: number | null;
  precio: number | null;
  fechaComparadaDesde: string | null;
  fechaComparadaHasta: string | null;
  ventaComparada: number | null;
  unidadesComparadas: number | null;
  precioComparado: number | null;
  incompleta: boolean;
  comparacionParcial: boolean;
};

export type HoraProducto = {
  hora: number;
  venta: number | null;
  unidades: number | null;
  ordenes: number | null;
  ocurrencias: number;
  estado: "con_ventas" | "abierto_sin_ventas" | "sin_datos";
};

export type TextoVariacionDetalle = { texto: string; tono: "sube" | "baja" | "igual" | "neutro" };

/** Importe con ITBIS dividido entre unidades netas. Cero unidades no produce precio. */
export function precioMedio(venta: number, unidades: number): number | null {
  if (!Number.isFinite(venta) || !Number.isFinite(unidades) || unidades === 0) return null;
  return Math.round((venta / unidades) * 100) / 100;
}

export function identificadoresProducto(codigo: string): { sku: string | null; externo: string } {
  return { sku: codigoVisible(codigo), externo: codigo };
}

/** El nombre visible no sustituye un identificador externo de Odoo por un SKU. */
export function nombreProducto(nombre: string | null | undefined, codigo: string): string {
  const texto = (nombre ?? "").trim();
  if (!texto || texto === codigo || texto.startsWith("__export__.")) return "Producto sin nombre";
  return texto;
}

/** Categoría y presentación solo cuando existen. Los marcadores internos no son categorías. */
export function lineaProducto(categoria: string | null | undefined, presentacion: string | null | undefined): string | null {
  const categoriaReal = categoria && categoria !== "Sin categoría" && categoria !== "Sin match" ? categoria.trim() : "";
  const presentacionReal = presentacion?.trim() ?? "";
  const texto = [categoriaReal, presentacionReal].filter(Boolean).join(" · ");
  return texto || null;
}

export function variacionDetalle(actual: number | null, anterior: number | null, comparar: boolean): TextoVariacionDetalle {
  if (!comparar || actual == null || anterior == null || !Number.isFinite(actual) || !Number.isFinite(anterior)) {
    return { texto: "Sin comparación", tono: "neutro" };
  }
  if (anterior === 0) {
    return actual === 0 ? { texto: "0,0%", tono: "igual" } : { texto: "Sin base porcentual", tono: "neutro" };
  }
  const pct = (actual - anterior) / Math.abs(anterior);
  if (!Number.isFinite(pct)) return { texto: "Sin base porcentual", tono: "neutro" };
  if (Math.abs(pct) < 0.0005) return { texto: "0,0%", tono: "igual" };
  return { texto: formatPct(pct), tono: pct > 0 ? "sube" : "baja" };
}

/** Un día cubierto sin fila del producto es cero. Un día sin cobertura no entra en la suma. */
export function acumularProducto(
  fechas: string[],
  porFecha: Map<string, DiaProducto>,
  cobertura: Set<string>,
): { venta: number | null; unidades: number | null; precio: number | null; cubiertos: number; faltan: number } {
  let cubiertos = 0;
  let faltan = 0;
  let venta = 0;
  let unidades = 0;
  for (const fecha of fechas) {
    const fila = porFecha.get(fecha);
    if (!cobertura.has(fecha) && fila == null) {
      faltan += 1;
      continue;
    }
    cubiertos += 1;
    venta += fila?.venta ?? 0;
    unidades += fila?.unidades ?? 0;
  }
  if (cubiertos === 0) return { venta: null, unidades: null, precio: null, cubiertos, faltan };
  const ventaR = Math.round(venta * 100) / 100;
  const unidadesR = Math.round(unidades * 1000) / 1000;
  return { venta: ventaR, unidades: unidadesR, precio: precioMedio(ventaR, unidadesR), cubiertos, faltan };
}

function etiquetaCorta(fecha: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (!match) return fecha;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat("es-DO", { timeZone: "UTC", day: "numeric", month: "short" }).format(date);
}

function etiquetaRango(desde: string, hasta: string): string {
  if (desde === hasta) return etiquetaCorta(desde);
  if (desde.slice(0, 7) === hasta.slice(0, 7)) return `${Number(desde.slice(8))}–${etiquetaCorta(hasta)}`;
  return `${etiquetaCorta(desde)} – ${etiquetaCorta(hasta)}`;
}

function etiquetaMes(fecha: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha);
  if (!match) return fecha;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat("es-DO", { timeZone: "UTC", month: "short", year: "numeric" }).format(date);
}

function gruposDe(desde: string, hasta: string, granularidad: Granularidad): Array<{ id: string; etiqueta: string; fechas: string[] }> {
  const fechas = fechasEsperadas(desde, hasta);
  if (granularidad === "dia") return fechas.map((fecha) => ({ id: fecha, etiqueta: etiquetaCorta(fecha), fechas: [fecha] }));
  const grupos = new Map<string, string[]>();
  for (const fecha of fechas) {
    const clave = granularidad === "semana" ? lunesDe(fecha) : fecha.slice(0, 7);
    const lista = grupos.get(clave) ?? [];
    lista.push(fecha);
    grupos.set(clave, lista);
  }
  return Array.from(grupos.entries()).map(([, lista]) => {
    const inicio = lista[0];
    const fin = lista[lista.length - 1];
    return { id: `${inicio}:${fin}`, etiqueta: granularidad === "mes" ? etiquetaMes(inicio) : etiquetaRango(inicio, fin), fechas: lista };
  });
}

export function serieProducto(input: {
  desde: string;
  hasta: string;
  dias: DiaProducto[];
  diasComparados: DiaProducto[];
  cobertura: string[];
  coberturaComparada: string[];
  comparacion: ModoComparacion | "off";
  tramo: { desde: string; hasta: string } | null;
  anterior: { desde: string; hasta: string } | null;
  mostrarComparacion: boolean;
}): { granularidad: Granularidad; puntos: PuntoProducto[] } {
  const granularidad = granularidadDe(Math.max(0, diasInclusivos(input.desde, input.hasta)));
  const actual = new Map(input.dias.map((dia) => [dia.fecha, dia]));
  const comparado = new Map(input.diasComparados.map((dia) => [dia.fecha, dia]));
  const cobertura = new Set(input.cobertura);
  const coberturaComparada = new Set(input.coberturaComparada);
  const puntos = gruposDe(input.desde, input.hasta, granularidad).map((grupo) => {
    const suma = acumularProducto(grupo.fechas, actual, cobertura);
    const destinos = grupo.fechas
      .map((fecha) => fechaComparadaDe(fecha, input.comparacion, input.tramo, input.anterior))
      .filter((fecha): fecha is string => Boolean(fecha));
    const fuera = grupo.fechas.length - destinos.length;
    const comparadoSuma =
      input.mostrarComparacion && destinos.length > 0 ? acumularProducto(destinos, comparado, coberturaComparada) : null;
    const comparacionDisponible = comparadoSuma != null && comparadoSuma.faltan === 0;
    return {
      id: grupo.id,
      etiqueta: grupo.etiqueta,
      desde: grupo.fechas[0],
      hasta: grupo.fechas[grupo.fechas.length - 1],
      venta: suma.venta,
      unidades: suma.unidades,
      precio: suma.precio,
      fechaComparadaDesde: destinos[0] ?? null,
      fechaComparadaHasta: destinos[destinos.length - 1] ?? null,
      ventaComparada: comparacionDisponible ? comparadoSuma.venta : null,
      unidadesComparadas: comparacionDisponible ? comparadoSuma.unidades : null,
      precioComparado: comparacionDisponible ? comparadoSuma.precio : null,
      incompleta: suma.faltan > 0 && suma.cubiertos > 0,
      comparacionParcial: comparacionDisponible && fuera > 0,
    };
  });
  return { granularidad, puntos };
}

export function horasProducto(
  filas: Array<{ hora: number; venta: number; unidades: number; ordenes: number; ocurrencias: number | null }>,
  distingueCero: boolean,
): HoraProducto[] {
  const mapa = new Map(filas.map((fila) => [fila.hora, fila]));
  return Array.from({ length: 24 }, (_, hora) => {
    const fila = mapa.get(hora);
    const ocurrencias = fila?.ocurrencias ?? 0;
    const hayVenta = fila != null && (fila.ordenes !== 0 || fila.venta !== 0 || fila.unidades !== 0);
    if (!hayVenta && (!distingueCero || ocurrencias <= 0)) {
      return { hora, venta: null, unidades: null, ordenes: null, ocurrencias, estado: "sin_datos" };
    }
    if (!hayVenta) {
      return { hora, venta: 0, unidades: 0, ordenes: 0, ocurrencias, estado: "abierto_sin_ventas" };
    }
    return {
      hora,
      venta: fila?.venta ?? 0,
      unidades: fila?.unidades ?? 0,
      ordenes: fila?.ordenes ?? 0,
      ocurrencias,
      estado: "con_ventas",
    };
  });
}

export function etiquetaHora(hora: number): string {
  const inicio = ((hora % 24) + 24) % 24;
  return `${String(inicio).padStart(2, "0")}:00–${String((inicio + 1) % 24).padStart(2, "0")}:00`;
}

export function semanaDe(fecha: string): string {
  return lunesDe(fecha);
}

export function enlaceCosto(origen: string | null, ref: string | null): string | null {
  if (origen !== "factura" || !ref) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref)) return null;
  return `/admin/facturas/${ref}`;
}
