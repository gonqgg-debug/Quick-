"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { diasInclusivos } from "@/lib/consumo-metricas";
import { formatDayKey } from "@/lib/local-day";
import { DEFINICIONES, formatRd, formatUnidades, resolverPeriodo, TAMANOS_PAGINA, type ConsumoPeriodo, type OrdenConsumo } from "@/lib/pos-domain";
import type { FrescuraConsumo, ProductoConsumo, TotalesProductos } from "@/lib/pos-consumo";
import {
  COLUMNAS_EXTRA,
  COLUMNAS_VACIAS,
  coberturaVentas,
  etiquetaVariacion,
  etiquetaVariacionTotal,
  formatParticipacion,
  margenAgregado,
  secundarioProducto,
  textoOrigenCosto,
  estadoCosto,
  type ColumnaExtra,
  type VistaProductos,
} from "@/lib/productos-analitica";
import { Delta, Definicion } from "@/components/admin/consumo/ui";
import { ProductoPanel, VariacionTexto, type PanelProductoDatos } from "@/components/admin/consumo/ProductoPanel";
import { brand } from "@/lib/theme";

const CLAVE_COLUMNAS = "quick-analitica-columnas";

type Columna = "producto" | "unidades" | "venta" | "participacion" | "variacion" | "neta" | "costoVentas" | "utilidad" | "margen" | ColumnaExtra;

const ETIQUETAS: Record<Columna, string> = {
  producto: "Producto",
  unidades: "Unidades vendidas",
  venta: "Ventas RD$",
  participacion: "Participación",
  variacion: "Variación de ventas",
  neta: "Ventas netas RD$",
  costoVentas: "Costo de ventas RD$",
  utilidad: "Utilidad bruta RD$",
  margen: "Margen bruto %",
  categoria: "Categoría",
  marca: "Marca",
  sku: "SKU",
  costo: "Costo unitario de referencia",
  fuente: "Fuente y fecha del costo",
  estado: "Estado del costo",
};

