"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { BarraPeriodo, LineaDatos, controlPeriodo } from "@/components/admin/consumo/BarraPeriodo";
import { EvolucionVentas } from "@/components/admin/consumo/EvolucionVentas";
import { etiquetaTipo } from "@/components/admin/consumo/MilesFicha";
import { ProductoPanel, Variacion } from "@/components/admin/consumo/ProductoPanel";
import { Definicion } from "@/components/admin/consumo/ui";
import { DEFINICIONES_CONSUMO, diasInclusivos } from "@/lib/consumo-metricas";
import {
  describirPeriodo,
  dinero,
  etiquetaTienda,
  formatPctPlano,
  claveLista,
  subtituloProducto,
  variacionProducto,
} from "@/lib/consumo-productos-ui";
import {
  avisoCobertura,
  cascadaVenta,
  coberturaObservada,
  consultaCompartida,
  diferenciaPagos,
  franjasHorario,
  hrefAnalitica,
  serieEvolucion,
  textoAlcance,
  variacionConUnidad,
  variacionUtilidad,
  type CascadaVenta,
  type FranjaHorario,
  type PuntoSerie,
} from "@/lib/consumo-resumen-ui";
import { formatoInstante } from "@/lib/miles-presentacion";
import { formatNumero, formatRd, formatUnidades, resolverPeriodo } from "@/lib/pos-domain";
import type { DetalleProducto, ProductoConsumo, ResumenConsumo } from "@/lib/pos-consumo";
import type { HallazgoDestacado } from "@/lib/consumo-resumen-ui";
import { brand } from "@/lib/theme";

export type PayloadResumen = {
  resumen: ResumenConsumo;
  miles: { destacados: HallazgoDestacado[]; recomendaciones: number } | null;
  tiendas: string[];
  tienda: string;
  detalle: DetalleProducto | null;
  detalleError: string | null;
  detalleCodigo: string | null;
};

const MEDIOS = [
  { id: "efectivo", nombre: "Efectivo", color: "#7EB341" },
  { id: "tarjeta", nombre: "Tarjeta", color: "#1F82C5" },
  { id: "banco", nombre: "Banco", color: "#111827" },
  { id: "credito", nombre: "Crédito", color: "#F79521" },
  { id: "otro", nombre: "Otro", color: "#D1D5DB" },
] as const;

