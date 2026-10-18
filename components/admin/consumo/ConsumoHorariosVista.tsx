"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { BarraPeriodo, LineaDatos, controlPeriodo } from "@/components/admin/consumo/BarraPeriodo";
import { HorariosMapa } from "@/components/admin/consumo/HorariosMapa";
import { ProductoPanel } from "@/components/admin/consumo/ProductoPanel";
import { describirPeriodo, etiquetaTienda, formatPctPlano } from "@/lib/consumo-productos-ui";
import { diasInclusivos } from "@/lib/consumo-metricas";
import { formatDayKey } from "@/lib/local-day";
import { formatNumero, formatUnidades, resolverPeriodo } from "@/lib/pos-domain";
import type { DetalleProducto, PayloadHorarios } from "@/lib/pos-consumo";
import {
  CRITERIO_TURNO,
  NOTA_HORARIO,
  NOTA_TICKET_CATEGORIA,
  NOTA_ZONA,
  TEXTO_RELOJ,
  calculoAplicado,
  cambioVisible,
  celdaEn,
  etiquetaSeleccion,
  leerControles,
  leerFranja,
  type CeldaMapa,
  type CambioValor,
  type MetricaId,
  participacionFranja,
  textoAlcance,
  textoCambio,
  textoEstado,
  textoMuestraHallazgo,
  textoRangoSesion,
  textoValor,
  valorMostrado,
  vistaAplicada,
  type ProductoFranja,
  type TurnoCaja,
} from "@/lib/consumo-horarios-ui";

const LOCALES = ["detalle", "metrica", "calculo", "vista", "cambio", "franja"];

function claveMapa(consulta: string): string {
  const params = new URLSearchParams(consulta);
  for (const clave of LOCALES) params.delete(clave);
  return params.toString();
}

