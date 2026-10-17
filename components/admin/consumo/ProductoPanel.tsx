"use client";

import Link from "next/link";
import { useEffect, useId, useRef } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { diasInclusivos } from "@/lib/consumo-metricas";
import {
  DEFINICION_COSTO,
  detalleEstadoCosto,
  dinero,
  estadoCosto,
  etiquetaEstadoCosto,
  formatPctPlano,
  subtituloProducto,
  textoFuenteCosto,
  type TextoVariacion,
} from "@/lib/consumo-productos-ui";
import { addDaysToDayKey, formatDayKey } from "@/lib/local-day";
import { formatUnidades } from "@/lib/pos-domain";
import type { DetalleProducto } from "@/lib/pos-consumo";
import { brand } from "@/lib/theme";

type Punto = { dia: string; actual: number | null; comparado: number | null };

function puntosDe(
  desde: string,
  hasta: string,
  actual: Array<{ fecha: string; venta: number }>,
  comparado: Array<{ fecha: string; venta: number }> | null,
  desdeComparado: string | null,
): Punto[] {
  const mapaActual = new Map(actual.map((punto) => [punto.fecha, punto.venta]));
  const mapaComparado = new Map((comparado ?? []).map((punto) => [punto.fecha, punto.venta]));
  const total = Math.max(0, diasInclusivos(desde, hasta));
  const puntos: Punto[] = [];
  for (let index = 0; index < total; index += 1) {
    const fecha = addDaysToDayKey(desde, index);
    const fechaComparada = desdeComparado ? addDaysToDayKey(desdeComparado, index) : null;
    puntos.push({
      dia: fecha.slice(5),
      actual: mapaActual.has(fecha) ? (mapaActual.get(fecha) as number) : null,
      comparado: fechaComparada && mapaComparado.has(fechaComparada) ? (mapaComparado.get(fechaComparada) as number) : null,
    });
  }
  return puntos;
}

