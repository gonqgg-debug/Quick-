"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { DEFINICIONES_CONSUMO, participacion } from "@/lib/consumo-metricas";
import {
  COLUMNAS_EXTRA,
  DEFINICION_PARTICIPACION,
  DEFINICION_VARIACION,
  LIMITES_PAGINA,
  NOTA_RENTABILIDAD,
  claveLista,
  columnasGuardadas,
  consultaExportacion,
  coberturaCostos,
  describirPeriodo,
  detalleEstadoCosto,
  dinero,
  estadoCosto,
  etiquetaEstadoCosto,
  etiquetaTienda,
  formatPctPlano,
  leerConsultaProductos,
  margenAgregado,
  ordenBase,
  ordenEsAsc,
  ordenSiguiente,
  subtituloProducto,
  textoFuenteCosto,
  variacionAgregada,
  variacionProducto,
  type ColumnaExtra,
  type ConsultaProductos,
} from "@/lib/consumo-productos-ui";
import { formatUnidades, resolverPeriodo } from "@/lib/pos-domain";
import type { DetalleProducto, FrescuraConsumo, ProductoConsumo, ResumenProductos } from "@/lib/pos-consumo";
import type { EstadoComparacion } from "@/lib/consumo-metricas";
import type { ConsumoPeriodo } from "@/lib/pos-domain";
import { brand } from "@/lib/theme";
import { DataTableCell, DataTableHead, DataTableRow, DataTableTh } from "@/components/admin/DataTable";
import { BarraPeriodo, LineaDatos } from "@/components/admin/consumo/BarraPeriodo";
import { Definicion } from "@/components/admin/consumo/ui";
import { ProductoPanel, Variacion } from "@/components/admin/consumo/ProductoPanel";

const COLUMNAS_KEY = "analitica-productos-columnas";
const control =
  "h-9 rounded-md border border-[#E5E7EB] bg-white px-2.5 text-sm text-brand-ink focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30";

export type PayloadProductos = {
  rows: ProductoConsumo[];
  resumen: ResumenProductos;
  categorias: string[];
  frescura: FrescuraConsumo | null;
  comparacionEstado: EstadoComparacion;
  detalle: DetalleProducto | null;
  detalleError: string | null;
  detalleCodigo: string | null;
  periodo: ConsumoPeriodo;
  tiendas: string[];
};