export function ConsumoHorariosVista({ inicial, consultaInicial }: { inicial: PayloadHorarios; consultaInicial: string }) {
  const [consulta, setConsulta] = useState(consultaInicial);
  const consultaRef = useRef(consultaInicial);
  const [data, setData] = useState(inicial);
  const [dataConsulta, setDataConsulta] = useState(consultaInicial);
  const dataConsultaRef = useRef(consultaInicial);
  const [error, setError] = useState<string | null>(null);
  const [productos, setProductos] = useState<ProductoFranja[]>([]);
  const [productosTruncados, setProductosTruncados] = useState(false);
  const [productosError, setProductosError] = useState<string | null>(null);
  const [productosClave, setProductosClave] = useState("");
  const [verTodos, setVerTodos] = useState(false);
  const [intentoProductos, setIntentoProductos] = useState(0);
  const [detalle, setDetalle] = useState<DetalleProducto | null>(inicial ? null : null);
  const [detalleError, setDetalleError] = useState<string | null>(null);
  const [detalleCargando, setDetalleCargando] = useState(false);
  const req = useRef(0);
  const prodReq = useRef(0);
  const detReq = useRef(0);
  const params = useMemo(() => new URLSearchParams(consulta), [consulta]);
  const controles = leerControles(params);
  const franja = leerFranja(params.get("franja"));
  const listaPendiente = claveMapa(consulta) !== claveMapa(dataConsulta);
  const detalleCodigo = params.get("detalle");

  useEffect(() => {
    function onPop() {
      const texto = window.location.search.replace(/^\?/, "");
      consultaRef.current = texto;
      setConsulta(texto);
      if (claveMapa(texto) !== claveMapa(dataConsultaRef.current)) void pedir(texto);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  async function pedir(texto: string) {
    const id = ++req.current;
    setError(null);
    try {
      const respuesta = await fetch(`/api/admin/consumo/horarios?${claveMapa(texto)}`, { cache: "no-store" });
      const json = (await respuesta.json().catch(() => ({}))) as PayloadHorarios & { error?: string };
      if (id !== req.current) return;
      if (!respuesta.ok || !json.mapa) throw new Error(json.error || "No pudimos cargar los horarios");
      setData(json);
      dataConsultaRef.current = texto;
      setDataConsulta(texto);
    } catch (causa) {
      if (id !== req.current) return;
      setError(causa instanceof Error ? causa.message : "No pudimos cargar los horarios");
    }
  }

  function aplicar(patch: Record<string, string | null>) {
    const next = new URLSearchParams(consultaRef.current);
    for (const [key, value] of Object.entries(patch)) {
      if (value == null || value === "") next.delete(key);
      else next.set(key, value);
    }
    const texto = next.toString();
    const cambiaMapa = claveMapa(texto) !== claveMapa(consultaRef.current);
    consultaRef.current = texto;
    window.history.replaceState(null, "", `/admin/consumo/horarios${texto ? `?${texto}` : ""}`);
    setConsulta(texto);
    if (cambiaMapa) void pedir(texto);
  }

  function cambiarPeriodo(preset: string) {
    if (preset === "custom") {
      aplicar({ preset: "custom", desde: params.get("desde") || periodoVisible.desde, hasta: params.get("hasta") || periodoVisible.hasta });
      return;
    }
    aplicar({ preset, desde: null, hasta: null });
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
  const presetActual = params.get("preset") || periodoVisible.preset;
  const comparacionActual = params.get("comparar") === "0" ? "off" : params.get("comparacion") || periodoVisible.comparacion;
  const tiendas = data.tiendas.length > 0 ? data.tiendas : inicial.tiendas;
  const tiendaActiva = params.get("tienda") || data.tienda;
  const mapa = data.mapa;
  const calculo = calculoAplicado(controles.calculo, controles.metrica, !listaPendiente && mapa.baseFiable);
  const vista = vistaAplicada(controles.vista, Boolean(periodoVisible.comparar && periodoVisible.tramo));
  const mapaClave = useMemo(() => claveMapa(consulta), [consulta]);
  const celda = franja && !listaPendiente ? celdaEn(mapa, franja.dow, franja.hora) : null;
  const productosAlDia = franja != null && productosClave === `${mapaClave}|${franja.dow}-${franja.hora}`;
  const listaProductos = verTodos ? productos : productos.slice(0, 5);
  const enlaceProductos = `/admin/consumo/productos?${claveMapa(consulta)}`;

  const franjaDow = franja?.dow ?? -1;
  const franjaHora = franja?.hora ?? -1;
  useEffect(() => {
    if (franjaDow < 0 || franjaHora < 0) return;
    const clave = `${mapaClave}|${franjaDow}-${franjaHora}`;
    const id = ++prodReq.current;
    setProductosClave("");
    setProductosError(null);
    setVerTodos(false);
    const busca = new URLSearchParams(mapaClave);
    busca.set("dow", String(franjaDow));
    busca.set("hora", String(franjaHora));
    void fetch(`/api/admin/consumo/horarios/productos?${busca.toString()}`, { cache: "no-store" })
      .then(async (respuesta) => {
        const json = (await respuesta.json().catch(() => ({}))) as { productos?: ProductoFranja[]; truncado?: boolean; error?: string };
        if (id !== prodReq.current) return;
        if (!respuesta.ok || !json.productos) throw new Error(json.error || "No pudimos cargar los productos");
        setProductos(json.productos);
        setProductosTruncados(Boolean(json.truncado));
        setProductosClave(clave);
      })
      .catch((causa: unknown) => {
        if (id !== prodReq.current) return;
        setProductos([]);
        setProductosClave(clave);
        setProductosError(causa instanceof Error ? causa.message : "No pudimos cargar los productos");
      });
  }, [mapaClave, franjaDow, franjaHora, intentoProductos]);

  useEffect(() => {
    if (!detalleCodigo) {
      setDetalle(null);
      setDetalleError(null);
      setDetalleCargando(false);
      return;
    }
    const id = ++detReq.current;
    setDetalleCargando(true);
    setDetalleError(null);
    const busca = new URLSearchParams(mapaClave);
    busca.set("codigo", detalleCodigo);
    void fetch(`/api/admin/consumo/producto?${busca.toString()}`, { cache: "no-store" })
      .then(async (respuesta) => {
        const json = (await respuesta.json().catch(() => ({}))) as { producto?: DetalleProducto; error?: string };
        if (id !== detReq.current) return;
        if (!respuesta.ok || !json.producto) throw new Error(json.error || "No pudimos cargar el producto");
        setDetalle(json.producto);
        setDetalleCargando(false);
      })
      .catch((causa: unknown) => {
        if (id !== detReq.current) return;
        setDetalle(null);
        setDetalleCargando(false);
        setDetalleError(causa instanceof Error ? causa.message : "No pudimos cargar el producto");
      });
  }, [detalleCodigo, mapaClave]);

  const diasCompletos = periodoVisible.tramo ? diasInclusivos(periodoVisible.tramo.desde, periodoVisible.tramo.hasta) : 0;

  return (
    <div className="-mx-4 -mt-6 min-h-full bg-[#F4F5F3] px-4 pb-8 pt-5 md:-mx-6 md:px-6">
      <header>
        <nav aria-label="Miga de pan" className="text-xs text-brand-muted">
          <Link href="/admin/consumo" className="hover:text-brand-ink">
            Analítica
          </Link>
          <span aria-hidden="true"> / </span>
          <span className="text-brand-ink">Horarios</span>
        </nav>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-brand-ink">Ventas por día y hora</h1>
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
        comparacionNoDisponible={false}
        onPreset={cambiarPeriodo}
        onComparacion={(modo) => aplicar(modo === "off" ? { comparar: "0", comparacion: "off", vista: null } : { comparar: null, comparacion: modo })}
        onDesde={(fecha) => aplicar({ preset: "custom", desde: fecha || null })}
        onHasta={(fecha) => aplicar({ preset: "custom", hasta: fecha || null })}
      />
      <LineaDatos frescura={data.frescura} hasta={periodoVisible.hasta} />
      <p className="mt-1 text-xs text-brand-muted">
        {NOTA_ZONA}{" "}
        {periodoVisible.tramo ? `Días completos: ${diasCompletos}.` : "Este periodo todavía no tiene un día completo."}
      </p>

      {error ? (
        <div className="mt-4 rounded-lg border border-[#FECACA] bg-white px-4 py-3 text-sm text-brand-error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => void pedir(consulta)} className="mt-2 font-semibold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green">
            Reintentar
          </button>
        </div>
      ) : null}

      <section className="mt-4 rounded-lg border border-[#E6E8E6] bg-white p-3 shadow-sm" aria-label="Controles del mapa">
        <div className="flex flex-wrap items-end gap-2">
          <Selector
            etiqueta="Métrica"
            valor={controles.metrica}
            opciones={[
              ["venta", "Ventas"],
              ["tickets", "Tickets"],
              ["ticket", "Ticket promedio"],
              ["unidades", "Unidades"],
            ]}
            onChange={(valor) => aplicar({ metrica: valor === "venta" ? null : valor })}
          />
          {controles.metrica === "ticket" ? null : (
            <Selector
              etiqueta="Cálculo"
              valor={calculo.aplicado}
              opciones={[
                ["total", "Total del periodo"],
                ["promedio", "Promedio por fecha observada"],
              ]}
              deshabilitar={calculo.aviso ? "promedio" : null}
              onChange={(valor) => aplicar({ calculo: valor === "promedio" ? null : valor })}
            />
          )}
          <FiltroCategoria categorias={data.categorias} valor={controles.categoria} onChange={(valor) => aplicar({ categoria: valor, detalle: null })} />
          {controles.categoria ? (
            <button type="button" onClick={() => aplicar({ categoria: null, detalle: null })} className="h-9 rounded-md px-2 text-sm font-semibold text-brand-green">
              Limpiar filtros
            </button>
          ) : null}
          <Selector
            etiqueta="Atribución"
            valor={controles.reloj}
            opciones={[
              ["real", "Hora de la transacción"],
              ["caja", "Día operativo de caja"],
            ]}
            onChange={(valor) => aplicar({ reloj: valor === "real" ? null : valor, detalle: null })}
          />
          <Selector
            etiqueta="Vista"
            valor={vista.aplicada}
            opciones={[
              ["actividad", "Actividad"],
              ["cambio", "Cambio vs. comparativo"],
            ]}
            deshabilitar={periodoVisible.comparar ? null : "cambio"}
            onChange={(valor) => aplicar({ vista: valor === "actividad" ? null : valor })}
          />
          {vista.aplicada === "cambio" ? (
            <Selector
              etiqueta="Cambio"
              valor={controles.cambio}
              opciones={[
                ["absoluto", "Absoluto"],
                ["porcentaje", "Porcentual"],
              ]}
              onChange={(valor) => aplicar({ cambio: valor === "absoluto" ? null : valor })}
            />
          ) : null}
        </div>
        <p className="mt-2 text-xs text-brand-muted">{TEXTO_RELOJ[controles.reloj]}</p>
        {controles.categoria ? <p className="mt-1 text-xs text-brand-muted">{NOTA_TICKET_CATEGORIA}</p> : null}
        {calculo.aviso ? <p className="mt-1 text-xs text-[#92400E]">{calculo.aviso}</p> : null}
        {vista.aviso ? <p className="mt-1 text-xs text-[#92400E]">{vista.aviso}</p> : null}
        {mapa.notaComparacion && periodoVisible.comparar ? <p className="mt-1 text-xs text-brand-muted">{mapa.notaComparacion}</p> : null}
      </section>

      <section className={`mt-4 rounded-lg border border-[#E6E8E6] bg-white p-3 shadow-sm ${listaPendiente ? "opacity-60" : ""}`} aria-busy={listaPendiente}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-brand-ink">Mapa de calor</h2>
          {franja ? (
            <button type="button" onClick={() => aplicar({ franja: null })} className="text-xs font-semibold text-brand-green">
              Limpiar selección
            </button>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-brand-muted">{NOTA_HORARIO}</p>
        {mapa.muestraCorta ? <p className="mt-1 text-xs text-[#92400E]">Muestra de {mapa.diasPeriodo} días. No describe un patrón estable.</p> : null}
        {mapa.hayParcial || mapa.hayDesconocida ? (
          <p className="mt-1 text-xs text-[#92400E]">Hay franjas con cobertura parcial o desconocida. No se rellenan con cero.</p>
        ) : null}
        {!listaPendiente && !mapa.hayCobertura && !mapa.hayVentas ? (
          <p className="mt-3 text-sm text-brand-muted">No hay sesiones ni ventas en este periodo. La ausencia de transacciones no indica que la tienda estuviera cerrada.</p>
        ) : null}
        {!listaPendiente && mapa.hayCobertura && !mapa.hayVentas ? (
          <p className="mt-3 text-sm text-brand-muted">Hay sesiones cerradas y las ventas de las franjas observadas son cero.</p>
        ) : null}
        <div className="mt-3">
          <HorariosMapa
            mapa={mapa}
            metrica={controles.metrica}
            calculo={calculo.aplicado}
            vista={vista.aplicada}
            cambio={controles.cambio}
            categoria={Boolean(controles.categoria)}
            seleccion={franja}
            onSeleccion={(siguiente) => aplicar({ franja: siguiente ? `${siguiente.dow}-${siguiente.hora}` : null })}
          />
        </div>
        <p className="mt-2 text-[11px] text-brand-muted">El resumen de cada día incluye las 24 horas. Las horas sin datos no entran como cero. El ticket del día es la venta entre los tickets, no la suma de tickets promedio.</p>
      </section>

      <section className="mt-4 rounded-lg border border-[#E6E8E6] bg-white p-3 shadow-sm" aria-live="polite">
        {listaPendiente ? (
          <p className="text-sm text-brand-muted">Actualizando la franja…</p>
        ) : !celda || !franja ? (
          <p className="text-sm text-brand-muted">Selecciona una franja para ver ventas, cobertura y productos.</p>
        ) : (
          <Detalle
            celdaDow={franja.dow}
            celdaHora={franja.hora}
            mapa={mapa}
            metrica={controles.metrica}
            calculo={calculo.aplicado}
            cambio={controles.cambio}
            categoria={controles.categoria}
            periodo={textoPeriodo.rango}
            comparado={textoPeriodo.comparado}
            productos={productosAlDia ? listaProductos : []}
            totalProductos={productosAlDia ? productos.length : 0}
            truncado={productosTruncados}
            cargando={!productosAlDia && !productosError}
            error={productosError}
            verTodos={verTodos}
            onVerTodos={() => setVerTodos(true)}
            onProducto={(codigo) => aplicar({ detalle: codigo })}
            enlaceProductos={enlaceProductos}
            onReintentar={() => setIntentoProductos((valor) => valor + 1)}
          />
        )}
      </section>

      <div className={listaPendiente ? "opacity-60" : ""}>
      <Turnos turnos={data.turnos} categoria={controles.categoria} reloj={controles.reloj} periodo={textoPeriodo.rango} />

      {data.milesError ? <p className="mt-4 text-xs text-[#92400E]">No pudimos leer los hallazgos de Miles.</p> : null}
      {data.miles ? (
        <section className="mt-4 rounded-lg border border-[#E6E8E6] bg-white p-3 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">Miles</p>
          <h2 className="mt-1 text-sm font-semibold text-brand-ink">{data.miles.titulo}</h2>
          {data.miles.resumen ? <p className="mt-1 text-sm text-brand-ink">{data.miles.resumen}</p> : null}
          <p className="mt-2 text-xs text-brand-muted">{textoAlcance(data.miles)}</p>
          <p className="mt-1 text-xs text-brand-muted">{textoMuestraHallazgo(data.miles)}</p>
          {data.miles.limitaciones ? <p className="mt-1 text-xs text-brand-muted">{data.miles.limitaciones}</p> : null}
          <Link href={data.miles.accion.href} className="mt-2 inline-flex text-sm font-semibold text-brand-green">
            {data.miles.accion.etiqueta}
          </Link>
        </section>
      ) : null}
      </div>

      {detalleCodigo ? (
        <ProductoPanel
          codigo={detalleCodigo}
          detalle={detalle}
          error={detalleError}
          cargando={detalleCargando}
          periodo={periodoVisible}
          mostrarComparacion={Boolean(periodoVisible.comparar)}
          tiendaEtiqueta={etiquetaTienda(tiendaActiva)}
          enlaceCompleto={`/admin/consumo/productos/${encodeURIComponent(detalleCodigo)}?${claveMapa(consulta)}`}
          onClose={() => aplicar({ detalle: null })}
        />
      ) : null}
    </div>
  );
}

function Selector({
  etiqueta,
  valor,
  opciones,
  onChange,
  deshabilitar,
  ayuda,
}: {
  etiqueta: string;
  valor: string;
  opciones: Array<[string, string]>;
  onChange: (valor: string) => void;
  deshabilitar?: string | null;
  ayuda?: string;
}) {
  return (
    <label className="text-xs font-medium text-brand-muted" title={ayuda}>
      {etiqueta}
      <select value={valor} onChange={(event) => onChange(event.target.value)} className={`mt-1 block ${controlPeriodo}`}>
        {opciones.map(([id, label]) => (
          <option key={id} value={id} disabled={deshabilitar === id}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FiltroCategoria({ categorias, valor, onChange }: { categorias: string[]; valor: string; onChange: (valor: string | null) => void }) {
  const [q, setQ] = useState("");
  const [abierto, setAbierto] = useState(false);
  const filtradas = categorias.filter((item) => item.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 40);
  return (
    <div className="relative">
      <label className="text-xs font-medium text-brand-muted">
        Categoría
        <input
          value={abierto ? q : valor}
          placeholder={valor || "Todas"}
          onFocus={() => {
            setAbierto(true);
            setQ("");
          }}
          onChange={(event) => {
            setQ(event.target.value);
            setAbierto(true);
          }}
          onBlur={() => window.setTimeout(() => setAbierto(false), 120)}
          className={`mt-1 block w-44 ${controlPeriodo}`}
          role="combobox"
          aria-expanded={abierto}
          aria-controls="filtro-categoria-opciones"
          aria-autocomplete="list"
        />
      </label>
      {abierto ? (
        <ul id="filtro-categoria-opciones" role="listbox" className="absolute z-20 mt-1 max-h-56 w-56 overflow-auto rounded-md border border-[#E6E8E6] bg-white py-1 shadow-sm">
          <li>
            <button type="button" className="block w-full px-2 py-1.5 text-left text-sm hover:bg-[#F4F5F3]" onMouseDown={() => onChange(null)}>
              Todas
            </button>
          </li>
          {filtradas.map((item) => (
            <li key={item}>
              <button type="button" className="block w-full px-2 py-1.5 text-left text-sm hover:bg-[#F4F5F3]" onMouseDown={() => onChange(item)}>
                {item}
              </button>
            </li>
          ))}
          {filtradas.length === 0 ? <li className="px-2 py-1.5 text-sm text-brand-muted">Sin coincidencias</li> : null}
        </ul>
      ) : null}
    </div>
  );
}

function textoComparativo(celda: CeldaMapa, metrica: MetricaId, cambio: CambioValor | null): string {
  if (!cambio || cambio.estado === "sin_comparacion" || cambio.absoluto == null) return "Sin comparación";
  const actual = cambio.base === "promedio" ? valorMostrado(celda, metrica, "promedio") : cambio.base === "ticket" ? (celda.ticket ?? 0) : metrica === "tickets" ? celda.ticketsCubiertos : metrica === "unidades" ? celda.unidadesCubiertas : celda.ventaCubierta;
  if (actual == null) return "Sin comparación";
  return textoValor(Math.round((actual - cambio.absoluto) * 100) / 100, metrica);
}

function Detalle({
  celdaDow,
  celdaHora,
  mapa,
  metrica,
  calculo,
  cambio,
  categoria,
  periodo,
  comparado,
  productos,
  totalProductos,
  truncado,
  cargando,
  error,
  verTodos,
  onVerTodos,
  onProducto,
  enlaceProductos,
  onReintentar,
}: {
  celdaDow: number;
  celdaHora: number;
  mapa: PayloadHorarios["mapa"];
  metrica: ReturnType<typeof leerControles>["metrica"];
  calculo: "total" | "promedio";
  cambio: "absoluto" | "porcentaje";
  categoria: string;
  periodo: string;
  comparado: string | null;
  productos: ProductoFranja[];
  totalProductos: number;
  truncado: boolean;
  cargando: boolean;
  error: string | null;
  verTodos: boolean;
  onVerTodos: () => void;
  onProducto: (codigo: string) => void;
  enlaceProductos: string;
  onReintentar: () => void;
}) {
  const celda = celdaEn(mapa, celdaDow, celdaHora);
  if (!celda) return null;
  const comparacion = cambioVisible(celda, metrica, calculo);
  const fechas = celda.fechasCompletas;
  return (
    <div>
      <h2 className="text-sm font-semibold text-brand-ink">{etiquetaSeleccion(celdaDow, celdaHora)}</h2>
      <p className="mt-1 text-xs text-brand-muted">
        {periodo}
        {comparado ? ` · Comparado ${comparado}` : ""} · {textoEstado(celda.estado)}
      </p>
      {fechas.length === 1 ? <p className="mt-1 text-xs text-[#92400E]">1 observación. No es un patrón estable.</p> : null}
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
        <Dato etiqueta="Ventas" valor={textoValor(celda.venta, "venta")} />
        <Dato etiqueta="Promedio por fecha" valor={textoValor(celda.promedioVenta, "venta")} />
        <Dato etiqueta={categoria ? "Tickets con la categoría" : "Tickets"} valor={textoValor(celda.tickets, "tickets")} />
        <Dato etiqueta={categoria ? "Ticket promedio de la categoría" : "Ticket promedio"} valor={textoValor(celda.ticket, "ticket")} />
        <Dato etiqueta="Unidades" valor={textoValor(celda.unidades, "unidades")} />
        <Dato etiqueta={categoria ? "Participación de la categoría" : "Participación del periodo"} valor={formatPctPlano(participacionFranja(celda.venta, mapa.ventaPeriodo))} />
        <Dato etiqueta="Comparativo" valor={textoComparativo(celda, metrica, comparacion)} />
        <Dato etiqueta="Variación" valor={textoCambio(comparacion, metrica, cambio)} />
      </dl>
      <p className="mt-3 text-xs text-brand-muted">
        Cobertura: {celda.fechasCompletas.length} de {celda.elegibles} fechas elegibles con sesión cerrada.
        {celda.fechasSinDatos > 0 ? ` ${celda.fechasSinDatos} sin datos.` : ""}
        {celda.fechasParciales.length > 0 ? ` ${celda.fechasParciales.length} con cobertura parcial.` : ""}
        {celda.fechasDesconocidas.length > 0 ? ` ${celda.fechasDesconocidas.length} con cobertura desconocida.` : ""}
        {fechas.length > 0 && fechas.length <= 6 ? ` Fechas: ${fechas.map((fecha) => formatDayKey(fecha)).join(", ")}.` : ""}
      </p>
      {celda.ventasFueraDeCobertura ? <p className="mt-1 text-xs text-[#92400E]">Parte de la venta no tiene sesión cerrada en esa hora y no entra en el promedio.</p> : null}
      {celda.comparacion ? <p className="mt-1 text-xs text-brand-muted">{celda.comparacion.nota}</p> : null}
      {categoria ? <p className="mt-1 text-xs text-brand-muted">{NOTA_TICKET_CATEGORIA}</p> : null}

      <h3 className="mt-4 text-sm font-semibold text-brand-ink">Productos de la franja</h3>
      {error ? (
        <p className="mt-2 text-sm text-brand-error">
          {error}{" "}
          <button type="button" onClick={onReintentar} className="font-semibold underline">
            Reintentar
          </button>
        </p>
      ) : null}
      {cargando ? <p className="mt-2 text-sm text-brand-muted">Cargando productos…</p> : null}
      {!cargando && !error && productos.length === 0 ? <p className="mt-2 text-sm text-brand-muted">No hay productos en esta franja.</p> : null}
      {productos.length > 0 ? (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="text-xs text-brand-muted">
              <tr>
                <th className="py-1 font-medium">Producto</th>
                <th className="py-1 text-right font-medium">Unidades</th>
                <th className="py-1 text-right font-medium">Ventas</th>
                <th className="py-1 text-right font-medium">Participación</th>
              </tr>
            </thead>
            <tbody>
              {productos.map((producto) => (
                <tr key={producto.codigo} className="border-t border-[#E6E8E6]">
                  <td className="py-1.5">
                    <button type="button" onClick={() => onProducto(producto.codigo)} className="text-left font-semibold text-brand-ink underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green">
                      {producto.nombre}
                    </button>
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{formatUnidades(producto.unidades)}</td>
                  <td className="py-1.5 text-right tabular-nums">{textoValor(producto.venta, "venta")}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatPctPlano(participacionFranja(producto.venta, celda.venta))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-3 text-sm">
        {totalProductos > 5 && !verTodos ? (
          <button type="button" onClick={onVerTodos} className="font-semibold text-brand-green">
            Ver todos
          </button>
        ) : null}
        <Link href={enlaceProductos} className="font-semibold text-brand-green">
          Abrir Productos del periodo
        </Link>
      </div>
      <p className="mt-1 text-xs text-brand-muted">Productos abre el periodo y la categoría, sin esta franja. El detalle de arriba sí está limitado a la franja.</p>
      {truncado ? <p className="mt-1 text-xs text-[#92400E]">Se muestran los 200 productos de mayor venta en la franja.</p> : null}
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-brand-muted">{etiqueta}</dt>
      <dd className="truncate font-semibold tabular-nums text-brand-ink">{valor}</dd>
    </div>
  );
}

function Turnos({ turnos, categoria, reloj, periodo }: { turnos: TurnoCaja[]; categoria: string; reloj: "real" | "caja"; periodo: string }) {
  const vacio = turnos.every((turno) => turno.sesiones === 0);
  return (
    <section className="mt-4 rounded-lg border border-[#E6E8E6] bg-white p-3 shadow-sm">
      <h2 className="text-sm font-semibold text-brand-ink">Sesiones de caja AM / PM</h2>
      <p className="mt-1 text-xs text-brand-muted">{CRITERIO_TURNO}</p>
      <p className="mt-1 text-xs text-brand-muted">
        Periodo {periodo}. {TEXTO_RELOJ[reloj]} {categoria ? NOTA_TICKET_CATEGORIA : "El ticket promedio es la venta de estas transacciones entre sus tickets."}
      </p>
      {vacio ? <p className="mt-3 text-sm text-brand-muted">No hay sesiones de caja con transacciones en este periodo.</p> : null}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs text-brand-muted">
            <tr>
              <th className="py-1 font-medium">Sesión</th>
              <th className="py-1 text-right font-medium">Ventas</th>
              <th className="py-1 text-right font-medium">Participación</th>
              <th className="py-1 text-right font-medium">Tickets</th>
              <th className="py-1 text-right font-medium">{categoria ? "Ticket de la categoría" : "Ticket promedio"}</th>
              <th className="py-1 text-right font-medium">Unidades por ticket</th>
            </tr>
          </thead>
          <tbody>
            {turnos.map((turno) => (
              <tr key={turno.turno} className="border-t border-[#E6E8E6]">
                <td className="py-2">
                  <p className="font-semibold">{turno.turno === "am" ? "AM" : "PM"}</p>
                  <p className="text-[11px] text-brand-muted">
                    {turno.sesiones === 0
                      ? "Sin sesiones"
                      : `${formatNumero(turno.sesiones)} ${turno.sesiones === 1 ? "sesión" : "sesiones"}`}
                    {textoRangoSesion(turno.aperturaMin, turno.aperturaMax) ? ` · Apertura ${textoRangoSesion(turno.aperturaMin, turno.aperturaMax)}` : ""}
                    {textoRangoSesion(turno.cierreMin, turno.cierreMax) ? ` · Cierre ${textoRangoSesion(turno.cierreMin, turno.cierreMax)}` : turno.sesiones > 0 ? " · Sin cierre registrado en alguna sesión" : ""}
                  </p>
                </td>
                <td className="py-2 text-right tabular-nums">{textoValor(turno.venta, "venta")}</td>
                <td className="py-2 text-right tabular-nums">{formatPctPlano(turno.participacion)}</td>
                <td className="py-2 text-right tabular-nums">{textoValor(turno.tickets, "tickets")}</td>
                <td className="py-2 text-right tabular-nums">{textoValor(turno.ticket, "ticket")}</td>
                <td className="py-2 text-right tabular-nums">{turno.unidadesPorTicket == null ? "—" : formatUnidades(turno.unidadesPorTicket)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-brand-muted">El volumen no describe por sí solo el desempeño de quien atendió la caja.</p>
    </section>
  );
}