export function ProductoPanel({
  codigo,
  detalle,
  error,
  cargando,
  desde,
  hasta,
  desdeComparado,
  hastaComparado,
  mostrarComparacion,
  variacion,
  enlaceHorario,
  onClose,
}: {
  codigo: string;
  detalle: DetalleProducto | null;
  error: string | null;
  cargando: boolean;
  desde: string;
  hasta: string;
  desdeComparado: string | null;
  hastaComparado: string | null;
  mostrarComparacion: boolean;
  variacion: TextoVariacion | null;
  enlaceHorario: string;
  onClose: () => void;
}) {
  const tituloId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const cerrar = useRef(onClose);
  cerrar.current = onClose;

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const previo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const selector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])';
    const focos = () => Array.from(root.querySelectorAll<HTMLElement>(selector));
    focos()[0]?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        cerrar.current();
        return;
      }
      if (event.key !== "Tab") return;
      const lista = focos();
      if (lista.length === 0) return;
      const inicio = lista[0];
      const fin = lista[lista.length - 1];
      if (event.shiftKey && document.activeElement === inicio) {
        event.preventDefault();
        fin.focus();
      } else if (!event.shiftKey && document.activeElement === fin) {
        event.preventDefault();
        inicio.focus();
      }
    }
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previo?.focus();
    };
  }, [codigo]);

  const subtitulo = detalle ? subtituloProducto(detalle) : null;
  const costoEstado = detalle ? estadoCosto(detalle.costoOrigen, detalle.costo) : "sin_costo";
  const fuente = detalle ? textoFuenteCosto(detalle.costoOrigen, detalle.costoFecha, detalle.costoRef) : null;
  const serieComparada = mostrarComparacion ? detalle?.serieAnterior ?? null : null;
  const puntos = detalle && detalle.serie.length > 0 ? puntosDe(desde, hasta, detalle.serie, serieComparada, desdeComparado) : [];
  const hayComparado = puntos.some((punto) => punto.comparado != null);

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label="Cerrar detalle del producto" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className="absolute inset-0 flex flex-col bg-white shadow-xl md:inset-y-0 md:left-auto md:w-[440px] md:border-l md:border-[#E6E8E6]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#EEF1EE] px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">Producto</p>
            <h2 id={tituloId} className="mt-1 text-lg font-semibold leading-snug text-brand-ink">
              {detalle?.nombre ?? codigo}
            </h2>
            {subtitulo ? <p className="mt-1 text-sm text-brand-muted">{subtitulo}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-xl text-brand-ink hover:bg-black/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {cargando ? (
            <div className="space-y-3" aria-hidden>
              <div className="h-16 animate-pulse rounded-md bg-[#F3F4F6]" />
              <div className="grid grid-cols-2 gap-3">
                <div className="h-16 animate-pulse rounded-md bg-[#F3F4F6]" />
                <div className="h-16 animate-pulse rounded-md bg-[#F3F4F6]" />
              </div>
              <div className="h-40 animate-pulse rounded-md bg-[#F3F4F6]" />
            </div>
          ) : error ? (
            <p className="rounded-md bg-[#FEE2E2] px-3 py-2 text-sm text-brand-error" role="alert">
              {error}
            </p>
          ) : detalle ? (
            <div className="space-y-4">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Dato etiqueta="Categoría" valor={detalle.categoria || "—"} />
                <Dato etiqueta="SKU" valor={detalle.codigo} />
                {detalle.codigoBarras ? <Dato etiqueta="Código de barras" valor={detalle.codigoBarras} /> : null}
              </dl>
              <p className="text-xs text-brand-muted">
                Periodo: {formatDayKey(desde)} – {formatDayKey(hasta)}
                {mostrarComparacion && desdeComparado && hastaComparado
                  ? `. Comparado: ${formatDayKey(desdeComparado)} – ${formatDayKey(hastaComparado)}.`
                  : ""}
              </p>
              <dl className="grid grid-cols-2 gap-3">
                <Metrica etiqueta="Ventas" valor={dinero(detalle.venta)} nota="Con ITBIS" />
                <Metrica etiqueta="Unidades" valor={formatUnidades(detalle.unidades)} />
                <Metrica
                  etiqueta="Utilidad bruta"
                  valor={detalle.margen == null ? "—" : dinero(detalle.margen)}
                  nota={detalle.margen == null ? "Sin costo" : "Solo con costo de referencia"}
                />
                <Metrica etiqueta="Margen bruto" valor={formatPctPlano(detalle.margenPct)} nota="Sobre la venta neta con costo" />
              </dl>
              {variacion ? (
                <p className="text-sm text-brand-ink">
                  Variación de ventas: <Variacion item={variacion} />
                </p>
              ) : null}
              <section className="rounded-md border border-[#E6E8E6] px-3 py-3">
                <h3 className="text-sm font-semibold text-brand-ink">Costo de referencia</h3>
                <p className="mt-1 text-sm text-brand-ink">{etiquetaEstadoCosto(costoEstado)}</p>
                <p className="mt-1 text-xs text-brand-muted">{detalleEstadoCosto(costoEstado)}</p>
                {fuente ? <p className="mt-2 text-sm text-brand-ink">{fuente}</p> : null}
                {detalle.costo != null ? <p className="mt-1 text-sm tabular-nums text-brand-ink">{dinero(detalle.costo)} por unidad</p> : null}
                <p className="mt-2 text-xs leading-5 text-brand-muted">{DEFINICION_COSTO}</p>
                {detalle.productId ? (
                  <Link href={`/admin/catalogo/productos/${detalle.productId}`} className="mt-2 inline-block text-sm font-semibold text-brand-green">
                    Abrir en el catálogo
                  </Link>
                ) : null}
              </section>
              {detalle.serie.length > 0 ? (
                <section>
                  <h3 className="text-sm font-semibold text-brand-ink">Ventas por día</h3>
                  <p className="mt-1 text-xs text-brand-muted">Solo se grafican los días con ventas registradas. Un hueco no es cero.</p>
                  <div className="mt-3 h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={puntos}>
                        <XAxis dataKey="dia" tick={{ fontSize: 10, fill: "#6B7280" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} width={48} />
                        <Tooltip
                          formatter={(value, name) => [
                            typeof value === "number" ? dinero(value) : "Sin registro",
                            name === "comparado" ? "Comparado" : "Periodo",
                          ]}
                          contentStyle={{ borderRadius: 8, borderColor: "#E5E7EB", fontSize: 12 }}
                        />
                        <Bar dataKey="actual" name="Periodo" fill={brand.green} radius={[3, 3, 0, 0]} />
                        {hayComparado ? <Bar dataKey="comparado" name="Comparado" fill="#D1D5DB" radius={[3, 3, 0, 0]} /> : null}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="mt-1 flex gap-4 text-[11px] text-brand-muted">
                    <span>
                      <span className="mr-1 inline-block h-2 w-2 rounded-sm align-middle" style={{ backgroundColor: brand.green }} />
                      Periodo
                    </span>
                    {hayComparado ? (
                      <span>
                        <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#D1D5DB] align-middle" />
                        Comparado
                      </span>
                    ) : null}
                  </p>
                </section>
              ) : null}
              <Link href={enlaceHorario} className="inline-block text-sm font-semibold text-brand-green">
                Ver venta por hora
              </Link>
            </div>
          ) : (
            <p className="text-sm text-brand-muted">No hay detalle para este producto.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">{etiqueta}</dt>
      <dd className="mt-0.5 break-words text-sm text-brand-ink">{valor}</dd>
    </div>
  );
}

function Metrica({ etiqueta, valor, nota }: { etiqueta: string; valor: string; nota?: string }) {
  return (
    <div className="rounded-md border border-[#EEF1EE] px-3 py-2">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">{etiqueta}</dt>
      <dd className="mt-1 text-base font-semibold tabular-nums text-brand-ink">{valor}</dd>
      {nota ? <p className="mt-0.5 text-[11px] text-brand-muted">{nota}</p> : null}
    </div>
  );
}

export function Variacion({ item }: { item: TextoVariacion }) {
  const color = item.tono === "sube" ? "#166534" : item.tono === "baja" ? "#B91C1C" : "#6B7280";
  const marca = item.tono === "sube" ? "▲ " : item.tono === "baja" ? "▼ " : "";
  return (
    <span className="font-semibold tabular-nums" style={{ color }}>
      {marca ? <span aria-hidden="true">{marca}</span> : null}
      {item.texto}
    </span>
  );
}