export function ProductosAnalitica({ inicial, consultaInicial }: { inicial: PayloadProductos; consultaInicial: string }) {
  const [consulta, setConsulta] = useState(consultaInicial);
  const consultaRef = useRef(consultaInicial);
  const [data, setData] = useState(inicial);
  const [dataConsulta, setDataConsulta] = useState(consultaInicial);
  const [error, setError] = useState<string | null>(null);
  const req = useRef(0);
  const busqueda = useRef<HTMLInputElement>(null);
  const timer = useRef<number | null>(null);
  const params = useMemo(() => new URLSearchParams(consulta), [consulta]);
  const leida = useMemo(() => leerConsultaProductos(params, data.tiendas.length ? data.tiendas : inicial.tiendas), [params, data.tiendas, inicial.tiendas]);
  const listaPendiente = claveLista(consulta) !== claveLista(dataConsulta);
  const detalleCodigo = params.get("detalle");
  const detallePendiente = Boolean(detalleCodigo) && (listaPendiente || detalleCodigo !== data.detalleCodigo);
  const [qLocal, setQLocal] = useState(leida.q);
  const [columnas, setColumnas] = useState<ColumnaExtra[]>([]);

  useEffect(() => {
    const guardadas = columnasGuardadas(window.localStorage.getItem(COLUMNAS_KEY));
    if (guardadas) setColumnas(guardadas);
  }, []);

  useEffect(() => {
    if (document.activeElement === busqueda.current) return;
    setQLocal(leida.q);
  }, [leida.q]);

  useEffect(() => {
    const codigo = sessionStorage.getItem("analitica-foco-producto");
    if (!codigo || params.get("detalle") === codigo) return;
    sessionStorage.removeItem("analitica-foco-producto");
    document.getElementById(`producto-${encodeURIComponent(codigo)}`)?.focus();
  }, [consulta, params]);

  useEffect(() => {
    function onPop() {
      const texto = window.location.search.replace(/^\?/, "");
      consultaRef.current = texto;
      setConsulta(texto);
      void pedir(texto);
    }
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  async function pedir(texto: string) {
    const id = ++req.current;
    setError(null);
    try {
      const respuesta = await fetch(`/api/admin/consumo/productos?${texto}`, { cache: "no-store" });
      const json = (await respuesta.json()) as PayloadProductos & { error?: string };
      if (id !== req.current) return;
      if (!respuesta.ok) throw new Error(json.error || "No pudimos cargar los productos");
      setData(json);
      setDataConsulta(texto);
    } catch (causa) {
      if (id !== req.current) return;
      setError(causa instanceof Error ? causa.message : "No pudimos cargar los productos");
    }
  }

  function aplicar(patch: Record<string, string | null>) {
    const next = new URLSearchParams(consultaRef.current);
    for (const [key, value] of Object.entries(patch)) {
      if (value == null || value === "") next.delete(key);
      else next.set(key, value);
    }
    const texto = next.toString();
    consultaRef.current = texto;
    window.history.replaceState(null, "", `/admin/consumo/productos${texto ? `?${texto}` : ""}`);
    setConsulta(texto);
    void pedir(texto);
  }

  function cambiarPeriodo(preset: string) {
    if (preset === "custom") {
      aplicar({
        preset: "custom",
        desde: params.get("desde") || periodoVisible.desde,
        hasta: params.get("hasta") || periodoVisible.hasta,
        pagina: null,
      });
      return;
    }
    aplicar({ preset, desde: null, hasta: null, pagina: null });
  }

  const periodoVisible = listaPendiente
    ? resolverPeriodo({
        desde: params.get("desde"),
        hasta: params.get("hasta"),
        preset: params.get("preset"),
        comparar: params.get("comparar"),
        comparacion: params.get("comparacion"),
      })
    : data.periodo;
  const textoPeriodo = describirPeriodo(periodoVisible);
  const mostrarVariacion = !listaPendiente && (data.comparacionEstado === "ok" || data.comparacionEstado === "sin_base");
  const variacionTotal = listaPendiente
    ? null
    : variacionAgregada(data.comparacionEstado, data.resumen.ventaComparable, data.resumen.ventaAnterior);
  const filtrosActivos = Boolean(leida.categoria || leida.q || leida.sinCosto);
  const presetActual = params.get("preset") || periodoVisible.preset;
  const comparacionActual = params.get("comparar") === "0" ? "off" : params.get("comparacion") || periodoVisible.comparacion;
  const tiendas = data.tiendas.length > 0 ? data.tiendas : inicial.tiendas;
  const cobertura = coberturaCostos(data.resumen.ventaConCosto, data.resumen.venta);
  const margenPct = margenAgregado(data.resumen.margen, data.resumen.ventaNetaConCosto);
  const columnasVisibles = useMemo(() => new Set(columnas), [columnas]);
  const exportHref = `/api/admin/consumo/productos/export?${consultaExportacion(consulta)}`;
  const enlaceCompleto = detalleCodigo
    ? `/admin/consumo/productos/${encodeURIComponent(detalleCodigo)}?${consultaExportacion(consulta)}`
    : "/admin/consumo/productos";

  function toggleColumna(id: ColumnaExtra) {
    setColumnas((actual) => {
      const next = actual.includes(id) ? actual.filter((item) => item !== id) : [...actual, id];
      window.localStorage.setItem(COLUMNAS_KEY, JSON.stringify(next));
      return next;
    });
  }

  return (
    <div className="-mx-4 -mt-6 min-h-full bg-[#F4F5F3] px-4 pb-8 pt-5 md:-mx-6 md:px-6">
      <header>
        <nav aria-label="Miga de pan" className="text-xs text-brand-muted">
          <Link href="/admin/consumo" className="hover:text-brand-ink">
            Analítica
          </Link>
          <span aria-hidden="true"> / </span>
          <span className="text-brand-ink">Productos</span>
        </nav>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-brand-ink">Ventas por producto</h1>
            <p className="mt-1 max-w-2xl text-sm text-brand-muted">Encuentra qué se vende, qué deja utilidad y qué está cambiando.</p>
          </div>
          {tiendas.length > 1 ? (
            <label className="text-xs font-medium text-brand-muted">
              Tienda
              <select
                value={leida.tienda}
                onChange={(event) => aplicar({ tienda: event.target.value, pagina: null })}
                className={`mt-1 block ${control}`}
              >
                {tiendas.map((tienda) => (
                  <option key={tienda} value={tienda}>
                    {etiquetaTienda(tienda)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="rounded-md border border-[#E6E8E6] bg-white px-3 py-2 text-sm text-brand-ink">
              Tienda <span className="font-semibold">{etiquetaTienda(leida.tienda)}</span>
            </p>
          )}
        </div>
      </header>

      <BarraPeriodo
        presetActual={presetActual}
        comparacionActual={comparacionActual}
        desde={params.get("desde") || periodoVisible.desde}
        hasta={params.get("hasta") || periodoVisible.hasta}
        texto={textoPeriodo}
        comparacionNoDisponible={data.comparacionEstado === "no_disponible" && !listaPendiente}
        onPreset={cambiarPeriodo}
        onComparacion={(modo) =>
          aplicar(modo === "off" ? { comparar: "0", comparacion: "off", pagina: null } : { comparar: null, comparacion: modo, pagina: null })
        }
        onDesde={(fecha) => aplicar({ preset: "custom", desde: fecha || null, pagina: null })}
        onHasta={(fecha) => aplicar({ preset: "custom", hasta: fecha || null, pagina: null })}
      />
      <LineaDatos frescura={data.frescura} hasta={periodoVisible.hasta} />

      {error ? (
        <div className="mt-4 rounded-lg border border-[#FECACA] bg-white px-4 py-3 text-sm text-brand-error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => void pedir(consulta)} className="mt-2 font-semibold underline">
            Reintentar
          </button>
        </div>
      ) : (
        <section className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores">
          {listaPendiente ? (
            Array.from({ length: 4 }, (_, index) => <div key={index} className="h-[104px] animate-pulse rounded-lg bg-white" />)
          ) : (
            <>
              <Tarjeta
                etiqueta="Ventas"
                valor={dinero(data.resumen.venta)}
                nota="Con ITBIS"
                definicion={DEFINICIONES_CONSUMO.venta}
                extra={variacionTotal ? <Variacion item={variacionTotal} /> : null}
              />
              <Tarjeta
                etiqueta="Unidades vendidas"
                valor={formatUnidades(data.resumen.unidades)}
                nota={data.resumen.nProductos === 1 ? "1 producto distinto" : `${data.resumen.nProductos} productos distintos`}
                definicion="Unidades netas del conjunto filtrado, con las devoluciones restadas."
              />
              <Tarjeta
                etiqueta="Utilidad bruta calculada"
                valor={data.resumen.margen == null ? "—" : dinero(data.resumen.margen)}
                nota="Solo ventas con costo disponible"
                definicion={DEFINICIONES_CONSUMO.margen}
              />
              <Tarjeta
                etiqueta="Cobertura de costos"
                valor={formatPctPlano(cobertura)}
                nota={
                  data.resumen.nProductos === 0
                    ? "Sin ventas en el periodo"
                    : data.resumen.nSinCosto === 1
                      ? "1 producto vendido sin costo válido"
                      : `${data.resumen.nSinCosto} productos vendidos sin costo válido`
                }
                definicion={DEFINICIONES_CONSUMO.cobertura}
              />
            </>
          )}
        </section>
      )}

      <p className="mt-3 text-xs leading-5 text-brand-muted">
        {NOTA_RENTABILIDAD} <Definicion texto={DEFINICION_COSTO_CORTO} />
      </p>

      <section className="mt-3 overflow-hidden rounded-lg border border-[#E6E8E6] bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-[#EEF1EE] px-3 py-3">
          <div role="radiogroup" aria-label="Vista de la tabla" className="inline-flex rounded-md border border-[#E5E7EB] bg-[#F4F5F3] p-0.5">
            {(
              [
                ["ventas", "Ventas"],
                ["rentabilidad", "Rentabilidad"],
              ] as const
            ).map(([id, label]) => {
              const activo = leida.vista === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={activo}
                  onClick={() => aplicar({ vista: id === "ventas" ? null : id })}
                  className="rounded px-3 py-1.5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green"
                  style={{ backgroundColor: activo ? "#FFFFFF" : "transparent", color: activo ? brand.green : brand.ink }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <label className="relative min-w-[12rem] flex-1 text-sm">
            <span className="sr-only">Buscar producto</span>
            <input
              ref={busqueda}
              value={qLocal}
              onChange={(event) => {
                const value = event.target.value;
                setQLocal(value);
                if (timer.current) window.clearTimeout(timer.current);
                timer.current = window.setTimeout(() => aplicar({ q: value.trim() ? value : null, pagina: null }), 300);
              }}
              placeholder="Buscar nombre, SKU o código de barras"
              className={`w-full ${control}`}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-[#EEF1EE] px-3 py-2.5">
          <CategoriaSelect
            categorias={data.categorias}
            valor={leida.categoria}
            onChange={(categoria) => aplicar({ categoria, pagina: null })}
          />
          <button
            type="button"
            aria-pressed={leida.sinCosto}
            onClick={() => aplicar({ sin_costo: leida.sinCosto ? null : "1", pagina: null })}
            className="h-9 rounded-md border px-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green"
            style={{
              borderColor: leida.sinCosto ? brand.green : "#E5E7EB",
              backgroundColor: leida.sinCosto ? "#F1F7EA" : "#FFFFFF",
              color: brand.ink,
            }}
          >
            Sin costo
          </button>
          {filtrosActivos ? (
            <button
              type="button"
              onClick={() => {
                setQLocal("");
                aplicar({ q: null, categoria: null, sin_costo: null, pagina: null });
              }}
              className="h-9 px-2 text-sm font-semibold text-brand-ink underline-offset-2 hover:underline"
            >
              Limpiar filtros
            </button>
          ) : null}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <ColumnasMenu columnas={columnas} onToggle={toggleColumna} />
            <a
              href={exportHref}
              className="inline-flex h-9 items-center rounded-md border border-[#E5E7EB] bg-white px-3 text-sm font-semibold text-brand-ink hover:bg-[#F7F8F7]"
            >
              Exportar
            </a>
          </div>
        </div>
        <p className="px-3 py-2 text-xs text-brand-muted">
          {[leida.categoria, leida.q ? `“${leida.q}”` : "", leida.sinCosto ? "Sin costo" : "", textoPeriodo.rango].filter(Boolean).join(" · ")}
          {listaPendiente ? " · Actualizando" : ` · ${data.resumen.nProductos} ${data.resumen.nProductos === 1 ? "producto" : "productos"}`}
        </p>

        {error ? null : listaPendiente ? (
          <div className="h-80 animate-pulse bg-[#F7F8F7]" aria-hidden />
        ) : data.resumen.nProductos === 0 ? (
          <div className="px-5 py-14 text-center">
            <p className="text-base font-semibold text-brand-ink">{filtrosActivos ? "Ningún producto coincide con los filtros" : "No hay ventas en este periodo"}</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-brand-muted">
              {filtrosActivos ? "Quita la búsqueda, la categoría o el filtro de costo para ver el periodo completo." : "Prueba otro periodo. Un periodo sin ventas no se rellena con ceros de otro corte."}
            </p>
            {filtrosActivos ? (
              <button
                type="button"
                onClick={() => {
                  setQLocal("");
                  aplicar({ q: null, categoria: null, sin_costo: null, pagina: null });
                }}
                className="mt-4 h-9 rounded-md px-3 text-sm font-semibold text-white"
                style={{ backgroundColor: brand.green }}
              >
                Limpiar filtros
              </button>
            ) : null}
          </div>
        ) : (
          <div className="max-h-[72vh] overflow-auto">
            <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-sm [&_td]:border-b [&_td]:border-[#F1F5F9] [&_th]:border-b [&_th]:border-[#E5E7EB]">
              <caption className="sr-only">Ventas por producto del conjunto filtrado</caption>
              <DataTableHead plain>
                <DataTableTh scope="col" className="sticky left-0 top-0 z-30 min-w-[220px] bg-[#F9FAFB]">
                  Producto
                </DataTableTh>
                {columnasVisibles.has("categoria") ? <ThFija>Categoría</ThFija> : null}
                {columnasVisibles.has("marca") ? <ThFija>Marca</ThFija> : null}
                {columnasVisibles.has("sku") ? <ThFija>SKU</ThFija> : null}
                {leida.vista === "ventas" ? (
                  <>
                    <SortTh columna="unidades" orden={leida.orden} onSort={(columna) => aplicar({ orden: ordenSiguiente(leida.orden, columna), pagina: null })}>
                      Unidades vendidas
                    </SortTh>
                    <SortTh columna="venta" orden={leida.orden} onSort={(columna) => aplicar({ orden: ordenSiguiente(leida.orden, columna), pagina: null })}>
                      Ventas RD$
                    </SortTh>
                    <ThFija numeric>
                      Participación
                      <Definicion texto={DEFINICION_PARTICIPACION} />
                    </ThFija>
                  </>
                ) : (
                  <>
                    <SortTh columna="venta_neta" orden={leida.orden} onSort={(columna) => aplicar({ orden: ordenSiguiente(leida.orden, columna), pagina: null })}>
                      Ventas netas RD$
                    </SortTh>
                    <SortTh columna="costo_ventas" orden={leida.orden} onSort={(columna) => aplicar({ orden: ordenSiguiente(leida.orden, columna), pagina: null })}>
                      Costo de ventas RD$
                    </SortTh>
                    <SortTh columna="margen" orden={leida.orden} onSort={(columna) => aplicar({ orden: ordenSiguiente(leida.orden, columna), pagina: null })}>
                      Utilidad bruta RD$
                    </SortTh>
                    <SortTh columna="margen_pct" orden={leida.orden} onSort={(columna) => aplicar({ orden: ordenSiguiente(leida.orden, columna), pagina: null })}>
                      Margen bruto %
                    </SortTh>
                  </>
                )}
                {columnasVisibles.has("costoUnitario") ? <ThFija numeric>Costo unitario</ThFija> : null}
                {columnasVisibles.has("fuenteCosto") ? <ThFija>Fuente y fecha</ThFija> : null}
                {columnasVisibles.has("estadoCosto") ? <ThFija>Estado del costo</ThFija> : null}
                {leida.vista === "ventas" && mostrarVariacion ? (
                  <SortTh columna="variacion" orden={leida.orden} onSort={(columna) => aplicar({ orden: ordenSiguiente(leida.orden, columna), pagina: null })}>
                    Variación de ventas
                    <Definicion texto={DEFINICION_VARIACION} />
                  </SortTh>
                ) : null}
              </DataTableHead>
              <tbody>
                {data.rows.map((row) => (
                  <Fila
                    key={row.codigo}
                    row={row}
                    vista={leida.vista}
                    columnas={columnasVisibles}
                    ventaFiltro={data.resumen.venta}
                    estado={data.comparacionEstado}
                    mostrarVariacion={mostrarVariacion}
                    onOpen={(codigo) => {
                      sessionStorage.setItem("analitica-foco-producto", codigo);
                      aplicar({ detalle: codigo });
                    }}
                  />
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-[#E5E7EB] bg-[#F9FAFB] text-sm font-semibold text-brand-ink">
                  <DataTableCell className="sticky left-0 z-10 bg-[#F9FAFB]">Total del filtro</DataTableCell>
                  {columnasVisibles.has("categoria") ? <DataTableCell /> : null}
                  {columnasVisibles.has("marca") ? <DataTableCell /> : null}
                  {columnasVisibles.has("sku") ? <DataTableCell /> : null}
                  {leida.vista === "ventas" ? (
                    <>
                      <DataTableCell numeric>{formatUnidades(data.resumen.unidades)}</DataTableCell>
                      <DataTableCell numeric>{dinero(data.resumen.venta)}</DataTableCell>
                      <DataTableCell numeric>{data.resumen.venta > 0 ? "100%" : "—"}</DataTableCell>
                    </>
                  ) : (
                    <>
                      <DataTableCell numeric>{dinero(data.resumen.ventaNeta)}</DataTableCell>
                      <DataTableCell numeric>{data.resumen.costoVentas == null ? "—" : dinero(data.resumen.costoVentas)}</DataTableCell>
                      <DataTableCell numeric>{data.resumen.margen == null ? "—" : dinero(data.resumen.margen)}</DataTableCell>
                      <DataTableCell numeric>{formatPctPlano(margenPct)}</DataTableCell>
                    </>
                  )}
                  {columnasVisibles.has("costoUnitario") ? <DataTableCell /> : null}
                  {columnasVisibles.has("fuenteCosto") ? <DataTableCell /> : null}
                  {columnasVisibles.has("estadoCosto") ? (
                    <DataTableCell>{data.resumen.nSinCosto > 0 ? `${data.resumen.nSinCosto} sin costo` : "—"}</DataTableCell>
                  ) : null}
                  {leida.vista === "ventas" && mostrarVariacion ? (
                    <DataTableCell numeric>{variacionTotal ? <Variacion item={variacionTotal} /> : "—"}</DataTableCell>
                  ) : null}
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EEF1EE] px-3 py-3 text-sm">
          <p className="text-brand-muted" aria-live="polite">
            {listaPendiente
              ? "Actualizando resultados"
              : data.resumen.nProductos === 0
                ? "0 productos"
                : `${leida.offset + 1}–${Math.min(leida.offset + data.rows.length, data.resumen.nProductos)} de ${data.resumen.nProductos}`}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-medium text-brand-muted">
              Filas
              <select
                value={leida.limit}
                onChange={(event) => aplicar({ limit: event.target.value, pagina: null })}
                className={`ml-2 ${control}`}
              >
                {LIMITES_PAGINA.map((limite) => (
                  <option key={limite} value={limite}>
                    {limite}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={leida.pagina <= 1}
              onClick={() => aplicar({ pagina: String(leida.pagina - 1) })}
              className="h-9 rounded-md border border-[#E5E7EB] px-3 font-semibold disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={leida.offset + data.rows.length >= data.resumen.nProductos}
              onClick={() => aplicar({ pagina: String(leida.pagina + 1) })}
              className="h-9 rounded-md border border-[#E5E7EB] px-3 font-semibold disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      </section>

      {detalleCodigo ? (
        <ProductoPanel
          codigo={detalleCodigo}
          detalle={!detallePendiente && data.detalleCodigo === detalleCodigo ? data.detalle : null}
          error={!detallePendiente && data.detalleCodigo === detalleCodigo ? data.detalleError : null}
          cargando={detallePendiente}
          periodo={periodoVisible}
          mostrarComparacion={mostrarVariacion}
          tiendaEtiqueta={tiendas.length > 1 ? etiquetaTienda(leida.tienda) : null}
          enlaceCompleto={enlaceCompleto}
          onClose={() => aplicar({ detalle: null })}
        />
      ) : null}
    </div>
  );
}

const DEFINICION_COSTO_CORTO =
  "El costo de referencia es el manual, si existe, o el de la última factura. No es el costo del día de la venta. Sin costo no se reemplaza por cero.";

function Tarjeta({
  etiqueta,
  valor,
  nota,
  definicion,
  extra,
}: {
  etiqueta: string;
  valor: string;
  nota: string;
  definicion: string;
  extra?: React.ReactNode;
}) {
  return (
    <article className="rounded-lg border border-[#E6E8E6] bg-white px-3 py-3 shadow-sm">
      <h2 className="flex items-center text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
        {etiqueta}
        <Definicion texto={definicion} />
      </h2>
      <p className="mt-1 text-xl font-semibold tabular-nums text-brand-ink">{valor}</p>
      <p className="mt-1 text-xs text-brand-muted">{nota}</p>
      {extra ? <div className="mt-1 text-xs">{extra}</div> : null}
    </article>
  );
}

function ThFija({ children, numeric = false }: { children: React.ReactNode; numeric?: boolean }) {
  return (
    <DataTableTh numeric={numeric} scope="col" className="sticky top-0 z-20 bg-[#F9FAFB]">
      {children}
    </DataTableTh>
  );
}

function SortTh({
  columna,
  orden,
  onSort,
  children,
}: {
  columna: string;
  orden: string;
  onSort: (columna: string) => void;
  children: React.ReactNode;
}) {
  const activo = ordenBase(orden) === columna;
  const asc = ordenEsAsc(orden);
  return (
    <DataTableTh numeric scope="col" aria-sort={activo ? (asc ? "ascending" : "descending") : "none"} className="sticky top-0 z-20 bg-[#F9FAFB]">
      <button
        type="button"
        onClick={() => onSort(columna)}
        className="inline-flex items-center gap-1 font-semibold text-[#6B7280] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green"
      >
        {children}
        <span aria-hidden="true">{activo ? (asc ? "↑" : "↓") : ""}</span>
      </button>
    </DataTableTh>
  );
}

function Fila({
  row,
  vista,
  columnas,
  ventaFiltro,
  estado,
  mostrarVariacion,
  onOpen,
}: {
  row: ProductoConsumo;
  vista: ConsultaProductos["vista"];
  columnas: Set<ColumnaExtra>;
  ventaFiltro: number;
  estado: EstadoComparacion;
  mostrarVariacion: boolean;
  onOpen: (codigo: string) => void;
}) {
  const parte = participacion(row.venta, ventaFiltro);
  const subtitulo = subtituloProducto(row);
  const costo = estadoCosto(row.costoOrigen, row.costo);
  const variacion = variacionProducto(estado, row.variacion, row.ventaAnterior);
  const id = `producto-${encodeURIComponent(row.codigo)}`;
  return (
    <DataTableRow className="group">
      <DataTableCell className="sticky left-0 z-10 min-w-[220px] max-w-[320px] bg-white group-hover:bg-[#F7F8F7]">
        <button id={id} type="button" onClick={() => onOpen(row.codigo)} className="text-left font-semibold text-brand-ink hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green">
          {row.nombre}
        </button>
        {subtitulo ? <span className="mt-0.5 block text-xs font-normal text-brand-muted">{subtitulo}</span> : null}
      </DataTableCell>
      {columnas.has("categoria") ? <DataTableCell>{row.categoria}</DataTableCell> : null}
      {columnas.has("marca") ? <DataTableCell>{row.marca ?? "—"}</DataTableCell> : null}
      {columnas.has("sku") ? <DataTableCell>{row.codigo}</DataTableCell> : null}
      {vista === "ventas" ? (
        <>
          <DataTableCell numeric>{formatUnidades(row.unidades)}</DataTableCell>
          <DataTableCell numeric>{dinero(row.venta)}</DataTableCell>
          <DataTableCell numeric>
            <span className="inline-flex items-center justify-end gap-2">
              <span>{formatPctPlano(parte)}</span>
              <span className="h-1.5 w-14 overflow-hidden rounded-full bg-[#EEF1EE]" aria-hidden="true">
                <span className="block h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, (parte ?? 0) * 100))}%`, backgroundColor: brand.green }} />
              </span>
            </span>
          </DataTableCell>
        </>
      ) : (
        <>
          <DataTableCell numeric>{row.ventaNeta == null ? "—" : dinero(row.ventaNeta)}</DataTableCell>
          <DataTableCell numeric>{row.costo == null ? "Sin costo" : row.costoVentas == null ? "—" : dinero(row.costoVentas)}</DataTableCell>
          <DataTableCell numeric>{row.margen == null ? "—" : dinero(row.margen)}</DataTableCell>
          <DataTableCell numeric>{formatPctPlano(row.margenPct)}</DataTableCell>
        </>
      )}
      {columnas.has("costoUnitario") ? <DataTableCell numeric>{row.costo == null ? "Sin costo" : dinero(row.costo)}</DataTableCell> : null}
      {columnas.has("fuenteCosto") ? <DataTableCell>{textoFuenteCosto(row.costoOrigen, row.costoFecha, row.costoRef) ?? "—"}</DataTableCell> : null}
      {columnas.has("estadoCosto") ? (
        <DataTableCell>
          <span title={detalleEstadoCosto(costo)}>{etiquetaEstadoCosto(costo)}</span>
        </DataTableCell>
      ) : null}
      {vista === "ventas" && mostrarVariacion ? <DataTableCell numeric>{variacion ? <Variacion item={variacion} /> : "—"}</DataTableCell> : null}
    </DataTableRow>
  );
}

function CategoriaSelect({ categorias, valor, onChange }: { categorias: string[]; valor: string; onChange: (valor: string | null) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const listaId = useId();
  const visibles = categorias.filter((item) => item.toLowerCase().includes(busqueda.trim().toLowerCase()));
  useEffect(() => {
    if (!abierto) return;
    function onPointer(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [abierto]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={listaId}
        onClick={() => setAbierto((value) => !value)}
        className={`${control} min-w-[11rem] text-left`}
      >
        {valor || "Todas las categorías"}
      </button>
      {abierto ? (
        <div className="absolute z-30 mt-1 w-64 rounded-md border border-[#E5E7EB] bg-white p-2 shadow-sm">
          <input
            autoFocus
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar categoría"
            aria-label="Buscar categoría"
            className={`mb-2 w-full ${control}`}
          />
          <ul id={listaId} role="listbox" className="max-h-60 overflow-auto">
            <li>
              <button type="button" role="option" aria-selected={valor === ""} className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-[#F4F5F3]" onClick={() => { onChange(null); setAbierto(false); }}>
                Todas las categorías
              </button>
            </li>
            {visibles.map((item) => (
              <li key={item}>
                <button
                  type="button"
                  role="option"
                  aria-selected={valor === item}
                  className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-[#F4F5F3]"
                  onClick={() => {
                    onChange(item);
                    setAbierto(false);
                  }}
                >
                  {item}
                </button>
              </li>
            ))}
            {visibles.length === 0 ? <li className="px-2 py-2 text-sm text-brand-muted">Sin coincidencias</li> : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function ColumnasMenu({ columnas, onToggle }: { columnas: ColumnaExtra[]; onToggle: (id: ColumnaExtra) => void }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    function onPointer(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [abierto]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={abierto}
        aria-haspopup="true"
        onClick={() => setAbierto((value) => !value)}
        className="inline-flex h-9 items-center rounded-md border border-[#E5E7EB] bg-white px-3 text-sm font-semibold text-brand-ink"
      >
        Columnas
      </button>
      {abierto ? (
        <fieldset className="absolute right-0 z-30 mt-1 w-64 rounded-md border border-[#E5E7EB] bg-white p-3 shadow-sm">
          <legend className="sr-only">Columnas visibles</legend>
          <label className="flex items-center gap-2 py-1 text-sm text-brand-muted">
            <input type="checkbox" checked disabled /> Producto
          </label>
          {COLUMNAS_EXTRA.map((columna) => (
            <label key={columna.id} className="flex items-center gap-2 py-1 text-sm text-brand-ink">
              <input type="checkbox" checked={columnas.includes(columna.id)} onChange={() => onToggle(columna.id)} />
              {columna.label}
            </label>
          ))}
        </fieldset>
      ) : null}
    </div>
  );
}
