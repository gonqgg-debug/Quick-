"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarraPeriodo, LineaDatos } from "@/components/admin/consumo/BarraPeriodo";
import { BarraValor, EvolucionProducto } from "@/components/admin/consumo/EvolucionProducto";
import { PrecioCostoProducto } from "@/components/admin/consumo/PrecioCostoProducto";
import { Variacion } from "@/components/admin/consumo/ProductoPanel";
import { Definicion } from "@/components/admin/consumo/ui";
import { consultaCompartida } from "@/lib/consumo-resumen-ui";
import {
  etiquetaHora,
  horasProducto,
  identificadoresProducto,
  lineaProducto,
  nombreProducto,
  serieProducto,
  variacionDetalle,
} from "@/lib/consumo-producto-ui";
import { DEFINICIONES_CONSUMO } from "@/lib/consumo-metricas";
import { DEFINICION_COSTO, describirPeriodo, dinero, etiquetaTienda, formatPctPlano, leerConsultaProductos } from "@/lib/consumo-productos-ui";
import { formatDayKey } from "@/lib/local-day";
import { formatoInstante } from "@/lib/miles-presentacion";
import { TIENDA_DEFAULT, formatPct, formatUnidades, resolverPeriodo } from "@/lib/pos-domain";
import type { AsociadoProducto, DetalleProducto, FrescuraConsumo, HoraDetalle, VinculoMiles } from "@/lib/pos-consumo";
import type { EstadoComparacion } from "@/lib/consumo-metricas";
import type { ConsumoPeriodo } from "@/lib/pos-domain";
import { brand } from "@/lib/theme";

export type PayloadProducto = {
  producto: DetalleProducto;
  periodo: ConsumoPeriodo;
  tienda: string;
  tiendas: string[];
  frescura: FrescuraConsumo | null;
  comparacionEstado: EstadoComparacion;
  horas: { reloj: "real" | "caja"; distingueCero: boolean; filas: HoraDetalle[] };
  asociados: AsociadoProducto[];
  canastaNota: string | null;
  miles: VinculoMiles[];
};

const ETIQUETA_TIPO: Record<string, string> = {
  patron: "Patrón",
  anomalia: "Incidencia",
  calidad: "Incidencia",
  deterioro: "Incidencia",
  oportunidad: "Oportunidad",
  combo: "Oportunidad",
  acompanamiento: "Oportunidad",
  compra_minima: "Oportunidad",
  horario: "Oportunidad",
  salida_inventario: "Oportunidad",
};

