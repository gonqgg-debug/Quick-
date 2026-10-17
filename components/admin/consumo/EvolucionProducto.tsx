"use client";

import { useState } from "react";
import { Bar, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ETIQUETA_GRANULARIDAD, type Granularidad } from "@/lib/consumo-resumen-ui";
import { variacionDetalle, type MetricaSerie, type PuntoProducto } from "@/lib/consumo-producto-ui";
import { dinero } from "@/lib/consumo-productos-ui";
import { formatDayKey } from "@/lib/local-day";
import { formatUnidades } from "@/lib/pos-domain";
import { brand } from "@/lib/theme";

/** Un cero se dibuja como marca baja. Un dato ausente no se dibuja. */
export function BarraValor(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  payload?: { actual?: number | null; venta?: number | null };
  dataKey?: string | number;
}) {
  const valor = props.dataKey === "venta" ? props.payload?.venta : props.payload?.actual;
  if (valor == null || props.x == null || props.y == null || props.width == null || props.height == null) return <g />;
  const alto = valor === 0 ? 3 : Math.max(props.height, 0);
  const arriba = valor === 0 ? props.y - 3 : props.y;
  return <rect x={props.x} y={arriba} width={props.width} height={alto} fill={props.fill ?? brand.green} rx={2} />;
}

const METRICAS: Array<{ id: MetricaSerie; label: string }> = [
  { id: "ventas", label: "Ventas" },
  { id: "unidades", label: "Unidades" },
  { id: "precio", label: "Precio medio vendido" },
];

function valorDe(punto: PuntoProducto, metrica: MetricaSerie, comparado: boolean): number | null {
  if (metrica === "unidades") return comparado ? punto.unidadesComparadas : punto.unidades;
  if (metrica === "precio") return comparado ? punto.precioComparado : punto.precio;
  return comparado ? punto.ventaComparada : punto.venta;
}

function textoValor(punto: PuntoProducto, metrica: MetricaSerie, comparado: boolean): string {
  const valor = valorDe(punto, metrica, comparado);
  if (metrica === "precio" && valor == null) {
    const unidades = comparado ? punto.unidadesComparadas : punto.unidades;
    const venta = comparado ? punto.ventaComparada : punto.venta;
    if (venta != null && unidades === 0) return "Sin precio. No hubo unidades.";
  }
  if (valor == null) return "Sin dato";
  if (metrica === "unidades") return formatUnidades(valor);
  return dinero(valor);
}

function Contenido({
  active,
  payload,
  metrica,
}: {
  active?: boolean;
  payload?: Array<{ payload?: PuntoProducto }>;
  metrica: MetricaSerie;
}) {
  if (!active || !payload?.length) return null;
  const punto = payload[0]?.payload;
  if (!punto) return null;
  const actual = valorDe(punto, metrica, false);
  const anterior = valorDe(punto, metrica, true);
  const variacion =
    actual != null && anterior != null && punto.fechaComparadaDesde ? variacionDetalle(actual, anterior, true) : null;
  return (
    <div className="max-w-xs rounded-md border border-[#E6E8E6] bg-white px-3 py-2 text-xs text-brand-ink shadow-sm">
      <p className="font-semibold">
        {formatDayKey(punto.desde)}
        {punto.desde === punto.hasta ? "" : ` – ${formatDayKey(punto.hasta)}`}
      </p>
      <p className="mt-1">{textoValor(punto, metrica, false)}</p>
      {punto.fechaComparadaDesde ? (
        <p className="mt-1 text-brand-muted">
          Comparado {formatDayKey(punto.fechaComparadaDesde)}
          {punto.fechaComparadaHasta && punto.fechaComparadaHasta !== punto.fechaComparadaDesde ? ` – ${formatDayKey(punto.fechaComparadaHasta)}` : ""}:{" "}
          {textoValor(punto, metrica, true)}
          {variacion ? ` · ${variacion.texto}` : ""}
        </p>
      ) : null}
    </div>
  );
}