const DIAS = ["", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const AYUDA_CAMBIO =
  "El cambio usa la venta con ITBIS y la cantidad de tickets, sin redondear el ticket. El efecto de tickets es la diferencia de tickets por el ticket promedio anterior. El efecto de ticket promedio es la diferencia de ticket por los tickets actuales. El centavo de redondeo se asigna al efecto de mayor valor absoluto. Los porcentajes de variación no se suman.";

export function ResumenAnalitica({ inicial, consultaInicial }: { inicial: PayloadResumen; consultaInicial: string }) {
  const [consulta, setConsulta] = useState(consultaInicial);
  const consultaRef = useRef(consultaInicial);
  const [data, setData] = useState(inicial);
  const [dataConsulta, setDataConsulta] = useState(consultaInicial);
  const dataConsultaRef = useRef(consultaInicial);
  const [error, setError] = useState<string | null>(null);
  const [vistaProductos, setVistaProductos] = useState<"ventas" | "utilidad">("ventas");
  const req = useRef(0);
  const params = useMemo(() => new URLSearchParams(consulta), [consulta]);
  const listaPendiente = claveLista(consulta) !== claveLista(dataConsulta);
  const detalleCodigo = params.get("detalle");
  const detallePendiente = Boolean(detalleCodigo) && (listaPendiente || detalleCodigo !== data.detalleCodigo);
  const fresco = !listaPendiente;

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
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  async function pedir(texto: string) {
    const id = ++req.current;
    setError(null);
    try {
      const respuesta = await fetch(`/api/admin/consumo/resumen?${texto}`, { cache: "no-store" });
      const json = (await respuesta.json().catch(() => ({}))) as PayloadResumen & { error?: string };
      if (id !== req.current) return;
      if (!respuesta.ok || !json.resumen) throw new Error(json.error || "No pudimos cargar el resumen");
      setData(json);
      dataConsultaRef.current = texto;
      setDataConsulta(texto);
    } catch (causa) {
      if (id !== req.current) return;
      const message = causa instanceof Error ? causa.message : "No pudimos cargar el resumen";
      const detalle = new URLSearchParams(texto).get("detalle");
      if (detalle && claveLista(texto) === claveLista(dataConsultaRef.current)) {
        setData((prev) => ({ ...prev, detalle: null, detalleError: message, detalleCodigo: detalle }));
        setError(null);
        return;
      }
      setError(message);
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
    window.history.replaceState(null, "", `/admin/consumo${texto ? `?${texto}` : ""}`);
    setConsulta(texto);
    void pedir(texto);
  }

  function cambiarPeriodo(preset: string) {
    if (preset === "custom") {
      aplicar({
        preset: "custom",
        desde: params.get("desde") || periodoVisible.desde,
        hasta: params.get("hasta") || periodoVisible.hasta,
        detalle: null,
      });
      return;
    }
    aplicar({ preset, desde: null, hasta: null, detalle: null });
  }

  const periodoVisible = listaPendiente
    ? resolverPeriodo({
        desde: params.get("desde"),
        hasta: params.get("hasta"),
        preset: params.get("preset"),
        comparar: params.get("comparar"),
        comparacion: params.get("comparacion"),
      })
    : data.resumen.periodo;
  const textoPeriodo = describirPeriodo(periodoVisible);
  const presetActual = params.get("preset") || periodoVisible.preset;
  const comparacionActual = params.get("comparar") === "0" ? "off" : params.get("comparacion") || periodoVisible.comparacion;
  const tiendas = data.tiendas.length > 0 ? data.tiendas : inicial.tiendas;
  const tiendaActiva = params.get("tienda") || data.tienda;
  const resumen = data.resumen;
  const comparable = resumen.kpisComparados;
  const anterior = resumen.anterior;
  const estado = resumen.comparacionEstado;
  const sinSesiones = fresco && resumen.dias.length === 0;
  const coberturaDias = fresco ? coberturaObservada(resumen.dias.map((dia) => dia.fecha), resumen.periodo.desde, resumen.periodo.hasta) : null;
  const serie = useMemo(
    () =>
      serieEvolucion({
        desde: resumen.periodo.desde,
        hasta: resumen.periodo.hasta,
        dias: resumen.dias,
        diasComparados: resumen.diasAnterior,
        comparacion: resumen.periodo.comparacion,
        tramo: resumen.periodo.tramo,
        anterior: resumen.periodo.anterior,
        mostrarComparacion: estado === "ok" || estado === "sin_base",
      }),
    [resumen, estado],
  );
  const cascada =
    fresco && estado === "ok" && comparable && anterior
      ? cascadaVenta({ venta: comparable.venta, tickets: comparable.ordenes }, { venta: anterior.venta, tickets: anterior.ordenes })
      : null;
  const avisoUtilidad = fresco && (estado === "ok" || estado === "sin_base") && comparable && anterior ? avisoCobertura(comparable.cobertura, anterior.cobertura) : null;
  const productos = vistaProductos === "utilidad" ? resumen.topMargen.filter((row) => row.margen != null).slice(0, 5) : resumen.top.slice(0, 5);
  const franjas = useMemo(() => franjasHorario(resumen.horas), [resumen.horas]);
  const diferencia = fresco ? diferenciaPagos(resumen.mix, resumen.kpis.venta) : 0;
  const muestraCorta = fresco && diasInclusivos(resumen.periodo.desde, resumen.periodo.hasta) <= 7;

  function analizarPunto(punto: PuntoSerie) {
    aplicar({ preset: "custom", desde: punto.desde, hasta: punto.hasta, detalle: null });
  }

  function cerrarProducto() {
    if (detalleCodigo) sessionStorage.setItem("analitica-foco-producto", detalleCodigo);
    aplicar({ detalle: null });
  }

  return (
    <div className="-mx-4 -mt-6 min-h-full bg-[#F4F5F3] px-4 pb-8 pt-5 md:-mx-6 md:px-6">
      <header>
        <nav aria-label="Miga de pan" className="text-xs text-brand-muted">
          <span>Analítica</span>
          <span aria-hidden="true"> / </span>
          <span className="text-brand-ink">Resumen</span>
        </nav>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-brand-ink">Resumen del negocio</h1>
          {tiendas.length > 1 ? (
            <label className="text-xs font-medium text-brand-muted">
              Tienda
              <select value={tiendaActiva} onChange={(event) => aplicar({ tienda: event.target.value, detalle: null })} className={`mt-1 block ${controlPeriodo}`}>
                {tiendas.map((tienda) => (
                  <option key={tienda} value={tienda}>
                    {etiquetaTienda(tienda)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="rounded-md border border-[#E6E8E6] bg-white px-3 py-2 text-sm text-brand-ink">
              Tienda <span className="font-semibold">{etiquetaTienda(tiendaActiva)}</span>
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
        comparacionNoDisponible={estado === "no_disponible" && !listaPendiente}
        onPreset={cambiarPeriodo}
        onComparacion={(modo) => aplicar(modo === "off" ? { comparar: "0", comparacion: "off", detalle: null } : { comparar: null, comparacion: modo, detalle: null })}
        onDesde={(fecha) => aplicar({ preset: "custom", desde: fecha || null, detalle: null })}
        onHasta={(fecha) => aplicar({ preset: "custom", hasta: fecha || null, detalle: null })}
      />
      <LineaDatos frescura={data.resumen.frescura} hasta={periodoVisible.hasta} />

      {error ? (
        <div className="mt-4 rounded-lg border border-[#FECACA] bg-white px-4 py-3 text-sm text-brand-error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => void pedir(consulta)} className="mt-2 font-semibold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green">
            Reintentar
          </button>
        </div>
      ) : null}

      {!fresco && !error ? <Esqueleto /> : null}

      {fresco ? (
        <>
          <section className="mt-4 grid grid-cols-1 items-start gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores">
            <Tarjeta
              etiqueta="Ventas"
              valor={sinSesiones ? "—" : dinero(resumen.kpis.venta)}
              nota={notaVentas(sinSesiones, coberturaDias)}
              definicion={DEFINICIONES_CONSUMO.venta}
              extra={variacionConUnidad(estado, comparable?.venta ?? null, anterior?.venta ?? null, "ventas")}
            />
            <Tarjeta
              etiqueta="Tickets"
              valor={sinSesiones ? "—" : formatNumero(resumen.kpis.ordenes)}
              nota="Órdenes del periodo"
              definicion={DEFINICIONES_CONSUMO.tickets}
              extra={variacionConUnidad(estado, comparable?.ordenes ?? null, anterior?.ordenes ?? null, "tickets")}
            />
            <Tarjeta
              etiqueta="Ticket promedio"
              valor={sinSesiones || resumen.kpis.ticket == null ? "—" : dinero(resumen.kpis.ticket)}
              nota="Venta con ITBIS / tickets"
              definicion={DEFINICIONES_CONSUMO.ticket}
              extra={variacionConUnidad(estado, comparable?.ticket ?? null, anterior?.ticket ?? null, "ticket")}
            />
            <Tarjeta
              etiqueta="Utilidad bruta estimada"
              valor={sinSesiones || resumen.kpis.margen == null ? "—" : dinero(resumen.kpis.margen)}
              nota={notaUtilidad(sinSesiones, resumen.kpis.cobertura)}
              definicion={`${DEFINICIONES_CONSUMO.margen} ${DEFINICIONES_CONSUMO.costo} ${DEFINICIONES_CONSUMO.cobertura}`}
              extra={variacionUtilidad(estado, comparable?.margen ?? null, anterior?.margen ?? null)}
              aviso={avisoUtilidad}
            />
          </section>

          <section className="mt-3 grid items-start gap-3 lg:grid-cols-3">
            <article className="rounded-lg border border-[#E6E8E6] bg-white p-3 shadow-sm lg:col-span-2">
              <h2 className="text-sm font-semibold text-brand-ink">Evolución de ventas</h2>
              {sinSesiones ? (
                <p className="mt-6 text-sm text-brand-muted">Sin ventas registradas en este periodo.</p>
              ) : (
                <div className="mt-2">
                  <EvolucionVentas
                    puntos={serie.puntos}
                    granularidad={serie.granularidad}
                    mostrarComparacion={estado === "ok" || estado === "sin_base"}
                    explicacionComparacion={explicacionSerie(estado)}
                    onAnalizar={analizarPunto}
                  />
                </div>
              )}
            </article>
            <MilesPanel
              miles={data.miles}
              unidades={sinSesiones ? null : resumen.kpis.unidadesPorTicket}
              variacion={variacionConUnidad(estado, comparable?.unidadesPorTicket ?? null, anterior?.unidadesPorTicket ?? null, "unidades por ticket")}
              consulta={consulta}
              onRetry={() => void pedir(consulta)}
            />
          </section>

          <CambioVentas estado={estado} cascada={cascada} recortado={Boolean(textoPeriodo.aviso)} />

          <section className="mt-3 grid items-start gap-3 lg:grid-cols-2">
            <article className="rounded-lg border border-[#E6E8E6] bg-white p-3 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-brand-ink">Productos destacados</h2>
                <div role="radiogroup" aria-label="Orden de productos" className="inline-flex rounded-md border border-[#E5E7EB] bg-[#F4F5F3] p-0.5">
                  {(
                    [
                      ["ventas", "Por ventas"],
                      ["utilidad", "Por utilidad"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={vistaProductos === id}
                      onClick={() => setVistaProductos(id)}
                      className="rounded px-2.5 py-1 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green"
                      style={{ backgroundColor: vistaProductos === id ? "#FFFFFF" : "transparent", color: vistaProductos === id ? brand.green : brand.ink }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {vistaProductos === "utilidad" ? (
                <p className="mt-2 text-xs text-brand-muted">
                  Depende de costos disponibles. Los productos sin costo válido no entran. Cobertura {formatPctPlano(resumen.kpis.cobertura)}.
                </p>
              ) : null}
              {productos.length === 0 ? (
                <p className="mt-4 text-sm text-brand-muted">
                  {vistaProductos === "utilidad" ? "Ningún producto vendido tiene costo válido en este periodo." : "Sin productos vendidos en este periodo."}
                </p>
              ) : (
                <table className="mt-2 w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
                      <th className="py-1 font-semibold">Producto</th>
                      <th className="py-1 text-right font-semibold">{vistaProductos === "utilidad" ? "Utilidad" : "Ventas"}</th>
                      <th className="py-1 text-right font-semibold">Unidades</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productos.map((producto) => (
                      <FilaProducto key={producto.codigo} producto={producto} vista={vistaProductos} onOpen={() => aplicar({ detalle: producto.codigo })} />
                    ))}
                  </tbody>
                </table>
              )}
              <Link
                href={hrefAnalitica("/admin/consumo/productos", consulta, {
                  orden: vistaProductos === "utilidad" ? "margen" : "venta",
                  vista: vistaProductos === "utilidad" ? "rentabilidad" : null,
                })}
                className="mt-3 inline-block text-sm font-semibold text-brand-green focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green"
              >
                Ver todos
              </Link>
            </article>
            <MapaResumen franjas={franjas} consulta={consulta} muestraCorta={muestraCorta} dias={coberturaDias?.esperados ?? 0} />
          </section>

          <section className="mt-3 grid items-start gap-3 lg:grid-cols-2">
            <MixPagos mix={resumen.mix} venta={resumen.kpis.venta} diferencia={diferencia} consulta={consulta} sinSesiones={sinSesiones} />
            <Calidad calidad={resumen.calidad} consulta={consulta} periodo={textoPeriodo.rango} />
          </section>
        </>
      ) : null}

      {detalleCodigo ? (
        <ProductoPanel
          codigo={detalleCodigo}
          detalle={detallePendiente ? null : data.detalle}
          error={detallePendiente ? null : data.detalleError}
          cargando={detallePendiente}
          desde={periodoVisible.desde}
          hasta={periodoVisible.hasta}
          desdeComparado={periodoVisible.comparacion === "off" ? null : periodoVisible.anterior.desde}
          hastaComparado={periodoVisible.comparacion === "off" ? null : periodoVisible.anterior.hasta}
          mostrarComparacion={!detallePendiente && (estado === "ok" || estado === "sin_base")}
          variacion={
            !detallePendiente && data.detalle
              ? variacionProducto(estado, data.detalle.variacion, data.detalle.ventaAnterior)
              : null
          }
          enlaceHorario={`/admin/consumo/productos/${encodeURIComponent(detalleCodigo)}?${consultaCompartida(consulta)}`}
          onClose={cerrarProducto}
        />
      ) : null}
    </div>
  );
}

function notaVentas(sinSesiones: boolean, cobertura: { presentes: number; esperados: number; completa: boolean } | null): string {
  if (sinSesiones) return "Sin ventas en el periodo";
  if (cobertura && !cobertura.completa) return `Con ITBIS · ${cobertura.presentes} de ${cobertura.esperados} días con datos`;
  return "Con ITBIS";
}

function notaUtilidad(sinSesiones: boolean, cobertura: number | null): string {
  if (sinSesiones) return "Sin ventas en el periodo";
  if (cobertura == null) return "Sin ventas con costo válido";
  return `Cobertura ${formatPctPlano(cobertura)} · solo ventas con costo válido`;
}

function explicacionSerie(estado: ResumenConsumo["comparacionEstado"]): string {
  if (estado === "off") return "Sin comparación";
  if (estado === "no_disponible") return "Comparado no disponible";
  if (estado === "sin_base") return "Comparado sin base de ventas";
  return "Sin serie comparada";
}

function Tarjeta({
  etiqueta,
  valor,
  nota,
  definicion,
  extra,
  aviso,
}: {
  etiqueta: string;
  valor: string;
  nota: string;
  definicion: string;
  extra: ReturnType<typeof variacionConUnidad>;
  aviso?: string | null;
}) {
  return (
    <article className="rounded-lg border border-[#E6E8E6] bg-white px-3 py-3 shadow-sm">
      <h2 className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
        {etiqueta}
        <Definicion texto={definicion} />
      </h2>
      <p className="mt-1 text-lg font-semibold tabular-nums text-brand-ink">{valor}</p>
      <p className="mt-0.5 text-[11px] text-brand-muted">{nota}</p>
      {extra ? (
        <p className="mt-1 text-xs">
          <Variacion item={extra} />
        </p>
      ) : null}
      {aviso ? <p className="mt-1 text-[11px] leading-4 text-[#92400E]">{aviso}</p> : null}
    </article>
  );
}

function Esqueleto() {
  return (
    <div className="mt-4 space-y-3" aria-hidden="true">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-[104px] animate-pulse rounded-lg bg-white" />
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="h-80 animate-pulse rounded-lg bg-white lg:col-span-2" />
        <div className="h-80 animate-pulse rounded-lg bg-white" />
      </div>
      <div className="h-36 animate-pulse rounded-lg bg-white" />
    </div>
  );
}

function CambioVentas({ estado, cascada, recortado }: { estado: ResumenConsumo["comparacionEstado"]; cascada: CascadaVenta | null; recortado: boolean }) {
  return (
    <section className="mt-3 rounded-lg border border-[#E6E8E6] bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-brand-ink">Qué explica el cambio</h2>
        <details className="text-xs text-brand-muted">
          <summary className="cursor-pointer font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green">Cómo se calcula</summary>
          <p className="mt-2 max-w-xl leading-5">{AYUDA_CAMBIO}</p>
        </details>
      </div>
      {estado === "off" ? <p className="mt-3 text-sm text-brand-muted">Sin comparación. Elige un periodo comparado para ver qué explica el cambio.</p> : null}
      {estado === "no_disponible" ? <p className="mt-3 text-sm text-brand-muted">No hay una base comparable: falta cobertura en el periodo o en el comparado.</p> : null}
      {estado === "sin_base" ? <p className="mt-3 text-sm text-brand-muted">El periodo comparado no tiene ventas. El cambio no se puede partir entre tickets y ticket promedio.</p> : null}
      {estado === "ok" && !cascada ? <p className="mt-3 text-sm text-brand-muted">No se puede partir el cambio: uno de los periodos no tiene tickets.</p> : null}
      {cascada ? <Cascada cascada={cascada} recortado={recortado} /> : null}
    </section>
  );
}

function Cascada({ cascada, recortado }: { cascada: CascadaVenta; recortado: boolean }) {
  const marcas = [0, cascada.anterior, cascada.anterior + cascada.efectoTickets, cascada.actual];
  const min = Math.min(0, ...marcas);
  const max = Math.max(...marcas, 0);
  const span = max - min || 1;
  const trazo = (inicio: number, fin: number) => {
    if (Math.abs(fin - inicio) < 0.005) return { left: "0%", width: "0%" };
    const left = ((Math.min(inicio, fin) - min) / span) * 100;
    const width = (Math.abs(fin - inicio) / span) * 100;
    return { left: `${left}%`, width: `${Math.min(width, 100 - left)}%` };
  };
  const pasos = [
    { etiqueta: "Ventas comparadas", valor: dinero(cascada.anterior), color: "#111827", ...trazo(0, cascada.anterior) },
    {
      etiqueta: "Cambio por tickets",
      valor: dineroFirmado(cascada.efectoTickets),
      color: cascada.efectoTickets >= 0 ? "#166534" : "#B91C1C",
      ...trazo(cascada.anterior, cascada.anterior + cascada.efectoTickets),
    },
    {
      etiqueta: "Cambio por ticket promedio",
      valor: dineroFirmado(cascada.efectoTicket),
      color: cascada.efectoTicket >= 0 ? "#166534" : "#B91C1C",
      ...trazo(cascada.anterior + cascada.efectoTickets, cascada.actual),
    },
    { etiqueta: recortado ? "Ventas de los días comparados" : "Ventas actuales", valor: dinero(cascada.actual), color: brand.green, ...trazo(0, cascada.actual) },
  ];
  return (
    <div className="mt-3">
      <ol className="space-y-2">
        {pasos.map((paso) => (
          <li key={paso.etiqueta} className="grid items-center gap-2 sm:grid-cols-[11rem_1fr_auto]">
            <span className="text-xs text-brand-muted">{paso.etiqueta}</span>
            <span className="relative h-3 rounded-sm bg-[#F4F5F3]" aria-hidden="true">
              <span className="absolute top-0 h-3 rounded-sm" style={{ left: paso.left, width: paso.width, backgroundColor: paso.color }} />
            </span>
            <span className="text-right text-sm font-semibold tabular-nums text-brand-ink">{paso.valor}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-sm text-brand-ink">{cascada.conclusion}</p>
    </div>
  );
}

function dineroFirmado(valor: number): string {
  if (valor > 0.004) return `+${dinero(valor)}`;
  if (valor < -0.004) return `−${dinero(Math.abs(valor))}`;
  return dinero(0);
}

function MilesPanel({
  miles,
  unidades,
  variacion,
  consulta,
  onRetry,
}: {
  miles: PayloadResumen["miles"];
  unidades: number | null;
  variacion: ReturnType<typeof variacionConUnidad>;
  consulta: string;
  onRetry: () => void;
}) {
  const fuera = miles != null && miles.destacados.length > 0 && miles.destacados.every((item) => item.alcance !== "periodo");
  return (
    <article className="rounded-lg border border-[#E6E8E6] bg-white p-3 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-brand-ink">Destacados de Miles</h2>
        <Link href={hrefAnalitica("/admin/consumo/canasta", consulta)} className="text-xs font-semibold text-brand-green">
          Canasta
        </Link>
      </div>
      <p className="mt-2 text-xs text-brand-muted">
        Unidades por ticket <span className="font-semibold tabular-nums text-brand-ink">{unidades == null ? "—" : formatNumero(unidades, 2)}</span>
        {variacion ? (
          <>
            {" "}
            <Variacion item={variacion} />
          </>
        ) : null}
        <Definicion texto={DEFINICIONES_CONSUMO.unidadesTicket} />
      </p>
      {miles == null ? (
        <div className="mt-3 text-sm text-brand-muted">
          <p>No pudimos cargar los hallazgos de Miles.</p>
          <button type="button" onClick={onRetry} className="mt-2 font-semibold text-brand-ink underline">
            Reintentar
          </button>
        </div>
      ) : miles.destacados.length === 0 ? (
        <p className="mt-4 text-sm text-brand-muted">No hay hallazgos vigentes para mostrar.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {fuera ? <li className="text-xs text-[#92400E]">Estos hallazgos no corresponden al periodo seleccionado.</li> : null}
          {miles.destacados.map((hallazgo) => (
            <Hallazgo key={hallazgo.id} hallazgo={hallazgo} />
          ))}
        </ul>
      )}
      <p className="mt-3 border-t border-[#EEF1EE] pt-2 text-xs text-brand-muted">
        {miles ? `${formatNumero(miles.recomendaciones)} recomendaciones vigentes. ` : null}
        <Link href="/admin/consumo/miles" className="font-semibold text-brand-green">
          Abrir Miles
        </Link>
      </p>
    </article>
  );
}

function Hallazgo({ hallazgo }: { hallazgo: HallazgoDestacado }) {
  const vigencia = hallazgo.actualizadoEn || hallazgo.publicadoEn;
  return (
    <li className="border-t border-[#F3F4F6] pt-2 first:border-t-0 first:pt-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
        <span aria-hidden="true">{marcaTipo(hallazgo.tipo)} </span>
        {etiquetaTipo(hallazgo.tipo)}
      </p>
      <p className="mt-0.5 line-clamp-2 text-sm font-semibold leading-5 text-brand-ink">{hallazgo.titulo}</p>
      {hallazgo.cifra ? <p className="mt-0.5 text-sm tabular-nums text-brand-ink">{hallazgo.cifra}</p> : hallazgo.resumen ? <p className="mt-0.5 line-clamp-2 text-xs leading-4 text-brand-muted">{hallazgo.resumen}</p> : null}
      <p className="mt-0.5 text-[11px] leading-4 text-brand-muted">{textoAlcance(hallazgo)}</p>
      {vigencia ? <p className="text-[11px] text-brand-muted">{hallazgo.actualizadoEn ? "Actualizado" : "Publicado"} {formatoInstante(vigencia)}</p> : null}
      <Link href={hallazgo.accion.href} className="mt-1 inline-block text-xs font-semibold text-brand-green">
        {hallazgo.accion.etiqueta}
      </Link>
    </li>
  );
}

function marcaTipo(tipo: string): string {
  if (tipo === "oportunidad") return "↑";
  if (tipo === "deterioro") return "↓";
  if (tipo === "patron") return "◦";
  if (tipo === "anomalia" || tipo === "calidad") return "!";
  return "·";
}

function FilaProducto({ producto, vista, onOpen }: { producto: ProductoConsumo; vista: "ventas" | "utilidad"; onOpen: () => void }) {
  const subtitulo = subtituloProducto(producto);
  const principal = vista === "utilidad" ? dinero(producto.margen) : dinero(producto.venta);
  return (
    <tr className="border-t border-[#F3F4F6]">
      <td className="py-1.5 pr-2">
        <button
          type="button"
          id={`producto-${encodeURIComponent(producto.codigo)}`}
          onClick={onOpen}
          className="text-left font-semibold text-brand-ink underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green"
        >
          {producto.nombre}
        </button>
        {subtitulo ? <span className="block text-[11px] text-brand-muted">{subtitulo}</span> : null}
      </td>
      <td className="py-1.5 text-right font-semibold tabular-nums">{principal}</td>
      <td className="py-1.5 text-right tabular-nums text-brand-muted">{formatUnidades(producto.unidades)}</td>
    </tr>
  );
}

function tonoFranja(valor: number | null, max: number, estado: FranjaHorario["estado"]): string {
  if (estado === "sin_datos") return "#F9FAFB";
  if (estado === "cobertura_incompleta") return "#FEF3C7";
  if (estado === "abierto_sin_ventas" || valor == null || valor <= 0 || max <= 0) return "#F3F4F6";
  const step = valor / max;
  if (step > 0.8) return "#3F6B1C";
  if (step > 0.6) return "#5C8C2A";
  if (step > 0.4) return "#7EB341";
  if (step > 0.2) return "#B7D48E";
  return "#E5F0D4";
}

function MapaResumen({ franjas, consulta, muestraCorta, dias }: { franjas: FranjaHorario[]; consulta: string; muestraCorta: boolean; dias: number }) {
  const [elegida, setElegida] = useState<string | null>(null);
  const horas = Array.from(new Set(franjas.map((franja) => franja.desdeHora)));
  const max = Math.max(0, ...franjas.filter((franja) => franja.estado === "con_ventas").map((franja) => franja.promedio ?? 0));
  const seleccion = franjas.find((franja) => `${franja.dow}-${franja.desdeHora}` === elegida) ?? null;
  return (
    <article className="rounded-lg border border-[#E6E8E6] bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-brand-ink">Momentos de mayor venta</h2>
        <Link href={hrefAnalitica("/admin/consumo/horarios", consulta)} className="text-xs font-semibold text-brand-green">
          Ver mapa completo
        </Link>
      </div>
      <p className="mt-1 text-xs text-brand-muted">El color es el promedio de ventas por hora observada, no el total del periodo.</p>
      {muestraCorta ? <p className="mt-1 text-xs text-[#92400E]">Muestra de {dias} días. No describe un patrón estable.</p> : null}
      <div className="mt-3 overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid gap-1" style={{ gridTemplateColumns: `48px repeat(${horas.length}, minmax(0, 1fr))` }}>
            <span />
            {horas.map((hora) => (
              <span key={hora} className="text-center text-[10px] text-brand-muted">
                {String(hora).padStart(2, "0")}
              </span>
            ))}
            {[1, 2, 3, 4, 5, 6, 7].map((dow) => (
              <div key={dow} className="contents">
                <span className="self-center text-xs font-semibold text-brand-muted">{DIAS[dow]}</span>
                {horas.map((hora) => {
                  const franja = franjas.find((item) => item.dow === dow && item.desdeHora === hora);
                  const id = `${dow}-${hora}`;
                  const activa = elegida === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={activa}
                      aria-label={`${DIAS[dow]} ${String(hora).padStart(2, "0")}:00 a ${String(hora + 2).padStart(2, "0")}:00`}
                      onClick={() => setElegida(id)}
                      className="h-8 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green"
                      style={{
                        backgroundColor: tonoFranja(franja?.promedio ?? null, max, franja?.estado ?? "sin_datos"),
                        outline: activa ? "2px solid #111827" : undefined,
                        boxShadow: !franja || franja.estado === "sin_datos" ? "inset 0 0 0 1px #E5E7EB" : undefined,
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-brand-muted">
        <span>Menos</span>
        {["#F3F4F6", "#E5F0D4", "#B7D48E", "#7EB341", "#3F6B1C"].map((color) => (
          <span key={color} className="h-3 w-6 rounded-sm" style={{ backgroundColor: color }} />
        ))}
        <span>Más</span>
        <span className="inline-flex items-center gap-1">
          <span className="h-3 w-6 rounded-sm border border-[#E5E7EB] bg-[#F9FAFB]" /> Sin datos
        </span>
      </p>
      {seleccion ? (
        <div className="mt-2 text-xs leading-5 text-brand-ink">
          <p>
            {DIAS[seleccion.dow]} {String(seleccion.desdeHora).padStart(2, "0")}:00–{String(seleccion.hastaHora).padStart(2, "0")}:00 · {textoEstadoFranja(seleccion)}
          </p>
          <p className="text-brand-muted">
            Promedio {seleccion.promedio == null ? "—" : formatRd(seleccion.promedio)} · total {seleccion.venta == null ? "sin datos" : formatRd(seleccion.venta)} · {formatNumero(seleccion.ocurrencias)} observaciones · {seleccion.horasConDatos} de {seleccion.horasEnFranja} horas con datos
          </p>
        </div>
      ) : (
        <p className="mt-2 text-xs text-brand-muted">Elige una franja para ver importe, promedio y cobertura.</p>
      )}
    </article>
  );
}

function textoEstadoFranja(franja: FranjaHorario): string {
  if (franja.estado === "sin_datos") return "Sin datos. No es cero.";
  if (franja.estado === "cobertura_incompleta") return "Cobertura incompleta";
  if (franja.estado === "abierto_sin_ventas") return "Cero ventas con cobertura";
  return "Con ventas";
}

function MixPagos({
  mix,
  venta,
  diferencia,
  consulta,
  sinSesiones,
}: {
  mix: ResumenConsumo["mix"];
  venta: number;
  diferencia: number;
  consulta: string;
  sinSesiones: boolean;
}) {
  const filas = MEDIOS.map((medio) => ({ ...medio, monto: mix[medio.id] }));
  const activos = filas.filter((medio) => medio.monto !== 0);
  const quietos = filas.filter((medio) => medio.monto === 0);
  const suma = activos.reduce((total, medio) => total + medio.monto, 0);
  const positivos = activos.length > 0 && activos.every((medio) => medio.monto > 0) && suma > 0;
  return (
    <article className="rounded-lg border border-[#E6E8E6] bg-white p-3 shadow-sm">
      <h2 className="text-sm font-semibold text-brand-ink">Mix de pago</h2>
      <p className="mt-1 text-xs text-brand-muted">Pagos registrados en las ventas. El efectivo ya resta el vuelto. No es una conciliación bancaria.</p>
      {sinSesiones ? <p className="mt-3 text-sm text-brand-muted">Sin pagos en este periodo.</p> : null}
      {positivos ? (
        <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-[#F4F5F3]" aria-hidden="true">
          {activos.map((medio) => (
            <span key={medio.id} style={{ width: `${(medio.monto / suma) * 100}%`, backgroundColor: medio.color }} />
          ))}
        </div>
      ) : null}
      {activos.length > 0 ? (
        <ul className="mt-3 space-y-1 text-sm">
          {activos.map((medio) => (
            <li key={medio.id} className="flex items-center justify-between gap-3">
              <span className="text-brand-ink">
                <span className="mr-2 inline-block h-2 w-2 rounded-sm align-middle" style={{ backgroundColor: medio.color }} aria-hidden="true" />
                {medio.nombre}
              </span>
              <span className="tabular-nums text-brand-ink">
                {dinero(medio.monto)}
                {suma !== 0 ? <span className="ml-2 text-xs text-brand-muted">{formatPctPlano(medio.monto / suma)}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {Math.abs(diferencia) > 0.05 ? (
        <p className="mt-2 text-xs text-[#92400E]">
          Los pagos suman {dinero(suma)} y las ventas {dinero(venta)}. Diferencia {dineroFirmado(diferencia)}.{" "}
          <Link href={hrefAnalitica("/admin/consumo/calidad", consulta, { cola: "cuadre" })} className="font-semibold underline">
            Ver diferencias
          </Link>
        </p>
      ) : null}
      {!sinSesiones && quietos.length > 0 ? (
        <details className="mt-2 text-xs text-brand-muted">
          <summary className="cursor-pointer font-semibold">Medios sin movimientos</summary>
          <ul className="mt-1">
            {quietos.map((medio) => (
              <li key={medio.id}>
                {medio.nombre}: {dinero(0)}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </article>
  );
}

function Calidad({
  calidad,
  consulta,
  periodo,
}: {
  calidad: ResumenConsumo["calidad"];
  consulta: string;
  periodo: string;
}) {
  const limpia = calidad.sinCostoProductos === 0 && calidad.sinMatchProductos === 0 && calidad.descuadradas === 0;
  return (
    <article className="rounded-lg border border-[#E6E8E6] bg-white p-3 shadow-sm">
      <h2 className="text-sm font-semibold text-brand-ink">Calidad de datos</h2>
      <p className="mt-1 text-xs text-brand-muted">Periodo {periodo}. Conteos de productos distintos y de sesiones.</p>
      {limpia ? <p className="mt-3 text-sm text-brand-muted">Sin productos sin costo, sin vínculo al catálogo ni sesiones con diferencias en este periodo.</p> : null}
      <ul className="mt-2 space-y-2 text-sm">
        <Incidencia
          mostrar={!limpia || calidad.sinCostoProductos > 0}
          ocultarSiCero={limpia}
          cantidad={calidad.sinCostoProductos}
          texto={calidad.sinCostoProductos === 1 ? "producto distinto vendido sin costo" : "productos distintos vendidos sin costo"}
          extra={calidad.sinCostoProductos > 0 ? `Ventas afectadas ${dinero(calidad.sinCostoVenta)}` : null}
          href={hrefAnalitica("/admin/consumo/productos", consulta, { sin_costo: "1" })}
          accion="Ver productos"
        />
        <Incidencia
          mostrar={!limpia || calidad.sinMatchProductos > 0}
          ocultarSiCero={limpia}
          cantidad={calidad.sinMatchProductos}
          texto={calidad.sinMatchProductos === 1 ? "producto distinto sin vincular al catálogo" : "productos distintos sin vincular al catálogo"}
          extra={calidad.sinMatchProductos > 0 ? `Ventas afectadas ${dinero(calidad.sinMatchVenta)}` : null}
          href={hrefAnalitica("/admin/consumo/calidad", consulta, { cola: "match" })}
          accion="Ver calidad"
        />
        <Incidencia
          mostrar={!limpia || calidad.descuadradas > 0}
          ocultarSiCero={limpia}
          cantidad={calidad.descuadradas}
          texto={calidad.descuadradas === 1 ? "sesión con diferencias" : "sesiones con diferencias"}
          extra={null}
          href={hrefAnalitica("/admin/consumo/calidad", consulta, { cola: "cuadre" })}
          accion="Ver diferencias"
        />
      </ul>
    </article>
  );
}

function Incidencia({
  mostrar,
  ocultarSiCero,
  cantidad,
  texto,
  extra,
  href,
  accion,
}: {
  mostrar: boolean;
  ocultarSiCero: boolean;
  cantidad: number;
  texto: string;
  extra: string | null;
  href: string;
  accion: string;
}) {
  if (!mostrar || (ocultarSiCero && cantidad === 0)) return null;
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-2">
      <span>
        <span className="font-semibold tabular-nums">{formatNumero(cantidad)}</span> {texto}
        {extra ? <span className="mt-0.5 block text-xs text-brand-muted">{extra}</span> : null}
      </span>
      <Link href={href} className="text-xs font-semibold text-brand-green">
        {accion}
      </Link>
    </li>
  );
}
