"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { formatDayKey } from "@/lib/local-day";
import { COSTO_METODO_TEXTO } from "@/lib/consumo-metricas";
import { formatRd, formatUnidades } from "@/lib/pos-domain";
import { estadoCosto, etiquetaVariacion, formatParticipacion, secundarioProducto, textoOrigenCosto, type EtiquetaVariacion } from "@/lib/productos-analitica";
import { brand } from "@/lib/theme";

type Punto = { fecha: string; venta: number };

export type PanelProductoDatos = {
  codigo: string;
  productId: string | null;
  nombre: string;
  marca: string | null;
  categoria: string;
  codigoBarras: string | null;
  venta: number;
  unidades: number;
  margen: number | null;
  margenPct: number | null;
  costo: number | null;
  costoOrigen: string | null;
  costoFecha: string | null;
  ventaAnterior: number | null;
  variacion: number | null;
  serieGrafica: Punto[];
  serieAnterior: Punto[] | null;
};

export function ProductoPanel({
  producto,
  periodo,
  comparar,
  cargando,
  onClose,
}: {
  producto: PanelProductoDatos | null;
  periodo: string;
  comparar: boolean;
  cargando: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const cerrar = useRef(onClose);
  cerrar.current = onClose;

  useEffect(() => {
    const nodo = ref.current;
    const previo = document.activeElement as HTMLElement | null;
    nodo?.querySelector<HTMLElement>("[data-cierre]")?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        cerrar.current();
        return;
      }
      if (event.key !== "Tab" || !nodo) {
        return;
      }
      const items = Array.from(nodo.querySelectorAll<HTMLElement>("a, button, input, select, textarea, [tabindex]:not([tabindex='-1'])")).filter(
        (el) => !el.hasAttribute("disabled") && el.tabIndex !== -1,
      );
      if (items.length === 0) {
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previo?.focus();
    };
  }, []);

  const secundario = producto ? secundarioProducto(producto) : null;
  const variacion = comparar && producto ? etiquetaVariacion(producto.ventaAnterior, producto.variacion) : null;

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label="Cerrar detalle" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="panel-producto-titulo"
        className="absolute inset-0 flex flex-col bg-white md:inset-y-0 md:left-auto md:w-[26rem] md:border-l md:border-[#E6EAE6]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#E6EAE6] px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">Producto</p>
            <h2 id="panel-producto-titulo" className="truncate text-base font-semibold text-[#1A1A1A]">
              {producto?.nombre ?? "Cargando"}
            </h2>
          </div>
          <button
            type="button"
            data-cierre
            onClick={onClose}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-lg text-brand-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {cargando || !producto ? (
            <div className="space-y-3" aria-busy="true" aria-live="polite">
              <p className="text-sm text-brand-muted">Cargando el producto…</p>
              <div className="h-16 animate-pulse rounded-md bg-[#E8EBE8]" />
              <div className="h-24 animate-pulse rounded-md bg-[#E8EBE8]" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-brand-muted">
                {producto.categoria ? <p>{producto.categoria}</p> : null}
                {secundario ? <p>{secundario}</p> : null}
                {producto.codigoBarras ? <p>Barras {producto.codigoBarras}</p> : null}
              </div>
              <p className="text-sm text-[#1A1A1A]">
                <span className="text-brand-muted">Periodo analizado. </span>
                {periodo}
              </p>
              <dl className="grid grid-cols-2 gap-3">
                <Dato etiqueta="Ventas" valor={formatRd(producto.venta)} nota="Incluye ITBIS" />
                <Dato etiqueta="Unidades" valor={formatUnidades(producto.unidades)} />
                <Dato etiqueta="Utilidad bruta" valor={producto.margen == null ? "—" : formatRd(producto.margen)} nota={producto.margen == null ? "Sin costo" : "Solo con costo disponible"} />
                <Dato etiqueta="Margen bruto" valor={producto.margenPct == null ? "—" : formatParticipacion(producto.margenPct)} />
              </dl>
              {variacion ? (
                <p className="text-sm">
                  <span className="text-brand-muted">Variación de ventas. </span>
                  <VariacionTexto etiqueta={variacion} />
                </p>
              ) : null}
              <div className="rounded-md border border-[#E6EAE6] px-3 py-2 text-sm">
                <p className="font-semibold text-[#1A1A1A]">Costo</p>
                <p className="mt-1 text-brand-muted">{COSTO_METODO_TEXTO}</p>
                <p className="mt-2">
                  Estado: {estadoCosto(producto.costo)}
                  {producto.costo == null ? "" : ` · ${formatRd(producto.costo)} por unidad de referencia`}
                </p>
                {producto.costo == null ? null : (
                  <p>
                    Fuente: {textoOrigenCosto(producto.costoOrigen)}
                    {producto.costoFecha ? ` · ${formatDayKey(producto.costoFecha)}` : ""}
                  </p>
                )}
              </div>
              <SerieMini actual={producto.serieGrafica} anterior={producto.serieAnterior} />
              {producto.productId ? (
                <Link href={`/admin/catalogo/productos/${producto.productId}`} className="inline-flex text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green" style={{ color: "#3F6B1C" }}>
                  Abrir en el catálogo
                </Link>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Dato({ etiqueta, valor, nota }: { etiqueta: string; valor: string; nota?: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">{etiqueta}</dt>
      <dd className="mt-0.5 text-sm font-semibold tabular-nums text-[#1A1A1A]">{valor}</dd>
      {nota ? <p className="text-xs text-brand-muted">{nota}</p> : null}
    </div>
  );
}

export function VariacionTexto({ etiqueta }: { etiqueta: EtiquetaVariacion }) {
  if (etiqueta.tipo === "nuevo") {
    return <span className="font-semibold text-brand-muted">Nuevo</span>;
  }
  if (etiqueta.tipo === "sin_base") {
    return <span className="font-semibold text-brand-muted">Sin base</span>;
  }
  const color = Math.abs(etiqueta.valor) < 0.005 ? brand.muted : etiqueta.valor > 0 ? "#166534" : brand.error;
  const sentido = Math.abs(etiqueta.valor) < 0.005 ? "igual" : etiqueta.valor > 0 ? "sube" : "baja";
  const formatted = new Intl.NumberFormat("es-DO", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  }).format(etiqueta.valor * 100);
  return (
    <span className="font-semibold tabular-nums" style={{ color }}>
      {sentido} {formatted}%
    </span>
  );
}

function SerieMini({ actual, anterior }: { actual: Punto[]; anterior: Punto[] | null }) {
  if (actual.length === 0) {
    return null;
  }
  const valores = actual.map((punto) => punto.venta);
  const comparados = anterior?.map((punto) => punto.venta) ?? [];
  const max = Math.max(1, ...valores, ...comparados);
  const width = 320;
  const height = 96;
  const pad = 6;
  function puntos(serie: number[]) {
    if (serie.length === 0) {
      return "";
    }
    if (serie.length === 1) {
      const y = height - pad - (serie[0] / max) * (height - pad * 2);
      return `${pad},${y} ${width - pad},${y}`;
    }
    return serie
      .map((valor, index) => {
        const x = pad + (index / (serie.length - 1)) * (width - pad * 2);
        const y = height - pad - (valor / max) * (height - pad * 2);
        return `${x},${y}`;
      })
      .join(" ");
  }
  const alineada = comparados.length > 0 ? comparados.slice(0, valores.length) : [];
  return (
    <figure>
      <figcaption className="text-xs font-semibold text-brand-muted">Ventas diarias con ITBIS</figcaption>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Serie de ventas del periodo" className="mt-2 h-24 w-full">
        {alineada.length > 0 ? <polyline fill="none" stroke="#C5C9C4" strokeWidth="2" points={puntos(alineada)} /> : null}
        <polyline fill="none" stroke={brand.green} strokeWidth="2" points={puntos(valores)} />
      </svg>
      <p className="text-xs text-brand-muted">
        Línea verde: este periodo.
        {alineada.length > 0 ? " Línea gris: periodo comparado, alineada por día." : ""}
        {anterior && anterior.length !== actual.length ? " Los días que no coinciden no se inventan." : ""}
      </p>
    </figure>
  );
}