export function ProductoAnalitica({
  codigo,
  inicial,
  consultaInicial,
}: {
  codigo: string;
  inicial: PayloadProducto;
  consultaInicial: string;
}) {
  const [consulta, setConsulta] = useState(consultaInicial);
  const consultaRef = useRef(consultaInicial);
  const [data, setData] = useState(inicial);
  const [dataConsulta, setDataConsulta] = useState(consultaInicial);
  const [error, setError] = useState<string | null>(null);
  const req = useRef(0);
  const pedirRef = useRef<(texto: string) => Promise<void>>(async () => {});
  const params = useMemo(() => new URLSearchParams(consulta), [consulta]);
  const leida = useMemo(() => leerConsultaProductos(params, data.tiendas.length ? data.tiendas : inicial.tiendas), [params, data.tiendas, inicial.tiendas]);
  const pendiente = consulta !== dataConsulta;
  const periodoVisible = pendiente
    ? resolverPeriodo({
        desde: params.get("desde"),
        hasta: params.get("hasta"),
        preset: params.get("preset"),
        comparar: params.get("comparar"),
        comparacion: params.get("comparacion"),
      })
    : data.periodo;
  const texto = describirPeriodo(periodoVisible);
  const presetActual = params.get("preset") || periodoVisible.preset;
  const comparacionActual = params.get("comparar") === "0" ? "off" : params.get("comparacion") || periodoVisible.comparacion;
  const relojPedido = params.get("reloj") === "caja" ? "caja" : "real";
  const reloj = pendiente ? relojPedido : data.horas.reloj;
  const relojNoDisponible = !pendiente && relojPedido === "real" && data.horas.reloj !== "real";
  const mostrarComparacion = !pendiente && (data.comparacionEstado === "ok" || data.comparacionEstado === "sin_base");
  const ficha = data.producto;
  const producto = pendiente ? null : ficha;
  const titulo = nombreProducto(ficha.nombre, ficha.codigo);
  const linea = lineaProducto(ficha.categoria, ficha.presentacion);
  const serie = producto
    ? serieProducto({
        desde: periodoVisible.desde,
        hasta: periodoVisible.hasta,
        dias: producto.serie.map((dia) => ({ fecha: dia.fecha, venta: dia.venta, unidades: dia.unidades })),
        diasComparados: (producto.serieAnterior ?? []).map((dia) => ({ fecha: dia.fecha, venta: dia.venta, unidades: dia.unidades })),
        cobertura: producto.cobertura,
        coberturaComparada: producto.coberturaAnterior,
        comparacion: periodoVisible.comparacion,
        tramo: periodoVisible.tramo,
        anterior: periodoVisible.anterior,
        mostrarComparacion,
      })
    : null;
  const horas = horasProducto(
    (pendiente ? [] : data.horas.filas).map((fila) => ({
      hora: fila.hora,
      venta: fila.venta,
      unidades: fila.unidades,
      ordenes: fila.ordenes,
      ocurrencias: fila.ocurrencias,
    })),
    !pendiente && data.horas.distingueCero && data.horas.reloj === reloj,
  );
  const ids = identificadoresProducto(codigo);
  const volver = `/admin/consumo/productos${consulta ? `?${consulta}` : ""}`;
  const horarios = `/admin/consumo/horarios?${consultaCompartida(consulta, { reloj: "real", detalle: null })}`;
  const horariosNota =
    leida.tienda === TIENDA_DEFAULT
      ? " muestra toda la tienda en este periodo, no solo este producto."
      : " abre el mapa de la tienda principal en este periodo. No conserva esta tienda ni filtra este producto.";

  async function pedir(texto: string) {
    const id = ++req.current;
    setError(null);
    try {
      const respuesta = await fetch(`/api/admin/consumo/producto?codigo=${encodeURIComponent(codigo)}&${texto}`, { cache: "no-store" });
      const json = (await respuesta.json()) as PayloadProducto & { error?: string };
      if (id !== req.current) return;
      if (!respuesta.ok || !json.producto) throw new Error(json.error || "No pudimos cargar el producto");
      setData(json);
      setDataConsulta(texto);
    } catch (causa) {
      if (id !== req.current) return;
      setError(causa instanceof Error ? causa.message : "No pudimos cargar el producto");
    }
  }
  pedirRef.current = pedir;

  useEffect(() => {
    function onPop() {
      const textoUrl = window.location.search.replace(/^\?/, "");
      consultaRef.current = textoUrl;
      setConsulta(textoUrl);
      void pedirRef.current(textoUrl);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function aplicar(patch: Record<string, string | null>) {
    const next = new URLSearchParams(consultaRef.current);
    for (const [key, value] of Object.entries(patch)) {
      if (value == null || value === "") next.delete(key);
      else next.set(key, value);
    }
    const textoUrl = next.toString();
    consultaRef.current = textoUrl;
    window.history.pushState(null, "", `/admin/consumo/productos/${encodeURIComponent(codigo)}${textoUrl ? `?${textoUrl}` : ""}`);
    setConsulta(textoUrl);
    void pedir(textoUrl);
  }

  return (
    <div className="-mx-4 -mt-6 min-h-full bg-[#F4F5F3] px-4 pb-10 pt-5 md:-mx-6 md:px-6">
      <nav aria-label="Miga de pan" className="text-xs text-brand-muted">
        <Link href="/admin/consumo" className="hover:text-brand-ink">Analítica</Link>
        <span aria-hidden="true"> / </span>
        <Link href={volver} className="hover:text-brand-ink" onClick={() => sessionStorage.setItem("analitica-foco-producto", codigo)}>
          Productos
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-brand-ink">{titulo}</span>
      </nav>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={volver} onClick={() => sessionStorage.setItem("analitica-foco-producto", codigo)} className="text-sm font-semibold text-brand-green">
            Volver a Ventas por producto
          </Link>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-brand-ink">{titulo}</h1>
          {linea ? <p className="mt-1 text-sm text-brand-muted">{linea}</p> : null}
          {ids.sku ? <p className="mt-1 text-xs text-brand-muted">SKU {ids.sku}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data.tiendas.length > 1 ? (
            <label className="text-xs font-medium text-brand-muted">
              Tienda
              <select
                value={leida.tienda}
                onChange={(event) => aplicar({ tienda: event.target.value })}
                className="mt-1 block h-9 rounded-md border border-[#E5E7EB] bg-white px-2.5 text-sm"
              >
                {data.tiendas.map((tienda) => (
                  <option key={tienda} value={tienda}>{etiquetaTienda(tienda)}</option>
                ))}
              </select>
            </label>
          ) : (
            <p className="rounded-md border border-[#E6E8E6] bg-white px-3 py-2 text-sm text-brand-ink">
              Tienda <span className="font-semibold">{etiquetaTienda(leida.tienda)}</span>
            </p>
          )}
          {ficha.productId ? (
            <Link href={`/admin/catalogo/productos/${ficha.productId}`} className="inline-flex h-9 items-center rounded-md border border-[#E5E7EB] bg-white px-3 text-sm font-semibold text-brand-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green">
              Abrir en catálogo
            </Link>
          ) : null}
        </div>
      </div>

      <BarraPeriodo
        presetActual={presetActual}
        comparacionActual={comparacionActual}
        desde={periodoVisible.desde}
        hasta={periodoVisible.hasta}
        texto={texto}
        comparacionNoDisponible={!pendiente && data.comparacionEstado === "no_disponible"}
        onPreset={(preset) => {
          if (preset === "custom") aplicar({ preset: "custom", desde: periodoVisible.desde, hasta: periodoVisible.hasta });
          else aplicar({ preset, desde: null, hasta: null });
        }}
        onComparacion={(modo) => aplicar({ comparacion: modo === "off" ? null : modo, comparar: modo === "off" ? "0" : null })}
        onDesde={(fecha) => aplicar({ preset: "custom", desde: fecha })}
        onHasta={(fecha) => aplicar({ preset: "custom", hasta: fecha })}
      />
      <LineaDatos frescura={data.frescura} hasta={periodoVisible.hasta} />

      {error ? (
        <div className="mt-4 rounded-lg border border-[#FECACA] bg-white px-4 py-3" role="alert">
          <p className="text-sm text-brand-error">{error}</p>
          <button type="button" onClick={() => void pedir(consulta)} className="mt-2 text-sm font-semibold text-brand-green">
            Reintentar
          </button>
        </div>
      ) : null}

      {pendiente ? (
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-hidden>
          <div className="h-24 animate-pulse rounded-lg bg-white" />
          <div className="h-24 animate-pulse rounded-lg bg-white" />
          <div className="h-24 animate-pulse rounded-lg bg-white" />
          <div className="h-24 animate-pulse rounded-lg bg-white" />
        </div>
      ) : producto && !producto.encontrado ? (
        <p className="mt-4 rounded-lg border border-[#E6E8E6] bg-white px-4 py-6 text-sm text-brand-muted">No encontramos este producto ni ventas con ese identificador.</p>
      ) : producto ? (
        <>
          {producto.matchEstado === "sin_match" ? (
            <p className="mt-4 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 text-sm text-[#92400E]">
              Esta venta no está ligada al catálogo. El identificador externo se agrega en el import, no desde aquí.{" "}
              <Link href="/admin/catalogo/importar" className="font-semibold underline">Ir al import</Link>
            </p>
          ) : null}
          <section className="mt-4 grid grid-cols-2 items-start gap-3 lg:grid-cols-4">
            <Tarjeta
              etiqueta="Ventas"
              valor={dinero(producto.venta)}
              nota="Con ITBIS"
              extra={<Variacion item={variacionDetalle(producto.venta, producto.ventaAnterior, mostrarComparacion)} />}
              ayuda={mostrarComparacion && producto.ventaAnterior != null ? `Comparado ${dinero(producto.ventaAnterior)}` : null}
            />
            <Tarjeta
              etiqueta="Unidades vendidas"
              valor={formatUnidades(producto.unidades)}
              nota="Netas, con devoluciones restadas"
              extra={<Variacion item={variacionDetalle(producto.unidades, producto.unidadesAnterior, mostrarComparacion)} />}
            />
            <Tarjeta
              etiqueta="Precio medio vendido"
              valor={producto.precioMedio == null ? "—" : dinero(producto.precioMedio)}
              nota="Con ITBIS. Venta dividida entre unidades."
              extra={<Variacion item={variacionDetalle(producto.precioMedio, producto.precioMedioAnterior, mostrarComparacion)} />}
            />
            <Tarjeta
              etiqueta="Utilidad bruta estimada"
              valor={producto.margen == null ? "—" : dinero(producto.margen)}
              nota={producto.margen == null ? "Sin costo. No se usa cero." : `Margen estimado ${formatPctPlano(producto.margenPct)}`}
              definicion={DEFINICION_COSTO}
            />
          </section>
          {producto.venta === 0 && producto.serie.length === 0 ? (
            <p className="mt-3 text-sm text-brand-muted">Sin ventas de este producto en el periodo.</p>
          ) : null}

          <div className="mt-4 grid items-start gap-3 lg:grid-cols-3">
            <section className="rounded-lg border border-[#E6E8E6] bg-white p-3 shadow-sm lg:col-span-2">
              <h2 className="text-sm font-semibold text-brand-ink">Evolución del producto</h2>
              <div className="mt-3">
                {serie ? (
                  <EvolucionProducto
                    puntos={serie.puntos}
                    granularidad={serie.granularidad}
                    mostrarComparacion={mostrarComparacion}
                    etiquetaActual={texto.rango}
                    etiquetaComparada={texto.comparado}
                  />
                ) : null}
              </div>
            </section>
            <PrecioCostoProducto producto={producto} />
          </div>

          <section className="mt-4 rounded-lg border border-[#E6E8E6] bg-white p-3 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-brand-ink">Demanda por hora</h2>
                <p className="mt-1 max-w-2xl text-xs text-brand-muted">
                  {reloj === "real" ? DEFINICIONES_CONSUMO.horaReal : DEFINICIONES_CONSUMO.horaCaja}
                </p>
                {relojNoDisponible ? (
                  <p className="mt-1 max-w-2xl text-xs text-[#92400E]">
                    La hora de la venta no está disponible en esta base. Se muestra el día de caja y una hora ausente no es cero.
                  </p>
                ) : null}
              </div>
              <div className="flex gap-1" role="group" aria-label="Reloj de la demanda">
                <button type="button" aria-pressed={relojPedido === "real"} onClick={() => aplicar({ reloj: null })} className={relojPedido === "real" ? botonActivo : boton}>
                  Hora de la venta
                </button>
                <button type="button" aria-pressed={relojPedido === "caja"} onClick={() => aplicar({ reloj: "caja" })} className={relojPedido === "caja" ? botonActivo : boton}>
                  Día de caja
                </button>
              </div>
            </div>
            {horas.every((hora) => hora.estado === "sin_datos") ? null : (
            <div className="mt-3 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={horas.map((hora) => ({ ...hora, etiqueta: String(hora.hora).padStart(2, "0") }))}>
                  <XAxis dataKey="etiqueta" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} interval={1} />
                  <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} width={48} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const hora = payload[0]?.payload as (typeof horas)[number] | undefined;
                      if (!hora) return null;
                      return (
                        <div className="rounded-md border border-[#E6E8E6] bg-white px-3 py-2 text-xs shadow-sm">
                          <p className="font-semibold">{etiquetaHora(hora.hora)}</p>
                          <p className="mt-1">{hora.estado === "sin_datos" ? "Sin datos. No es cero." : hora.estado === "abierto_sin_ventas" ? "Cero. La hora está cubierta y este producto no se vendió." : `Ventas ${dinero(hora.venta)} · ${formatUnidades(hora.unidades ?? 0)}`}</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="venta" fill={brand.green} radius={[3, 3, 0, 0]} shape={<BarraValor />} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            )}
            <HoraLectura horas={horas} />
            <p className="mt-2 text-xs text-brand-muted">
              {horas.every((hora) => hora.estado === "sin_datos") ? null : "Eje en RD$, con ITBIS. "}
              {data.horas.distingueCero ? "Una hora cubierta y sin ventas de este producto es cero. Una hora sin cobertura no es cero." : "Una hora ausente no es cero."}{" "}
              <Link href={horarios} className="font-semibold text-brand-green focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green">Ver en Horarios</Link>
              <span>{horariosNota}</span>
            </p>
          </section>

          {data.asociados.length > 0 || data.canastaNota ? (
            <section className="mt-4 rounded-lg border border-[#E6E8E6] bg-white p-3 shadow-sm">
              <h2 className="text-sm font-semibold text-brand-ink">Productos comprados juntos</h2>
              {data.canastaNota ? <p className="mt-1 text-xs text-brand-muted">{data.canastaNota}</p> : null}
              {data.asociados.length > 0 ? (
                <ul className="mt-3 divide-y divide-[#EEF1EE]">
                  {data.asociados.map((item) => (
                    <li key={item.codigo} className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm">
                      <Link href={`/admin/consumo/productos/${encodeURIComponent(item.codigo)}?${consulta}`} className="font-semibold text-brand-ink hover:text-brand-green">
                        {item.nombre}
                      </Link>
                      <p className="text-xs text-brand-muted">
                        {item.ticketsCompartidos} tickets compartidos · {item.proporcion == null ? "—" : formatPct(item.proporcion).replace(/^\+/, "")} de los tickets con este producto
                        {item.lift == null ? "" : ` · lift ${item.lift.toLocaleString("es-DO", { maximumFractionDigits: 2 })}`}
                        {item.muestraPequena ? " · muestra pequeña" : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="mt-2 text-xs text-brand-muted">
                El porcentaje es la parte de tickets con este producto que también incluyen al asociado. Lift compara esa pareja con lo esperado si se compraran por separado. No es un efecto causal.
              </p>
            </section>
          ) : null}

          {data.miles.length > 0 ? (
            <section className="mt-4 rounded-lg border border-[#E6E8E6] bg-white p-3 shadow-sm">
              <h2 className="text-sm font-semibold text-brand-ink">Miles</h2>
              <ul className="mt-3 space-y-3">
                {data.miles.map((item) => (
                  <li key={`${item.origen}-${item.id}`} className="rounded-md border border-[#EEF1EE] px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-muted">{ETIQUETA_TIPO[item.tipo] ?? item.tipo}</p>
                    <p className="mt-1 text-sm font-semibold text-brand-ink">{item.titulo}</p>
                    {item.resumen ? <p className="mt-1 text-sm text-brand-ink">{item.resumen}</p> : null}
                    <p className="mt-1 text-xs text-brand-muted">
                      {item.periodoDesde && item.periodoHasta ? `${formatDayKey(item.periodoDesde)} – ${formatDayKey(item.periodoHasta)}` : "Sin periodo declarado"}
                      {item.estado ? ` · ${item.estado}` : ""}
                      {item.actualizadoEn ? ` · ${formatoInstante(item.actualizadoEn)}` : ""}
                    </p>
                    <Link
                      href={item.origen === "propuesta" ? `/admin/consumo/miles/propuestas/${item.id}` : `/admin/consumo/miles/${item.id}`}
                      className="mt-1 inline-block text-sm font-semibold text-brand-green"
                    >
                      Abrir en Miles
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

const boton = "h-9 rounded-md border border-[#E5E7EB] bg-white px-2.5 text-xs font-semibold text-brand-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green";
const botonActivo = "h-9 rounded-md bg-brand-ink px-2.5 text-xs font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green";

function HoraLectura({ horas }: { horas: ReturnType<typeof horasProducto> }) {
  const [horaId, setHoraId] = useState("");
  const elegida = horas.find((hora) => String(hora.hora) === horaId) ?? null;
  const sinSerie = horas.every((hora) => hora.estado === "sin_datos");
  return (
    <div className="mt-2">
      {sinSerie ? <p className="text-sm text-brand-muted">Sin serie horaria en este periodo. Una hora ausente no es cero.</p> : null}
      <label className="mt-2 block text-xs text-brand-muted">
        <span className="sr-only">Elegir hora</span>
        <select
          value={horaId}
          onChange={(event) => setHoraId(event.target.value)}
          className="h-9 rounded-md border border-[#E5E7EB] bg-white px-2 text-xs text-brand-ink"
        >
          <option value="">Ver una hora</option>
          {horas.map((hora) => (
            <option key={hora.hora} value={hora.hora}>
              {etiquetaHora(hora.hora)}
            </option>
          ))}
        </select>
      </label>
      {elegida ? (
        <p className="mt-2 text-xs text-brand-ink" aria-live="polite">
          {etiquetaHora(elegida.hora)}:{" "}
          {elegida.estado === "sin_datos"
            ? "Sin datos. No es cero."
            : elegida.estado === "abierto_sin_ventas"
              ? "Cero. La hora está cubierta y este producto no se vendió."
              : `Ventas ${dinero(elegida.venta)} · ${formatUnidades(elegida.unidades ?? 0)}`}
        </p>
      ) : null}
    </div>
  );
}

function Tarjeta({
  etiqueta,
  valor,
  nota,
  extra,
  ayuda,
  definicion,
}: {
  etiqueta: string;
  valor: string;
  nota: string;
  extra?: React.ReactNode;
  ayuda?: string | null;
  definicion?: string;
}) {
  return (
    <article className="rounded-lg border border-[#E6E8E6] bg-white px-3 py-3 shadow-sm">
      <h2 className="flex items-center text-[11px] font-semibold uppercase tracking-wide text-brand-muted">
        {etiqueta}
        {definicion ? <Definicion texto={definicion} /> : null}
      </h2>
      <p className="mt-1 text-xl font-semibold tabular-nums text-brand-ink">{valor}</p>
      {extra ? <div className="mt-1 text-xs">{extra}</div> : null}
      <p className="mt-1 text-xs text-brand-muted">{nota}</p>
      {ayuda ? <p className="text-xs text-brand-muted">{ayuda}</p> : null}
    </article>
  );
}