export function ProductosAnalitica({
  rows,
  periodo,
  totales,
  totalesTramo,
  totalesAnterior,
  ventaPeriodo,
  orden,
  categoria,
  q,
  categorias,
  sinCosto,
  vista,
  pagina,
  tamano,
  frescura,
  panel,
  panelError,
}: {
  rows: ProductoConsumo[];
  periodo: ConsumoPeriodo;
  totales: TotalesProductos;
  totalesTramo: TotalesProductos | null;
  totalesAnterior: TotalesProductos | null;
  ventaPeriodo: number;
  orden: OrdenConsumo;
  categoria: string;
  q: string;
  categorias: string[];
  sinCosto: boolean;
  vista: VistaProductos;
  pagina: number;
  tamano: number;
  frescura: FrescuraConsumo | null;
  panel: PanelProductoDatos | null;
  panelError: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const [pending, startTransition] = useTransition();
  const [qDraft, setQDraft] = useState(q);
  const [columnas, setColumnas] = useState(COLUMNAS_VACIAS);
  const [panelCodigo, setPanelCodigo] = useState<string | null>(panel?.codigo ?? null);
  const foco = useRef<string | null>(null);

  useEffect(() => {
    setQDraft(q);
  }, [q]);

  useEffect(() => {
    try {
      const guardado = localStorage.getItem(CLAVE_COLUMNAS);
      if (!guardado) {
        return;
      }
      const parsed = JSON.parse(guardado) as Partial<Record<ColumnaExtra, boolean>>;
      setColumnas({ ...COLUMNAS_VACIAS, ...Object.fromEntries(COLUMNAS_EXTRA.map((col) => [col.id, parsed[col.id] === true])) });
    } catch {
      setColumnas(COLUMNAS_VACIAS);
    }
  }, []);

  useEffect(() => {
    if (!pending) {
      setPanelCodigo(panel?.codigo ?? null);
    }
  }, [panel, pending]);

  useEffect(() => {
    if (!panel && foco.current) {
      const codigo = foco.current;
      foco.current = null;
      document.querySelector<HTMLElement>(`[data-producto="${CSS.escape(codigo)}"]`)?.focus();
    }
  }, [panel]);

  const irRef = useRef<(patch: Record<string, string | null>, resetPagina?: boolean) => void>(() => undefined);

  function ir(patch: Record<string, string | null>, resetPagina = false) {
    const next = new URLSearchParams(paramsRef.current.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value == null || value === "") {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }
    if (resetPagina) {
      next.delete("pagina");
    }
    next.delete("cursor");
    startTransition(() => {
      router.push(`${pathname}?${next.toString()}`, { scroll: false });
    });
  }
  irRef.current = ir;

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (qDraft !== q) {
        irRef.current({ q: qDraft || null }, true);
      }
    }, 300);
    return () => window.clearTimeout(handle);
  }, [q, qDraft]);

  function guardarColumna(id: ColumnaExtra, activa: boolean) {
    const siguiente = { ...columnas, [id]: activa };
    setColumnas(siguiente);
    localStorage.setItem(CLAVE_COLUMNAS, JSON.stringify(siguiente));
  }

  const desfasado = pending || qDraft !== q;
  const filtrosActivos = Boolean(categoria || q || sinCosto);
  const comparar = periodo.comparar;
  const baseComparada = totalesTramo ?? (comparar ? totales : null);
  const cobertura = coberturaVentas(totales.ventaConCosto, totales.venta);
  const margenTotal = margenAgregado(totales.margen, totales.ventaNetaConCosto);
  const columnasTabla = useMemo(() => columnasDe(vista, comparar, columnas), [vista, comparar, columnas]);
  const total = totales.productos;
  const paginas = Math.max(1, Math.ceil(total / tamano));
  const inicio = total === 0 ? 0 : (pagina - 1) * tamano + 1;
  const fin = (pagina - 1) * tamano + rows.length;
  const exportQuery = useMemo(() => {
    const next = new URLSearchParams(params.toString());
    next.delete("pagina");
    next.delete("tamano");
    next.delete("producto");
    next.delete("cursor");
    next.delete("vista");
    return next.toString();
  }, [params]);

  function abrir(codigo: string) {
    setPanelCodigo(codigo);
    ir({ producto: codigo });
  }

  function cerrar() {
    foco.current = panelCodigo;
    setPanelCodigo(null);
    ir({ producto: null });
  }

  function ordenar(columna: "venta" | "unidades" | "margen" | "variacion") {
    const desc = columna;
    const asc = `${columna}_asc` as OrdenConsumo;
    ir({ orden: orden === desc ? asc : desc }, true);
  }

  return (
    <div className="analitica-productos space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <nav aria-label="Miga de pan" className="text-xs text-brand-muted">
            <Link href="/admin/consumo" className="hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green">
              Analítica
            </Link>
            <span aria-hidden="true"> / </span>
            <span className="text-[#1A1A1A]">Productos</span>
          </nav>
          <h1 className="mt-1 text-xl font-semibold text-[#1A1A1A]">Ventas por producto</h1>
          <p className="mt-0.5 text-sm text-brand-muted">Encuentra qué se vende, qué deja utilidad y qué está cambiando.</p>
        </div>
        <p className="text-sm text-[#1A1A1A]">
          <span className="text-brand-muted">Tienda activa. </span>Quick!
        </p>
      </header>

      <BarraPeriodo
        periodo={periodo}
        onPreset={(preset) => {
          const siguiente = resolverPeriodo({
            preset,
            comparar: params.get("comparar"),
            comparacion: params.get("comparacion"),
          });
          ir({ preset, desde: siguiente.desde, hasta: siguiente.hasta }, true);
        }}
        onComparacion={(modo) => {
          const patch: Record<string, string | null> = modo === "off" ? { comparar: "0", comparacion: null } : { comparar: null, comparacion: modo };
          if (modo === "off" && (orden === "variacion" || orden === "variacion_asc")) {
            patch.orden = null;
          }
          ir(patch, true);
        }}
        onFecha={(campo, valor) => ir({ preset: "custom", [campo]: valor || null }, true)}
      />

      <p className="text-xs text-brand-muted">
        {frescura?.ultimaFecha ? `Datos hasta ${formatDayKey(frescura.ultimaFecha)}.` : "Todavía no hay sesiones de caja."}
        {frescura?.ultimaFecha && frescura.ultimaFecha < periodo.hasta ? " La caja no cubre todo el periodo seleccionado." : ""}
        {" "}Moneda: RD$.
      </p>

      {desfasado ? <SkeletonCards /> : (
        <section aria-label="Indicadores" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Tarjeta
            titulo="Ventas"
            valor={formatRd(totales.venta)}
            nota="Incluye ITBIS"
            extra={comparar ? <Delta estado={baseComparada && totalesAnterior ? "ok" : "no_disponible"} actual={baseComparada?.venta ?? null} anterior={totalesAnterior?.venta ?? null} /> : null}
          />
          <Tarjeta titulo="Unidades vendidas" valor={formatUnidades(totales.unidades)} nota={cuentaProductos(totales.productos, "producto distinto", "productos distintos")} />
          <Tarjeta
            titulo="Utilidad bruta calculada"
            valor={totales.margen == null ? "—" : formatRd(totales.margen)}
            nota="Solo ventas con costo disponible"
            definicion={DEFINICIONES.margen}
          />
          <Tarjeta
            titulo="Cobertura de costos"
            valor={formatParticipacion(cobertura)}
            nota={totales.venta > 0 ? cuentaProductos(totales.sinCostoProductos, "producto vendido sin costo válido", "productos vendidos sin costo válido") : "Sin ventas para medir cobertura"}
            definicion={DEFINICIONES.cobertura}
          />
        </section>
      )}

      <p className="text-xs text-brand-muted">
        Ventas con ITBIS. La utilidad usa el costo vigente, no el costo del día de la venta, y solo donde hay costo.
        <Definicion texto="El margen del total divide la utilidad de las ventas con costo entre sus ventas netas. No promedia los porcentajes de cada producto ni reparte esa utilidad sobre las ventas sin costo. Cada línea usa su propia tasa de ITBIS." />
      </p>

      <section className="rounded-lg border border-[#E6EAE6] bg-white" aria-busy={desfasado}>
        <div className="flex flex-wrap items-center gap-2 border-b border-[#EEF1EE] px-3 py-2">
          <div className="inline-flex rounded-md border border-[#E6EAE6] p-0.5" role="tablist" aria-label="Vista">
            {(["ventas", "rentabilidad"] as const).map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={vista === id}
                onClick={() => ir({ vista: id === "ventas" ? null : id })}
                className="h-8 rounded px-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green"
                style={{ backgroundColor: vista === id ? brand.green : "transparent", color: vista === id ? "#fff" : brand.ink }}
              >
                {id === "ventas" ? "Ventas" : "Rentabilidad"}
              </button>
            ))}
          </div>
          <label className="min-w-[12rem] flex-1 text-sm">
            <span className="sr-only">Buscar producto</span>
            <input
              value={qDraft}
              onChange={(event) => setQDraft(event.target.value)}
              placeholder="Nombre, SKU o código de barras"
              className="h-9 w-full rounded-md border border-[#E6EAE6] px-3 text-sm focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30"
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-3 py-2">
          <CategoriaSelect valor={categoria} categorias={categorias} onChange={(valor) => ir({ categoria: valor || null }, true)} />
          <button
            type="button"
            aria-pressed={sinCosto}
            onClick={() => ir({ sin_costo: sinCosto ? null : "1" }, true)}
            className="h-9 rounded-md border px-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green"
            style={{ borderColor: sinCosto ? brand.green : "#E6EAE6", backgroundColor: sinCosto ? brand.paleGreen : "#fff" }}
          >
            Sin costo
          </button>
          {filtrosActivos ? (
            <button type="button" onClick={() => ir({ categoria: null, q: null, sin_costo: null }, true)} className="h-9 px-2 text-sm font-semibold text-[#3F6B1C] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green">
              Limpiar filtros
            </button>
          ) : null}
          <span className="ml-auto flex flex-wrap items-center gap-2">
            <Columnas columnas={columnas} onChange={guardarColumna} />
            {total > 0 ? (
              <a href={`/api/admin/consumo/productos/export?${exportQuery}`} className="inline-flex h-9 items-center rounded-md border border-[#E6EAE6] px-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green">
                Exportar
              </a>
            ) : (
              <span className="inline-flex h-9 items-center px-3 text-sm text-brand-muted">Exportar</span>
            )}
          </span>
        </div>
        <p className="px-3 pb-2 text-xs text-brand-muted">{resumenFiltros({ periodo, categoria, q, sinCosto, orden, vista })}</p>
        {totales.sinCostoProductos > 0 && totales.venta > 0 ? (
          <p className="mx-3 mb-2 rounded-md bg-[#F7F8F6] px-3 py-2 text-xs text-[#1A1A1A]">
            {totales.sinCostoProductos === 1
              ? "Costos incompletos: 1 producto vendido no entra en la utilidad. No se cuenta como costo cero."
              : `Costos incompletos: ${formatEntero(totales.sinCostoProductos)} productos vendidos no entran en la utilidad. No se cuentan como costo cero.`}
          </p>
        ) : null}
        {periodo.comparacion !== "off" && !comparar ? (
          <p className="mx-3 mb-2 text-xs text-brand-muted">Comparativo no disponible: el periodo todavía no tiene un día completo.</p>
        ) : null}
        {desfasado ? (
          <div className="space-y-2 px-3 pb-3" aria-hidden="true">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="h-8 animate-pulse rounded bg-[#E8EBE8]" />
            ))}
          </div>
        ) : total === 0 && !filtrosActivos ? (
          <Estado titulo="Sin ventas en el periodo" detalle="No hay productos vendidos entre estas fechas." />
        ) : total === 0 ? (
          <Estado titulo="Sin resultados" detalle="Ningún producto coincide con la búsqueda o los filtros." accion={<button type="button" onClick={() => ir({ categoria: null, q: null, sin_costo: null }, true)} className="mt-3 text-sm font-semibold text-[#3F6B1C]">Limpiar filtros</button>} />
        ) : rows.length === 0 ? (
          <Estado titulo="Esta página no tiene filas" detalle="El conjunto filtrado sigue teniendo resultados en otra página." accion={<button type="button" onClick={() => ir({ pagina: null })} className="mt-3 text-sm font-semibold text-[#3F6B1C]">Volver al inicio</button>} />
        ) : (
          <div className="max-h-[min(70vh,840px)] overflow-auto">
            <table className="w-full min-w-[760px] border-separate border-spacing-0 text-sm">
              <caption className="sr-only">Ventas por producto del conjunto filtrado</caption>
              <thead className="sticky top-0 z-20 bg-[#F7F8F6] text-left text-xs font-semibold text-brand-muted">
                <tr>
                  {columnasTabla.map((columna) => (
                    <th
                      key={columna}
                      scope="col"
                      aria-sort={ariaSort(columna, orden)}
                      className={`sticky top-0 border-b border-[#E6EAE6] bg-[#F7F8F6] px-3 py-2 ${columna === "producto" ? "left-0 z-30 min-w-[220px]" : "text-right"} ${numerica(columna) ? "tabular-nums" : ""}`}
                    >
                      {ordenable(columna, comparar) ? (
                        <button type="button" onClick={() => ordenar(campoOrden(columna))} className={`inline-flex items-center gap-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green ${columna === "producto" ? "" : "ml-auto"}`}>
                          {ETIQUETAS[columna]}
                          <span aria-hidden="true">{marcaOrden(columna, orden)}</span>
                        </button>
                      ) : (
                        <span className="inline-flex items-center">
                          {ETIQUETAS[columna]}
                          {columna === "participacion" ? <Definicion texto="Venta con ITBIS de este producto dividida entre la venta con ITBIS de todo el conjunto filtrado, antes de paginar." /> : null}
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.codigo} className="group border-b border-[#F3F4F6]">
                    {columnasTabla.map((columna) => (
                      <td
                        key={columna}
                        className={`border-b border-[#F3F4F6] px-3 py-2 align-middle group-hover:bg-[#F7F8F6] ${columna === "producto" ? "sticky left-0 z-10 bg-white group-hover:bg-[#F7F8F6]" : "text-right tabular-nums"}`}
                      >
                        <Celda columna={columna} row={row} denominador={totales.venta} comparar={comparar} onAbrir={abrir} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 z-20 bg-[#F7F8F6] text-xs font-semibold">
                <tr>
                  {columnasTabla.map((columna) => (
                    <td key={columna} className={`border-t border-[#E6EAE6] px-3 py-2 ${columna === "producto" ? "sticky left-0 z-30 bg-[#F7F8F6]" : "text-right tabular-nums"}`}>
                      <Total columna={columna} totales={totales} margenTotal={margenTotal} comparar={comparar} base={baseComparada} anterior={totalesAnterior} />
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#EEF1EE] px-3 py-2 text-sm">
          <p className="text-brand-muted" aria-live="polite">
            {total === 0 ? "0 resultados" : `${inicio}–${fin} de ${formatEntero(total)} resultados`}
            {vista === "rentabilidad" && totales.margen != null ? " · el total de margen usa solo ventas netas con costo" : ""}
          </p>
          <div className="flex items-center gap-2">
            <label className="text-xs text-brand-muted">
              Filas
              <select value={tamano} onChange={(event) => ir({ tamano: event.target.value === "50" ? null : event.target.value }, true)} className="ml-1 h-9 rounded-md border border-[#E6EAE6] bg-white px-2 text-sm focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30">
                {TAMANOS_PAGINA.map((opcion) => (
                  <option key={opcion} value={opcion}>{opcion}</option>
                ))}
              </select>
            </label>
            <button type="button" disabled={pagina <= 1} onClick={() => ir({ pagina: pagina <= 2 ? null : String(pagina - 1) })} className="h-9 rounded-md border border-[#E6EAE6] px-3 text-sm font-semibold disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green">
              Anterior
            </button>
            <span className="tabular-nums text-brand-muted">{Math.min(pagina, paginas)} / {paginas}</span>
            <button type="button" disabled={pagina >= paginas} onClick={() => ir({ pagina: String(pagina + 1) })} className="h-9 rounded-md border border-[#E6EAE6] px-3 text-sm font-semibold disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green">
              Siguiente
            </button>
          </div>
        </div>
      </section>

      {panelError ? <p className="text-sm text-brand-error">{panelError}</p> : null}
      {panelCodigo ? (
        <ProductoPanel
          producto={panel && panel.codigo === panelCodigo && !desfasado ? panel : null}
          periodo={`${formatDayKey(periodo.desde)} – ${formatDayKey(periodo.hasta)}`}
          comparar={comparar}
          cargando={desfasado || !panel || panel.codigo !== panelCodigo}
          onClose={cerrar}
        />
      ) : null}
    </div>
  );
}

function Tarjeta({ titulo, valor, nota, extra, definicion }: { titulo: string; valor: string; nota: string; extra?: ReactNode; definicion?: string }) {
  return (
    <article className="rounded-lg border border-[#E6EAE6] bg-white px-3 py-2.5">
      <h2 className="flex items-center text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
        {titulo}
        {definicion ? <Definicion texto={definicion} /> : null}
      </h2>
      <p className="mt-1 text-lg font-semibold tabular-nums text-[#1A1A1A]">{valor}</p>
      <p className="text-xs text-brand-muted">{nota}</p>
      {extra ? <div className="mt-1">{extra}</div> : null}
    </article>
  );
}

function SkeletonCards() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="h-[92px] animate-pulse rounded-lg bg-[#E8EBE8]" />
      ))}
    </div>
  );
}

function Estado({ titulo, detalle, accion }: { titulo: string; detalle: string; accion?: ReactNode }) {
  return (
    <div className="px-4 py-10 text-center">
      <p className="font-semibold text-[#1A1A1A]">{titulo}</p>
      <p className="mt-1 text-sm text-brand-muted">{detalle}</p>
      {accion}
    </div>
  );
}

function BarraPeriodo({
  periodo,
  onPreset,
  onComparacion,
  onFecha,
}: {
  periodo: ConsumoPeriodo;
  onPreset: (preset: string) => void;
  onComparacion: (modo: string) => void;
  onFecha: (campo: "desde" | "hasta", valor: string) => void;
}) {
  const dias = diasInclusivos(periodo.desde, periodo.hasta);
  const comparacion = periodo.comparacion === "off" || !periodo.comparar ? "off" : periodo.comparacion;
  return (
    <div className="rounded-lg border border-[#E6EAE6] bg-white px-3 py-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs font-medium text-brand-muted">
          Periodo
          <select value={periodo.preset} onChange={(event) => onPreset(event.target.value)} className="mt-1 block h-9 rounded-md border border-[#E6EAE6] bg-white px-2 text-sm text-[#1A1A1A] focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30">
            <option value="7d">7 días</option>
            <option value="30d">30 días</option>
            <option value="mes">Este mes</option>
            <option value="mes_anterior">Mes anterior</option>
            <option value="custom">Personalizado</option>
          </select>
        </label>
        <label className="text-xs font-medium text-brand-muted">
          Comparación
          <select value={comparacion} onChange={(event) => onComparacion(event.target.value)} className="mt-1 block h-9 rounded-md border border-[#E6EAE6] bg-white px-2 text-sm text-[#1A1A1A] focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30">
            <option value="anterior">Periodo anterior</option>
            <option value="semana">Mismos días de la semana</option>
            <option value="anio">Año anterior</option>
            <option value="off">Sin comparación</option>
          </select>
        </label>
        {periodo.preset === "custom" ? (
          <>
            <label className="text-xs font-medium text-brand-muted">
              Desde
              <input type="date" value={periodo.desde} onChange={(event) => onFecha("desde", event.target.value)} className="mt-1 block h-9 rounded-md border border-[#E6EAE6] px-2 text-sm focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30" />
            </label>
            <label className="text-xs font-medium text-brand-muted">
              Hasta
              <input type="date" value={periodo.hasta} onChange={(event) => onFecha("hasta", event.target.value)} className="mt-1 block h-9 rounded-md border border-[#E6EAE6] px-2 text-sm focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30" />
            </label>
          </>
        ) : null}
      </div>
      <p className="mt-2 text-xs text-brand-muted">{textoPeriodo(periodo, dias)}</p>
    </div>
  );
}

function textoPeriodo(periodo: ConsumoPeriodo, dias: number): string {
  const principal = `${formatDayKey(periodo.desde)} – ${formatDayKey(periodo.hasta)} · ${dias} ${dias === 1 ? "día" : "días"}`;
  if (!periodo.comparar || !periodo.tramo) {
    if (periodo.comparacion !== "off" && !periodo.comparar) {
      return `${principal}. La tabla incluye el día en curso. La comparación espera a que ese día cierre.`;
    }
    return `${principal}. ${periodo.recortado ? "Incluye hoy. " : ""}Sin comparación.`;
  }
  const comparadoDias = diasInclusivos(periodo.anterior.desde, periodo.anterior.hasta);
  const tramoDias = diasInclusivos(periodo.tramo.desde, periodo.tramo.hasta);
  const comparado = `Comparado con ${formatDayKey(periodo.anterior.desde)} – ${formatDayKey(periodo.anterior.hasta)} · ${comparadoDias} días completos`;
  if (periodo.recortado) {
    return `Tabla: ${principal}, incluye hoy. Comparación efectiva: ${formatDayKey(periodo.tramo.desde)} – ${formatDayKey(periodo.tramo.hasta)} · ${tramoDias} días completos. ${comparado}. Hoy queda fuera de la comparación.`;
  }
  return `${principal} completos. ${comparado}.`;
}

function CategoriaSelect({ valor, categorias, onChange }: { valor: string; categorias: string[]; onChange: (valor: string) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function fuera(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);
  const visibles = categorias.filter((item) => item.toLowerCase().includes(busqueda.trim().toLowerCase()));
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-expanded={abierto} aria-haspopup="listbox" onClick={() => setAbierto((value) => !value)} className="h-9 rounded-md border border-[#E6EAE6] bg-white px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green">
        {valor || "Todas las categorías"}
      </button>
      {abierto ? (
        <div className="absolute z-30 mt-1 w-64 rounded-lg border border-[#E6EAE6] bg-white p-2 shadow-sm">
          <input autoFocus value={busqueda} onChange={(event) => setBusqueda(event.target.value)} aria-label="Buscar categoría" placeholder="Buscar categoría" className="h-9 w-full rounded-md border border-[#E6EAE6] px-2 text-sm focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/30" />
          <ul role="listbox" aria-label="Categorías" className="mt-1 max-h-56 overflow-auto">
            <li>
              <button type="button" role="option" aria-selected={valor === ""} onClick={() => { onChange(""); setAbierto(false); setBusqueda(""); }} className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-[#F7F8F6]">Todas</button>
            </li>
            {visibles.map((item) => (
              <li key={item}>
                <button type="button" role="option" aria-selected={item === valor} onClick={() => { onChange(item); setAbierto(false); setBusqueda(""); }} className="block w-full rounded px-2 py-1.5 text-left text-sm hover:bg-[#F7F8F6]">{item}</button>
              </li>
            ))}
            {visibles.length === 0 ? <li className="px-2 py-2 text-xs text-brand-muted">Ninguna categoría coincide</li> : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Columnas({ columnas, onChange }: { columnas: Record<ColumnaExtra, boolean>; onChange: (id: ColumnaExtra, activa: boolean) => void }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function fuera(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-expanded={abierto} onClick={() => setAbierto((value) => !value)} className="h-9 rounded-md border border-[#E6EAE6] px-3 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green">
        Columnas
      </button>
      {abierto ? (
        <div className="absolute right-0 z-30 mt-1 w-64 rounded-lg border border-[#E6EAE6] bg-white p-2 shadow-sm">
          <label className="flex items-center gap-2 px-1 py-1 text-sm text-brand-muted">
            <input type="checkbox" checked disabled /> Producto
          </label>
          {COLUMNAS_EXTRA.map((columna) => (
            <label key={columna.id} className="flex items-center gap-2 px-1 py-1 text-sm">
              <input type="checkbox" checked={columnas[columna.id]} onChange={(event) => onChange(columna.id, event.target.checked)} />
              {columna.etiqueta}
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Celda({
  columna,
  row,
  denominador,
  comparar,
  onAbrir,
}: {
  columna: Columna;
  row: ProductoConsumo;
  denominador: number;
  comparar: boolean;
  onAbrir: (codigo: string) => void;
}) {
  if (columna === "producto") {
    const secundario = secundarioProducto(row);
    const extra = row.matchEstado === "sin_match" ? (secundario ? `${secundario} · Sin match` : "Sin match") : secundario;
    return (
      <div>
        <button type="button" data-producto={row.codigo} onClick={() => onAbrir(row.codigo)} className="text-left font-semibold text-[#1A1A1A] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green">
          {row.nombre}
        </button>
        {extra ? <span className="mt-0.5 block text-xs font-normal text-brand-muted">{extra}</span> : null}
      </div>
    );
  }
  if (columna === "unidades") return formatUnidades(row.unidades);
  if (columna === "venta") return formatRd(row.venta);
  if (columna === "participacion") {
    const parte = denominador > 0 ? row.venta / denominador : null;
    const ancho = parte == null ? 0 : Math.max(0, Math.min(100, parte * 100));
    return (
      <span className="inline-flex items-center justify-end gap-2">
        <span className="w-14">{formatParticipacion(parte)}</span>
        <span className="h-1.5 w-14 overflow-hidden rounded-full bg-[#EEF1EE]" aria-hidden="true">
          <span className="block h-full" style={{ width: `${ancho}%`, backgroundColor: brand.green }} />
        </span>
      </span>
    );
  }
  if (columna === "variacion") {
    return comparar ? <VariacionTexto etiqueta={etiquetaVariacion(row.ventaAnterior, row.variacion)} /> : "—";
  }
  if (columna === "neta") return formatRd(row.ventaNeta);
  if (columna === "costoVentas") return row.costoVentas == null ? "Sin costo" : formatRd(row.costoVentas);
  if (columna === "utilidad") return row.margen == null ? "—" : formatRd(row.margen);
  if (columna === "margen") return formatParticipacion(row.margenPct);
  if (columna === "categoria") return row.categoria;
  if (columna === "marca") return row.marca || "—";
  if (columna === "sku") return row.codigo.startsWith("__export__") ? "—" : row.codigo;
  if (columna === "costo") return row.costo == null ? "Sin costo" : formatRd(row.costo);
  if (columna === "fuente") {
    return row.costo == null ? "—" : `${textoOrigenCosto(row.costoOrigen)}${row.costoFecha ? ` · ${formatDayKey(row.costoFecha)}` : ""}`;
  }
  return estadoCosto(row.costo);
}

function Total({
  columna,
  totales,
  margenTotal,
  comparar,
  base,
  anterior,
}: {
  columna: Columna;
  totales: TotalesProductos;
  margenTotal: number | null;
  comparar: boolean;
  base: TotalesProductos | null;
  anterior: TotalesProductos | null;
}) {
  if (columna === "producto") return "Total del filtro";
  if (columna === "unidades") return formatUnidades(totales.unidades);
  if (columna === "venta") return formatRd(totales.venta);
  if (columna === "participacion") return totales.venta > 0 ? "100%" : "—";
  if (columna === "variacion") {
    return comparar ? <VariacionTexto etiqueta={etiquetaVariacionTotal(base?.venta ?? null, anterior?.venta ?? null)} /> : "—";
  }
  if (columna === "neta") return formatRd(totales.ventaNeta);
  if (columna === "costoVentas") return totales.costoVentas == null ? "—" : formatRd(totales.costoVentas);
  if (columna === "utilidad") return totales.margen == null ? "—" : formatRd(totales.margen);
  if (columna === "margen") return formatParticipacion(margenTotal);
  return "";
}

function columnasDe(vista: VistaProductos, comparar: boolean, extras: Record<ColumnaExtra, boolean>): Columna[] {
  const base: Columna[] = vista === "rentabilidad"
    ? ["producto", "neta", "costoVentas", "utilidad", "margen"]
    : ["producto", "unidades", "venta", "participacion", ...(comparar ? (["variacion"] as const) : [])];
  return [...base, ...COLUMNAS_EXTRA.filter((columna) => extras[columna.id]).map((columna) => columna.id)];
}

function numerica(columna: Columna): boolean {
  return columna !== "producto" && columna !== "categoria" && columna !== "marca" && columna !== "sku" && columna !== "fuente" && columna !== "estado";
}

function ordenable(columna: Columna, comparar: boolean): boolean {
  if (columna === "venta" || columna === "unidades") return true;
  if (columna === "utilidad" || columna === "margen") return true;
  return columna === "variacion" && comparar;
}

function campoOrden(columna: Columna): "venta" | "unidades" | "margen" | "variacion" {
  if (columna === "unidades") return "unidades";
  if (columna === "utilidad" || columna === "margen") return "margen";
  if (columna === "variacion") return "variacion";
  return "venta";
}

function ariaSort(columna: Columna, orden: OrdenConsumo): "ascending" | "descending" | "none" | undefined {
  const campo = campoOrden(columna);
  if (!ordenable(columna, true) && columna !== "variacion") {
    return undefined;
  }
  if (orden === campo) return "descending";
  if (orden === `${campo}_asc`) return "ascending";
  return "none";
}

function marcaOrden(columna: Columna, orden: OrdenConsumo): string {
  const campo = campoOrden(columna);
  if (orden === campo) return "↓";
  if (orden === `${campo}_asc`) return "↑";
  return "";
}

function resumenFiltros(input: { periodo: ConsumoPeriodo; categoria: string; q: string; sinCosto: boolean; orden: OrdenConsumo; vista: VistaProductos }): string {
  const partes = [
    `${formatDayKey(input.periodo.desde)} – ${formatDayKey(input.periodo.hasta)}`,
    input.vista === "rentabilidad" ? "Rentabilidad" : "Ventas",
    etiquetaOrden(input.orden),
  ];
  if (input.categoria) partes.push(input.categoria);
  if (input.q) partes.push(`“${input.q}”`);
  if (input.sinCosto) partes.push("Sin costo");
  return partes.join(" · ");
}

function etiquetaOrden(orden: OrdenConsumo): string {
  const nombres: Record<OrdenConsumo, string> = {
    venta: "Ventas, mayor a menor",
    venta_asc: "Ventas, menor a mayor",
    unidades: "Unidades, mayor a menor",
    unidades_asc: "Unidades, menor a mayor",
    margen: "Utilidad, mayor a menor",
    margen_asc: "Utilidad, menor a mayor",
    variacion: "Variación, mayor a menor",
    variacion_asc: "Variación, menor a mayor",
  };
  return nombres[orden];
}

function formatEntero(value: number): string {
  return new Intl.NumberFormat("es-DO", { maximumFractionDigits: 0 }).format(value);
}

function cuentaProductos(cantidad: number, uno: string, varios: string): string {
  return `${formatEntero(cantidad)} ${cantidad === 1 ? uno : varios}`;
}