export function EvolucionProducto({
  puntos,
  granularidad,
  mostrarComparacion,
  etiquetaActual,
  etiquetaComparada,
  compacto = false,
}: {
  puntos: PuntoProducto[];
  granularidad: Granularidad;
  mostrarComparacion: boolean;
  etiquetaActual?: string | null;
  etiquetaComparada?: string | null;
  compacto?: boolean;
}) {
  const [metrica, setMetrica] = useState<MetricaSerie>("ventas");
  const [puntoId, setPuntoId] = useState<string>("");
  const elegido = puntos.find((punto) => punto.id === puntoId) ?? null;
  const datos = puntos.map((punto) => ({
    ...punto,
    actual: valorDe(punto, metrica, false),
    comparado: mostrarComparacion ? valorDe(punto, metrica, true) : null,
  }));
  const hayComparado = mostrarComparacion && datos.some((punto) => punto.comparado != null);
  const unidad = metrica === "unidades" ? "unidades" : "RD$";
  const precio = metrica === "precio";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Métrica de la evolución">
          {METRICAS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={metrica === item.id}
              onClick={() => setMetrica(item.id)}
              className={`h-8 rounded-md px-2.5 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green ${
                metrica === item.id ? "bg-brand-ink text-white" : "border border-[#E5E7EB] bg-white text-brand-ink"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-brand-muted">
          {ETIQUETA_GRANULARIDAD[granularidad]} · eje en {unidad}
        </p>
      </div>
      <div className={compacto ? "mt-3 h-40" : "mt-3 h-64"}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={datos}>
            <XAxis dataKey="etiqueta" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} width={48} />
            <Tooltip content={<Contenido metrica={metrica} />} />
            {precio ? (
              <Line dataKey="actual" name="Periodo" stroke={brand.green} strokeWidth={2} dot={{ r: 2 }} connectNulls={false} />
            ) : (
              <Bar dataKey="actual" name="Periodo" fill={brand.green} radius={[3, 3, 0, 0]} shape={<BarraValor />} />
            )}
            {hayComparado ? (
              <Line dataKey="comparado" name="Comparado" stroke="#111827" strokeWidth={1.5} dot={false} connectNulls={false} />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-brand-muted">
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-sm align-middle" style={{ backgroundColor: brand.green }} />
          {etiquetaActual || "Periodo"}
        </span>
        {hayComparado ? (
          <span>
            <span className="mr-1 inline-block h-0.5 w-3 align-middle" style={{ backgroundColor: "#111827" }} />
            {etiquetaComparada ? `Comparado ${etiquetaComparada}` : "Comparado"}
          </span>
        ) : null}
        <label className="ml-auto">
          <span className="sr-only">Elegir fecha</span>
          <select
            value={puntoId}
            onChange={(event) => setPuntoId(event.target.value)}
            className="h-8 rounded-md border border-[#E5E7EB] bg-white px-2 text-xs text-brand-ink"
          >
            <option value="">Ver una fecha</option>
            {puntos.map((punto) => (
              <option key={punto.id} value={punto.id}>
                {punto.etiqueta}
              </option>
            ))}
          </select>
        </label>
      </div>
      {elegido ? (
        <p className="mt-2 text-xs text-brand-ink" aria-live="polite">
          {formatDayKey(elegido.desde)}
          {elegido.desde === elegido.hasta ? "" : ` – ${formatDayKey(elegido.hasta)}`}: {textoValor(elegido, metrica, false)}
          {elegido.fechaComparadaDesde
            ? `. Comparado ${formatDayKey(elegido.fechaComparadaDesde)}: ${textoValor(elegido, metrica, true)}${
                valorDe(elegido, metrica, false) != null && valorDe(elegido, metrica, true) != null
                  ? `. ${variacionDetalle(valorDe(elegido, metrica, false), valorDe(elegido, metrica, true), mostrarComparacion).texto}`
                  : ""
              }`
            : ""}
        </p>
      ) : null}
      <p className="mt-2 text-xs text-brand-muted">
        Un día con datos de caja y sin ventas de este producto vale cero. Un día sin datos no se dibuja como cero. El precio medio queda vacío si no hay unidades.
      </p>
    </div>
  );
}
