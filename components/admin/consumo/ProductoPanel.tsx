"use client";

import Link from "next/link";
import { useEffect, useId, useRef } from "react";
import { EvolucionProducto } from "@/components/admin/consumo/EvolucionProducto";
import { DatosTecnicos, PrecioCostoProducto } from "@/components/admin/consumo/PrecioCostoProducto";
import { lineaProducto, nombreProducto, serieProducto, variacionDetalle } from "@/lib/consumo-producto-ui";
import { describirPeriodo, dinero, formatPctPlano, type TextoVariacion } from "@/lib/consumo-productos-ui";
import { formatUnidades, type ConsumoPeriodo } from "@/lib/pos-domain";
import type { DetalleProducto } from "@/lib/pos-consumo";

export function ProductoPanel({
  codigo,
  detalle,
  error,
  cargando,
  periodo,
  mostrarComparacion,
  tiendaEtiqueta,
  enlaceCompleto,
  onClose,
}: {
  codigo: string;
  detalle: DetalleProducto | null;
  error: string | null;
  cargando: boolean;
  periodo: ConsumoPeriodo;
  mostrarComparacion: boolean;
  tiendaEtiqueta: string | null;
  enlaceCompleto: string;
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

  const titulo = detalle ? nombreProducto(detalle.nombre, detalle.codigo) : cargando ? "Cargando producto" : "Producto";
  const linea = detalle ? lineaProducto(detalle.categoria, detalle.presentacion) : null;

  const texto = describirPeriodo(periodo);
  const serie = detalle
    ? serieProducto({
        desde: periodo.desde,
        hasta: periodo.hasta,
        dias: detalle.serie.map((dia) => ({ fecha: dia.fecha, venta: dia.venta, unidades: dia.unidades })),
        diasComparados: (detalle.serieAnterior ?? []).map((dia) => ({ fecha: dia.fecha, venta: dia.venta, unidades: dia.unidades })),
        cobertura: detalle.cobertura,
        coberturaComparada: detalle.coberturaAnterior,
        comparacion: periodo.comparacion,
        tramo: periodo.tramo,
        anterior: periodo.anterior,
        mostrarComparacion,
      })
    : null;
  const contexto = [
    texto.rango,
    texto.comparado ? `Comparado ${texto.comparado}` : null,
    tiendaEtiqueta ? `Tienda ${tiendaEtiqueta}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label="Cerrar detalle del producto" className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        aria-busy={cargando}
        className="absolute inset-0 flex flex-col bg-[#F4F5F3] shadow-xl md:inset-y-0 md:left-auto md:w-[420px] md:border-l md:border-[#E6E8E6] lg:w-[480px]"
      >
        <div className="flex shrink-0 items-start gap-3 border-b border-[#E6E8E6] bg-white px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 id={tituloId} className="text-lg font-semibold leading-snug text-brand-ink">
              {titulo}
            </h2>
            {linea ? <p className="mt-0.5 text-sm text-brand-muted">{linea}</p> : null}
            <Link
              href={enlaceCompleto}
              onClick={() => sessionStorage.setItem("analitica-foco-producto", codigo)}
              className="mt-2 inline-flex h-8 items-center rounded-md bg-brand-green px-2.5 text-xs font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green"
            >
              Ver análisis completo
            </Link>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-xl text-brand-ink hover:bg-black/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {cargando ? (
            <div className="space-y-3" aria-hidden>
              <div className="h-10 animate-pulse rounded-md bg-white" />
              <div className="grid grid-cols-2 gap-2">
                <div className="h-16 animate-pulse rounded-md bg-white" />
                <div className="h-16 animate-pulse rounded-md bg-white" />
                <div className="h-16 animate-pulse rounded-md bg-white" />
                <div className="h-16 animate-pulse rounded-md bg-white" />
              </div>
              <div className="h-44 animate-pulse rounded-md bg-white" />
            </div>
          ) : error ? (
            <p className="rounded-md bg-[#FEE2E2] px-3 py-2 text-sm text-brand-error" role="alert">
              {error}
            </p>
          ) : detalle ? (
            <div className="space-y-4">
              <p className="text-xs text-brand-muted">{contexto}</p>
              <dl className="grid grid-cols-2 gap-2">
                <Metrica
                  etiqueta="Ventas"
                  valor={dinero(detalle.venta)}
                  nota="Con ITBIS"
                  variacion={variacionDetalle(detalle.venta, detalle.ventaAnterior, mostrarComparacion)}
                  ayuda={mostrarComparacion && detalle.ventaAnterior != null ? `Comparado ${dinero(detalle.ventaAnterior)}` : null}
                />
                <Metrica
                  etiqueta="Unidades vendidas"
                  valor={formatUnidades(detalle.unidades)}
                  variacion={variacionDetalle(detalle.unidades, detalle.unidadesAnterior, mostrarComparacion)}
                />
                <Metrica
                  etiqueta="Utilidad bruta estimada"
                  valor={detalle.margen == null ? "—" : dinero(detalle.margen)}
                  nota={detalle.margen == null ? "Sin costo" : "Con el costo de referencia"}
                />
                <Metrica
                  etiqueta="Margen bruto estimado"
                  valor={detalle.margen == null ? "—" : formatPctPlano(detalle.margenPct)}
                  nota={detalle.margen == null ? "Sin costo" : "Sobre la venta neta"}
                />
              </dl>
              {serie && serie.puntos.length > 0 ? (
                <section className="rounded-lg border border-[#E6E8E6] bg-white p-3 shadow-sm">
                  <h3 className="text-sm font-semibold text-brand-ink">Evolución</h3>
                  <div className="mt-2">
                    <EvolucionProducto
                      puntos={serie.puntos}
                      granularidad={serie.granularidad}
                      mostrarComparacion={mostrarComparacion}
                      etiquetaActual={texto.rango}
                      etiquetaComparada={texto.comparado}
                      compacto
                    />
                  </div>
                </section>
              ) : (
                <p className="rounded-lg border border-[#E6E8E6] bg-white px-3 py-3 text-sm text-brand-muted">Sin ventas de este producto en el periodo.</p>
              )}
              <PrecioCostoProducto producto={detalle} compacto />
              <DatosTecnicos producto={detalle} />
            </div>
          ) : (
            <p className="text-sm text-brand-muted">No hay detalle para este producto.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Metrica({
  etiqueta,
  valor,
  nota,
  variacion,
  ayuda,
}: {
  etiqueta: string;
  valor: string;
  nota?: string;
  variacion?: TextoVariacionDetalleVista;
  ayuda?: string | null;
}) {
  return (
    <div className="rounded-lg border border-[#E6E8E6] bg-white px-3 py-2 shadow-sm">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">{etiqueta}</dt>
      <dd className="mt-1 text-base font-semibold tabular-nums text-brand-ink">{valor}</dd>
      {variacion ? <p className="mt-0.5 text-xs"><Variacion item={variacion} /></p> : null}
      {nota ? <p className="mt-0.5 text-[11px] text-brand-muted">{nota}</p> : null}
      {ayuda ? <p className="text-[11px] text-brand-muted">{ayuda}</p> : null}
    </div>
  );
}

type TextoVariacionDetalleVista = { texto: string; tono: "sube" | "baja" | "igual" | "neutro" };

export function Variacion({ item }: { item: TextoVariacion | TextoVariacionDetalleVista }) {
  const color = item.tono === "sube" ? "#166534" : item.tono === "baja" ? "#B91C1C" : "#6B7280";
  const marca = item.tono === "sube" ? "▲ " : item.tono === "baja" ? "▼ " : "";
  return (
    <span className="font-semibold tabular-nums" style={{ color }}>
      {marca ? <span aria-hidden="true">{marca}</span> : null}
      {item.texto}
    </span>
  );
}
