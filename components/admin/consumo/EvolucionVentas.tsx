"use client";

import { useEffect, useState } from "react";
import { Bar, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ETIQUETA_GRANULARIDAD, type Granularidad, type PuntoSerie } from "@/lib/consumo-resumen-ui";
import { dinero } from "@/lib/consumo-productos-ui";
import { formatDayKey } from "@/lib/local-day";
import { variacionPct } from "@/lib/consumo-metricas";
import { formatNumero, formatPct } from "@/lib/pos-domain";
import { brand } from "@/lib/theme";

function eje(value: number): string {
  const absoluto = Math.abs(value);
  if (absoluto >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} M`;
  if (absoluto >= 1000) return `${Math.round(value / 1000)} mil`;
  return String(Math.round(value));
}

function variacion(actual: number | null, anterior: number | null): string {
  if (anterior == null || actual == null) return "Sin dato comparado";
  if (anterior === 0) return "Sin base";
  const pct = variacionPct(actual, anterior);
  return pct == null ? "Sin base" : formatPct(pct);
}

function Contenido({ active, payload }: { active?: boolean; payload?: Array<{ payload?: PuntoSerie }> }) {
  if (!active || !payload?.length) return null;
  const punto = payload[0]?.payload;
  if (!punto) return null;
  return (
    <div className="max-w-xs rounded-md border border-[#E6E8E6] bg-white px-3 py-2 text-xs text-brand-ink shadow-sm">
      <p className="font-semibold">{formatDayKey(punto.desde)}{punto.desde === punto.hasta ? "" : ` – ${formatDayKey(punto.hasta)}`}</p>
      <p className="mt-1">{punto.venta == null ? "Sin datos. No se toma como cero." : `Ventas ${dinero(punto.venta)}`}</p>
      {punto.fechaComparadaDesde ? (
        <p className="mt-1 text-brand-muted">
          Comparado {formatDayKey(punto.fechaComparadaDesde)}
          {punto.fechaComparadaHasta && punto.fechaComparadaHasta !== punto.fechaComparadaDesde ? ` – ${formatDayKey(punto.fechaComparadaHasta)}` : ""}:{" "}
          {punto.ventaComparada == null ? "sin dato" : dinero(punto.ventaComparada)}
          {punto.ventaComparada != null ? ` · ${variacion(punto.venta, punto.ventaComparada)}` : ""}
        </p>
      ) : null}
    </div>
  );
}

export function EvolucionVentas({
  puntos,
  granularidad,
  mostrarComparacion,
  explicacionComparacion,
  onAnalizar,
}: {
  puntos: PuntoSerie[];
  granularidad: Granularidad;
  mostrarComparacion: boolean;
  explicacionComparacion: string | null;
  onAnalizar: (punto: PuntoSerie) => void;
}) {
  const [listo, setListo] = useState(false);
  const [seleccionId, setSeleccionId] = useState<string | null>(null);
  const hayLinea = mostrarComparacion && puntos.some((punto) => punto.ventaComparada != null);
  const seleccion = puntos.find((punto) => punto.id === seleccionId) ?? null;

  useEffect(() => {
    if (seleccionId && !puntos.some((punto) => punto.id === seleccionId)) setSeleccionId(null);
  }, [puntos, seleccionId]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-brand-muted">{ETIQUETA_GRANULARIDAD[granularidad]} · eje en RD$</p>
        <div className="flex flex-wrap items-center gap-3 text-xs text-brand-muted">
          <span>
            <span className="mr-1 inline-block h-2 w-3 rounded-sm align-middle" style={{ backgroundColor: brand.green }} />
            Ventas
          </span>
          {hayLinea ? (
            <span>
              <span className="mr-1 inline-block h-0.5 w-3 align-middle" style={{ backgroundColor: "#111827" }} />
              Comparado
            </span>
          ) : (
            <span>{explicacionComparacion}</span>
          )}
        </div>
      </div>
      <label className="mt-2 block text-xs font-medium text-brand-muted">
        Consultar una fecha
        <select
          value={seleccionId ?? ""}
          onChange={(event) => setSeleccionId(event.target.value || null)}
          className="mt-1 block h-9 w-full max-w-xs rounded-md border border-[#E5E7EB] bg-white px-2 text-sm text-brand-ink focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30"
        >
          <option value="">Ninguna seleccionada</option>
          {puntos.map((punto) => (
            <option key={punto.id} value={punto.id}>
              {punto.etiqueta}
              {punto.venta == null ? " · sin datos" : ""}
            </option>
          ))}
        </select>
      </label>
      {!listo ? (
        <div ref={() => setListo(true)} className="mt-3 h-64 animate-pulse rounded-md bg-[#F4F5F3]" />
      ) : (
        <div className="mt-3 h-64" role="img" aria-label={`Evolución de ventas ${ETIQUETA_GRANULARIDAD[granularidad].toLowerCase()}`}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={puntos}
              onClick={(state) => {
                const id = state?.activePayload?.[0]?.payload?.id as string | undefined;
                if (id) setSeleccionId(id);
              }}
            >
              <XAxis dataKey="etiqueta" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} interval={puntos.length > 16 ? Math.ceil(puntos.length / 8) - 1 : 0} />
              <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} width={52} tickFormatter={eje} />
              <Tooltip content={<Contenido />} />
              <Bar dataKey="venta" name="Ventas" radius={[3, 3, 0, 0]} maxBarSize={28}>
                {puntos.map((punto) => (
                  <Cell key={punto.id} fill={punto.id === seleccionId ? "#3F6B1C" : brand.green} stroke={punto.id === seleccionId ? "#111827" : "transparent"} />
                ))}
              </Bar>
              {hayLinea ? <Line dataKey="ventaComparada" name="Comparado" stroke="#111827" strokeDasharray="4 4" dot={false} strokeWidth={1.5} connectNulls={false} /> : null}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
      {seleccion ? (
        <div className="mt-3 rounded-md border border-[#E6E8E6] bg-[#F8F9F7] px-3 py-2 text-sm" aria-live="polite">
          <p className="font-semibold text-brand-ink">
            Seleccionado: {formatDayKey(seleccion.desde)}
            {seleccion.desde === seleccion.hasta ? "" : ` – ${formatDayKey(seleccion.hasta)}`}
          </p>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div>
              <dt className="text-brand-muted">Ventas</dt>
              <dd className="font-semibold tabular-nums">{seleccion.venta == null ? "Sin datos" : dinero(seleccion.venta)}</dd>
            </div>
            <div>
              <dt className="text-brand-muted">Tickets</dt>
              <dd className="font-semibold tabular-nums">{seleccion.ordenes == null ? "Sin datos" : formatNumero(seleccion.ordenes)}</dd>
            </div>
            <div>
              <dt className="text-brand-muted">Ticket promedio</dt>
              <dd className="font-semibold tabular-nums">{seleccion.ticket == null ? "—" : dinero(seleccion.ticket)}</dd>
            </div>
            <div>
              <dt className="text-brand-muted">Comparado</dt>
              <dd className="font-semibold tabular-nums">
                {seleccion.ventaComparada == null ? "Sin dato" : `${dinero(seleccion.ventaComparada)} · ${variacion(seleccion.venta, seleccion.ventaComparada)}`}
              </dd>
            </div>
          </dl>
          {seleccion.incompleta ? (
            <p className="mt-2 text-xs text-[#92400E]">
              Suma de {seleccion.diasConDatos} de {seleccion.diasEsperados} días con datos. Los días sin sesión no entran como cero.
            </p>
          ) : null}
          {seleccion.comparacionParcial ? <p className="mt-1 text-xs text-brand-muted">El comparado solo cubre los días completos de este tramo.</p> : null}
          <div className="mt-2 flex flex-wrap gap-3 text-sm">
            <button type="button" onClick={() => setSeleccionId(null)} className="font-semibold text-brand-muted underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green">
              Limpiar selección
            </button>
            <button type="button" onClick={() => onAnalizar(seleccion)} className="font-semibold text-brand-green underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green">
              {granularidad === "dia" ? "Analizar este día" : "Analizar estas fechas"}
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-xs text-brand-muted">Elige una barra o una fecha para ver el detalle. La selección no cambia el resto de la página.</p>
      )}
    </div>
  );
}
