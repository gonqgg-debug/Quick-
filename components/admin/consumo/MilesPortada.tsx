"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MilesGrafica } from "@/components/admin/consumo/MilesGrafica";
import { MilesVisual } from "@/components/admin/consumo/MilesVisual";
import { ETIQUETA_PORTADA, ETIQUETA_PROPUESTA, ETIQUETA_TAREA, ETIQUETA_TIPO, ordenarCasos, type EstadoPortada } from "@/lib/miles-casos";
import { leerGrafica } from "@/lib/miles-grafica";
import { formatoDiaComercial, formatoInstante, graficoAlcanza, esResuelto, leerVisual } from "@/lib/miles-presentacion";
import type { ParCanasta, PuntoSerie } from "@/lib/miles-complementarios";
import { formatNumero, formatPct } from "@/lib/pos-domain";
import { brand } from "@/lib/theme";

type Fila = Record<string, unknown>;

const SECCIONES = [
  ["informe", "Informe de hoy"],
  ["complementarios", "Complementarios"],
  ["propuestas", "Propuestas"],
  ["seguimiento", "Seguimiento"],
  ["rutina", "Rutina"],
] as const;

export function MilesPortada({
  seccion,
  hoy,
  estado,
  informeEsDeHoy,
  informe,
  casos,
  historial,
  hallazgos,
  propuestas,
  pruebas,
  ejecucion,
  tareas,
  tareasInforme,
  complementarios,
  asociaciones,
  datosHasta,
  publicadoEn,
  q,
  orden,
  vista,
}: {
  seccion: string;
  hoy: string;
  estado: EstadoPortada;
  informeEsDeHoy: boolean;
  informe: Fila | null;
  casos: Fila[];
  historial: Fila[];
  hallazgos: Fila[];
  propuestas: Fila[];
  pruebas: Fila[];
  ejecucion: Fila | null;
  tareas: Fila[];
  tareasInforme: Fila[];
  complementarios: {
    semana: string;
    semanaPedida: string;
    aviso: string | null;
    umbral: string;
    pares: ParCanasta[];
    elegido: ParCanasta | null;
    detalle: {
      conteos: { elegibles: number; conA: number; conB: number; conAmbos: number };
      metrica: { metrica: { soporte: number | null; dadoA: number | null; dadoB: number | null; afinidad: number | null; esperados: number | null; muestraPequena: boolean; limitacion: string | null } | null; error: string | null };
      serie: PuntoSerie[];
      desde: string;
      hasta: string;
      parcial: boolean;
    } | null;
  };
  asociaciones: Fila[];
  datosHasta: string | null;
  publicadoEn: string | null;
  q: string;
  orden: string;
  vista: string;
}) {
  const router = useRouter();
  function ir(patch: Record<string, string | null>) {
    const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
    for (const [key, value] of Object.entries(patch)) {
      if (value == null || value === "") params.delete(key);
      else params.set(key, value);
    }
    const query = params.toString();
    router.push(query ? `/admin/consumo/miles?${query}` : "/admin/consumo/miles");
  }
  const vigentes = ordenarCasos(hallazgos.filter((row) => String(row.estado) === "vigente" && !esResuelto(row)));
  const archivo = hallazgos.filter((row) => esResuelto(row) || String(row.estado) === "archivado" || String(row.estado) === "descartado");
  const destacados = (casos.length > 0 ? casos : vigentes).slice(0, 3);
  const oportunidades = casos.length > 0 ? casos.filter((row) => String(row.tipo) === "oportunidad") : vigentes.filter((row) => String(row.tipo) === "oportunidad");

  return (
    <div className="-mx-4 -mt-6 bg-[#F4F5F3] px-4 py-6 md:-mx-6 md:px-6">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold text-brand-muted">Analítica / Miles</p>
          <h1 className="font-display text-3xl font-bold text-[#111827]">Miles</h1>
          <p className="mt-1 text-sm text-brand-muted">Análisis diario y oportunidades para Quick!</p>
        </div>
        <div className="text-sm text-brand-muted">
          <p>Quick · {informe ? `Informe del ${formatoDiaComercial(String(informe.fecha))}` : `Hoy ${formatoDiaComercial(hoy)}`}</p>
          <p>{datosHasta ? `Datos hasta ${formatoDiaComercial(datosHasta)}` : "Sin fecha de datos"}</p>
          <p>{publicadoEn ? `Publicado ${formatoInstante(publicadoEn)}` : "Sin publicación"}</p>
          <p className="mt-1 inline-flex rounded-full bg-white px-2 py-1 text-xs font-semibold text-[#111827]">{ETIQUETA_PORTADA[estado]}</p>
        </div>
      </header>

      <nav className="mt-4 flex flex-wrap gap-1.5" aria-label="Secciones de Miles">
        {SECCIONES.map(([id, label]) => (
          <button key={id} type="button" onClick={() => ir({ seccion: id === "informe" ? null : id })} className="rounded-full px-3 py-1.5 text-sm font-semibold" style={{ backgroundColor: seccion === id ? brand.green : "#fff", color: seccion === id ? "#fff" : brand.ink }}>
            {label}
          </button>
        ))}
      </nav>

      {seccion === "informe" ? (
        <Informe
          hoy={hoy}
          estado={estado}
          informeEsDeHoy={informeEsDeHoy}
          informe={informe}
          destacados={destacados}
          casosSonInforme={casos.length > 0}
          oportunidades={oportunidades}
          tareas={tareasInforme}
          historial={historial}
          ir={ir}
        />
      ) : null}
      {seccion === "complementarios" ? (
        <Complementarios datos={complementarios} asociaciones={asociaciones} q={q} orden={orden} vista={vista} ir={ir} />
      ) : null}
      {seccion === "propuestas" ? <Propuestas propuestas={propuestas} /> : null}
      {seccion === "seguimiento" ? <Seguimiento vigentes={vigentes} archivo={archivo} pruebas={pruebas} /> : null}
      {seccion === "rutina" ? <Rutina ejecucion={ejecucion} tareas={tareas} /> : null}
    </div>
  );
}

function Informe({
  hoy,
  estado,
  informeEsDeHoy,
  informe,
  destacados,
  casosSonInforme,
  oportunidades,
  tareas,
  historial,
  ir,
}: {
  hoy: string;
  estado: EstadoPortada;
  informeEsDeHoy: boolean;
  informe: Fila | null;
  destacados: Fila[];
  casosSonInforme: boolean;
  oportunidades: Fila[];
  tareas: Fila[];
  historial: Fila[];
  ir: (patch: Record<string, string | null>) => void;
}) {
  return (
    <div className="mt-4 space-y-4">
      {!informeEsDeHoy && informe ? (
        <p className="rounded-lg border border-[#E6E8E6] bg-white px-3 py-2 text-sm">Este informe es del {formatoDiaComercial(String(informe.fecha))}. No es el de hoy, {formatoDiaComercial(hoy)}.</p>
      ) : null}
      {!informe ? (
        <p className="rounded-lg border border-[#E6E8E6] bg-white px-3 py-2 text-sm">
          {estado === "en_curso" ? "Hay una ejecución en curso. Todavía no hay informe de hoy." : estado === "fallida" ? "La última ejecución falló y no dejó informe de hoy." : "No hay un informe publicado para hoy."}
          {historial[0] ? ` El último es del ${formatoDiaComercial(String(historial[0].fecha))}.` : ""}
        </p>
      ) : null}
      <section className="rounded-lg border border-[#E6E8E6] bg-white p-4">
        <h2 className="text-sm font-semibold">Resumen</h2>
        <p className="mt-2 text-sm leading-6 text-[#111827]">{informe ? String(informe.conclusion) : "Miles no publicó una conclusión para esta fecha."}</p>
        {informe?.novedades ? <p className="mt-2 text-sm text-brand-muted">Nuevo: {String(informe.novedades)}</p> : null}
        {informe?.actualizaciones ? <p className="mt-1 text-sm text-brand-muted">Actualizado: {String(informe.actualizaciones)}</p> : null}
        {informe?.bloqueos ? <p className="mt-1 text-sm text-brand-muted">Bloqueos: {String(informe.bloqueos)}</p> : null}
      </section>
      <section>
        <h2 className="text-sm font-semibold">Análisis destacados</h2>
        {!casosSonInforme && destacados.length > 0 ? <p className="mt-1 text-xs text-brand-muted">No forman parte de un informe de hoy. Siguen vigentes.</p> : null}
        {destacados.length === 0 ? <p className="mt-2 text-sm text-brand-muted">No hay análisis vigentes para mostrar. No se inventan hallazgos.</p> : null}
        <div className="mt-2 grid gap-3 lg:grid-cols-3">
          {destacados.map((row) => (
            <Analisis key={String(row.hallazgo_id ?? row.id)} row={row} />
          ))}
        </div>
      </section>
      <section className="rounded-lg border border-[#E6E8E6] bg-white p-4">
        <h2 className="text-sm font-semibold">Oportunidades</h2>
        {oportunidades.length === 0 ? <p className="mt-2 text-sm text-brand-muted">{casosSonInforme ? "Este informe no publicó oportunidades." : "No hay oportunidades vigentes."}</p> : null}
        <ul className="mt-2 space-y-2">
          {oportunidades.slice(0, 8).map((row) => (
            <li key={String(row.hallazgo_id ?? row.id)}>
              <Link href={`/admin/consumo/miles/${row.hallazgo_id ?? row.id}`} className="text-sm font-semibold" style={{ color: "#3F6B1C" }}>
                {String(row.titulo)}
              </Link>
              <p className="text-sm text-brand-muted">{String(row.recomendacion ?? row.conclusion ?? row.resumen ?? "")}</p>
              <p className="text-xs text-brand-muted">{String(row.proximo_paso ?? row.estado_en_publicacion ?? row.estado ?? "")}</p>
            </li>
          ))}
        </ul>
      </section>
      <Trabajo informe={informe} tareas={tareas} />
      <section>
        <h2 className="text-sm font-semibold">Informes anteriores</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {historial.map((row) => (
            <button key={String(row.id)} type="button" onClick={() => ir({ informe: String(row.id), fecha: String(row.fecha).slice(0, 10), seccion: null })} className="rounded-full bg-white px-3 py-1 text-xs font-semibold">
              {formatoDiaComercial(String(row.fecha).slice(0, 10))}
              {row.estado === "parcial" ? " · parcial" : ""}
            </button>
          ))}
          {historial.length === 0 ? <p className="text-sm text-brand-muted">Todavía no hay informes guardados.</p> : null}
        </div>
      </section>
    </div>
  );
}

function Trabajo({ informe, tareas }: { informe: Fila | null; tareas: Fila[] }) {
  const trabajo = trabajoDe(informe);
  const vacio = !trabajo && tareas.length === 0;
  return (
    <section className="rounded-lg border border-[#E6E8E6] bg-white p-4">
      <h2 className="text-sm font-semibold">Trabajo realizado</h2>
      {vacio ? <p className="mt-2 text-sm text-brand-muted">Este informe no publicó las áreas revisadas. Una corrida cerrada no cuenta como rutina hecha.</p> : null}
      {trabajo ? (
        <div className="mt-2 space-y-1 text-sm">
          {trabajo.areas.length > 0 ? <p>Revisó: {trabajo.areas.join(", ")}.</p> : null}
          {trabajo.revalidados.length > 0 ? <p>Revalidó: {trabajo.revalidados.join(", ")}.</p> : null}
          {trabajo.pruebas.length > 0 ? <p>Pruebas: {trabajo.pruebas.join(", ")}.</p> : null}
          {trabajo.bloqueos.length > 0 ? <p>Bloqueos: {trabajo.bloqueos.join(", ")}.</p> : null}
        </div>
      ) : null}
      {tareas.length > 0 ? (
        <ul className="mt-2 space-y-1 text-sm">
          {tareas.map((tarea) => (
            <li key={String(tarea.area)}>
              {String(tarea.area)}: {ETIQUETA_TAREA[String(tarea.estado)] ?? String(tarea.estado)}
              {tarea.error ? ` — ${String(tarea.error)}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function trabajoDe(informe: Fila | null): { areas: string[]; revalidados: string[]; pruebas: string[]; bloqueos: string[] } | null {
  const raw = informe?.trabajo;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const lista = (value: unknown) => (Array.isArray(value) ? value.map(String).filter(Boolean) : []);
  const trabajo = raw as Record<string, unknown>;
  const salida = { areas: lista(trabajo.areas), revalidados: lista(trabajo.revalidados), pruebas: lista(trabajo.pruebas), bloqueos: lista(trabajo.bloqueos) };
  return salida.areas.length + salida.revalidados.length + salida.pruebas.length + salida.bloqueos.length > 0 ? salida : null;
}

function Analisis({ row }: { row: Fila }) {
  const id = String(row.hallazgo_id ?? row.id ?? "");
  const titulo = String(row.titulo ?? "");
  const conclusion = String(row.conclusion ?? row.resumen ?? "");
  const grafica = leerGrafica(row.grafica);
  const visual = leerVisual(row.visual).visual;
  return (
    <article className="rounded-lg border border-[#E6E8E6] bg-white p-3">
      <p className="text-xs font-semibold text-brand-muted">{ETIQUETA_TIPO[String(row.tipo)] ?? "Análisis"} · {String(row.prioridad ?? row.estado_en_publicacion ?? "")}</p>
      <h3 className="mt-1 text-sm font-semibold">
        <Link href={`/admin/consumo/miles/${id}`}>{titulo}</Link>
      </h3>
      <p className="mt-1 text-sm leading-5">{conclusion}</p>
      {grafica.grafica ? <div className="mt-2"><MilesGrafica grafica={grafica.grafica} /></div> : null}
      {!grafica.grafica && visual && graficoAlcanza(visual) ? <div className="mt-2"><MilesVisual visual={visual} /></div> : null}
      {!grafica.grafica && !graficoAlcanza(visual) ? <p className="mt-2 text-xs text-brand-muted">Sin serie publicada. El texto no se convierte en gráfica.</p> : null}
    </article>
  );
}

function Complementarios({
  datos,
  asociaciones,
  q,
  orden,
  vista,
  ir,
}: {
  datos: {
    semana: string;
    semanaPedida: string;
    aviso: string | null;
    umbral: string;
    pares: ParCanasta[];
    elegido: ParCanasta | null;
    detalle: {
      conteos: { elegibles: number; conA: number; conB: number; conAmbos: number };
      metrica: { metrica: { soporte: number | null; dadoA: number | null; dadoB: number | null; afinidad: number | null; esperados: number | null; muestraPequena: boolean; limitacion: string | null } | null; error: string | null };
      serie: PuntoSerie[];
      desde: string;
      hasta: string;
      parcial: boolean;
    } | null;
  };
  asociaciones: Fila[];
  q: string;
  orden: string;
  vista: string;
  ir: (patch: Record<string, string | null>) => void;
}) {
  const modo = vista === "oportunidades" || vista === "cambios" ? vista : "juntos";
  const filtrados = datos.pares
    .filter((par) => `${par.nombreA} ${par.nombreB} ${par.productoA} ${par.productoB}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => {
      if (orden === "afinidad") return (b.lift ?? -1) - (a.lift ?? -1);
      if (orden === "cambio") return (b.deltaJuntos ?? Number.NEGATIVE_INFINITY) - (a.deltaJuntos ?? Number.NEGATIVE_INFINITY);
      return b.ordenesJuntas - a.ordenesJuntas;
    });
  const oportunidades = asociaciones.filter((row) => String(row.oportunidad ?? "").trim() !== "");
  const nota = datos.elegido ? asociaciones.find((row) => String(row.codigo_a) === datos.elegido?.productoA && String(row.codigo_b) === datos.elegido?.productoB) : null;
  const metrica = datos.detalle?.metrica.metrica;
  return (
    <div className="mt-4">
      <div className="mb-3 flex flex-wrap gap-1.5" aria-label="Vistas de complementarios">
        {(
          [
            ["juntos", "Se compran juntos"],
            ["oportunidades", "Oportunidades"],
            ["cambios", "Cambios recientes"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              if (id === "cambios") ir({ vista: "cambios", orden: "cambio" });
              else if (id === "juntos") ir({ vista: null, orden: null });
              else ir({ vista: "oportunidades" });
            }}
            className="rounded-full px-3 py-1.5 text-sm font-semibold"
            style={{ backgroundColor: modo === id ? brand.green : "#fff", color: modo === id ? "#fff" : brand.ink }}
          >
            {label}
          </button>
        ))}
      </div>
      {modo === "oportunidades" ? <OportunidadesPares filas={oportunidades} /> : null}
      {modo !== "oportunidades" ? (
      <>
      {modo === "cambios" ? (
        <p className="mb-2 text-xs text-brand-muted">El cambio es la diferencia de tickets juntos contra la semana anterior observada. Si esa semana no tiene el par, no se usa cero.</p>
      ) : null}
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs font-medium text-brand-muted">
          Semana
          <input type="date" defaultValue={datos.semanaPedida} onChange={(event) => ir({ semana: event.target.value || null, par: null })} className="mt-1 block rounded-md border border-[#E6E8E6] bg-white px-2 py-1.5 text-sm" />
        </label>
        <label className="text-xs font-medium text-brand-muted">
          Producto
          <input defaultValue={q} onBlur={(event) => ir({ q: event.target.value || null })} className="mt-1 block rounded-md border border-[#E6E8E6] bg-white px-2 py-1.5 text-sm" placeholder="Buscar" />
        </label>
        <label className="text-xs font-medium text-brand-muted">
          Orden
          <select value={orden || "tickets"} onChange={(event) => ir({ orden: event.target.value === "tickets" ? null : event.target.value })} className="mt-1 block rounded-md border border-[#E6E8E6] bg-white px-2 py-1.5 text-sm">
            <option value="tickets">Tickets compartidos</option>
            <option value="afinidad">Afinidad</option>
            <option value="cambio">Cambio de tickets</option>
          </select>
        </label>
      </div>
      <p className="mt-2 text-xs text-brand-muted">Semana del {datos.semana}. {datos.umbral}</p>
      {datos.aviso ? <p className="mt-2 text-sm">{datos.aviso}</p> : null}
      {filtrados.length === 0 ? <p className="mt-4 rounded-lg bg-white p-4 text-sm">No hay asociaciones con la muestra mínima en esta semana.</p> : null}
      <div className="mt-3 grid gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
        <ul className="max-h-[32rem] space-y-1 overflow-auto rounded-lg border border-[#E6E8E6] bg-white p-2">
          {filtrados.map((par) => {
            const activo = datos.elegido?.productoA === par.productoA && datos.elegido?.productoB === par.productoB;
            return (
              <li key={`${par.productoA}-${par.productoB}`}>
                <button type="button" onClick={() => ir({ par: `${par.productoA}|${par.productoB}` })} className="w-full rounded-md px-2 py-2 text-left text-sm" style={{ backgroundColor: activo ? "#F1F7EA" : "transparent" }}>
                  <span className="font-semibold">{par.nombreA}</span> + {par.nombreB}
                  <span className="mt-0.5 block text-xs text-brand-muted">
                    {formatNumero(par.ordenesJuntas)} tickets · afinidad {par.lift == null ? "—" : formatNumero(par.lift, 2)}
                    {modo === "cambios" ? ` · ${par.deltaJuntos == null ? "sin semana previa" : `${par.deltaJuntos > 0 ? "+" : ""}${formatNumero(par.deltaJuntos)}`}` : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {datos.elegido && datos.detalle ? (
          <article className="rounded-lg border border-[#E6E8E6] bg-white p-4">
            <div className="flex gap-3">
              <Foto src={datos.elegido.fotoA} nombre={datos.elegido.nombreA} />
              <Foto src={datos.elegido.fotoB} nombre={datos.elegido.nombreB} />
              <div>
                <h2 className="text-base font-semibold">{datos.elegido.nombreA} + {datos.elegido.nombreB}</h2>
                <p className="text-xs text-brand-muted">
                  <Link href={`/admin/consumo/productos/${encodeURIComponent(datos.elegido.productoA)}`}>Ver {datos.elegido.nombreA}</Link>
                  {" · "}
                  <Link href={`/admin/consumo/productos/${encodeURIComponent(datos.elegido.productoB)}`}>Ver {datos.elegido.nombreB}</Link>
                </p>
              </div>
            </div>
            <p className="mt-3 text-sm">
              {formatNumero(datos.detalle.conteos.conAmbos)} tickets juntos de {formatNumero(datos.detalle.conteos.elegibles)} elegibles, del {datos.detalle.desde} al {datos.detalle.hasta}.
              {datos.detalle.parcial ? " La semana todavía no cierra; el detalle llega hasta el último día completo." : ""}
            </p>
            {datos.detalle.metrica.error ? <p className="mt-2 text-sm">{datos.detalle.metrica.error}</p> : null}
            {metrica ? (
              <dl className="mt-3 grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
                <Dato etiqueta="A → B" valor={pct(metrica.dadoA)} />
                <Dato etiqueta="B → A" valor={pct(metrica.dadoB)} />
                <Dato etiqueta="Soporte" valor={pct(metrica.soporte)} />
                <Dato etiqueta="Afinidad" valor={metrica.afinidad == null ? "—" : formatNumero(metrica.afinidad, 2)} />
                <Dato etiqueta="Juntos esperados" valor={metrica.esperados == null ? "—" : formatNumero(metrica.esperados, 1)} />
                <Dato etiqueta="Juntos observados" valor={formatNumero(datos.detalle.conteos.conAmbos)} />
              </dl>
            ) : null}
            {metrica?.limitacion ? <p className="mt-2 text-xs text-brand-muted">{metrica.limitacion} La afinidad no dice que un producto cause al otro.</p> : <p className="mt-2 text-xs text-brand-muted">Estos indicadores no dicen que un producto sea causa o sustituto del otro.</p>}
            <Serie serie={datos.detalle.serie} />
            <div className="mt-3 text-sm">
              <h3 className="font-semibold">Miles</h3>
              {nota ? (
                <>
                  <p className="mt-1">{String(nota.observacion ?? "Sin observación publicada.")}</p>
                  {nota.cambio ? <p className="mt-1">Qué cambió: {String(nota.cambio)}</p> : null}
                  {nota.solidez ? <p className="mt-1">Solidez: {String(nota.solidez)}. No es una probabilidad de venta.</p> : null}
                  {nota.oportunidad ? <p className="mt-1">Oportunidad: {String(nota.oportunidad)}</p> : null}
                  {nota.proximo_paso ? <p className="mt-1">Siguiente: {String(nota.proximo_paso)}</p> : null}
                  {nota.limitaciones ? <p className="mt-1 text-brand-muted">{String(nota.limitaciones)}</p> : null}
                  {nota.estado === "historica" ? <p className="mt-1 text-brand-muted">Miles marcó esta asociación como histórica.</p> : null}
                </>
              ) : (
                <p className="mt-1 text-brand-muted">Miles no publicó una interpretación de este par. La asociación calculada sigue visible.</p>
              )}
              <p className="mt-2 text-xs text-brand-muted">Disponibilidad desconocida. {nota?.limitaciones ? "" : "No hay un costo publicado para este par, así que el margen no se estima."}</p>
            </div>
          </article>
        ) : (
          <p className="rounded-lg bg-white p-4 text-sm text-brand-muted">Elige una asociación para ver los conteos.</p>
        )}
      </div>
      </>
      ) : null}
    </div>
  );
}

function OportunidadesPares({ filas }: { filas: Fila[] }) {
  if (filas.length === 0) {
    return <p className="rounded-lg bg-white p-4 text-sm">Miles no publicó oportunidades sobre asociaciones. La canasta calculada sigue en «Se compran juntos».</p>;
  }
  return (
    <ul className="space-y-3">
      {filas.map((row) => (
        <li key={String(row.id)} className="rounded-lg border border-[#E6E8E6] bg-white p-4">
          <p className="text-xs font-semibold text-brand-muted">{String(row.estado)} · {String(row.periodo_desde).slice(0, 10)} a {String(row.periodo_hasta).slice(0, 10)}</p>
          <h2 className="text-base font-semibold">{String(row.nombre_a ?? row.codigo_a)} + {String(row.nombre_b ?? row.codigo_b)}</h2>
          <p className="mt-1 text-sm">{String(row.oportunidad)}</p>
          {row.observacion ? <p className="mt-1 text-sm text-brand-muted">{String(row.observacion)}</p> : null}
          {row.proximo_paso ? <p className="mt-1 text-sm">Siguiente: {String(row.proximo_paso)}</p> : null}
          {row.limitaciones ? <p className="mt-1 text-xs text-brand-muted">{String(row.limitaciones)}</p> : null}
          <p className="mt-2 text-xs">
            <Link href={`/admin/consumo/productos/${encodeURIComponent(String(row.codigo_a))}`}>Producto A</Link>
            {" · "}
            <Link href={`/admin/consumo/productos/${encodeURIComponent(String(row.codigo_b))}`}>Producto B</Link>
          </p>
        </li>
      ))}
    </ul>
  );
}

function Serie({ serie }: { serie: PuntoSerie[] }) {
  if (serie.length === 0) return <p className="mt-3 text-xs text-brand-muted">No hay semanas anteriores con este par. Las semanas sin observaciones no se dibujan en cero.</p>;
  const grafica = leerGrafica({
    titulo: "Tickets juntos por semana",
    tipo: "linea",
    unidad: "numero",
    serie: serie.map((punto) => ({ etiqueta: punto.semana.slice(5), valor: punto.juntos })),
    agregacion: "Tickets distintos en los que aparecen ambos productos.",
    proyeccion: false,
  });
  return grafica.grafica ? <div className="mt-3"><MilesGrafica grafica={grafica.grafica} /></div> : null;
}

function Propuestas({ propuestas }: { propuestas: Fila[] }) {
  const router = useRouter();
  const [aviso, setAviso] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [inicio, setInicio] = useState("");
  const [nota, setNota] = useState("");
  async function actuar(id: string, version: number, accion: string, extra: Record<string, string> = {}) {
    const respuesta = await fetch(`/api/admin/miles/propuestas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion, version, ...extra }),
    });
    const cuerpo = await respuesta.json();
    setAviso(cuerpo.aviso ?? cuerpo.error ?? "Listo");
    if (respuesta.ok) {
      setAbierta(null);
      setNota("");
      router.refresh();
    }
  }
  return (
    <div className="mt-4 space-y-3">
      <p className="text-sm text-brand-muted">Estas propuestas las publicó Miles. Aprobar o registrar una implementación no cambia precios ni pedidos.</p>
      {aviso ? <p className="text-sm">{aviso}</p> : null}
      {propuestas.length === 0 ? <p className="rounded-lg bg-white p-4 text-sm">Miles todavía no publicó propuestas.</p> : null}
      {propuestas.map((row) => {
        const id = String(row.id);
        return (
          <article key={id} className="rounded-lg border border-[#E6E8E6] bg-white p-4">
            <p className="text-xs font-semibold text-brand-muted">{ETIQUETA_PROPUESTA[String(row.estado)] ?? String(row.estado)}</p>
            <h2 className="text-base font-semibold">
              <Link href={`/admin/consumo/miles/propuestas/${id}`}>{String(row.nombre)}</Link>
            </h2>
            <p className="mt-1 text-sm">{String(row.objetivo)}</p>
            {row.limitaciones ? <p className="mt-1 text-sm text-brand-muted">{String(row.limitaciones)}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="rounded-full bg-[#F3F4F6] px-3 py-1 text-xs font-semibold" onClick={() => actuar(id, Number(row.version), "aprobar")}>Aprobar para implementar</button>
              <button type="button" className="rounded-full bg-[#F3F4F6] px-3 py-1 text-xs font-semibold" onClick={() => { setAbierta(abierta === `impl-${id}` ? null : `impl-${id}`); setNota(""); }}>Registrar implementación</button>
              <button type="button" className="rounded-full bg-[#F3F4F6] px-3 py-1 text-xs font-semibold" onClick={() => { setAbierta(abierta === `ctx-${id}` ? null : `ctx-${id}`); setNota(""); }}>Aportar contexto</button>
            </div>
            {abierta === `impl-${id}` ? (
              <form className="mt-3 grid gap-2" onSubmit={(event) => { event.preventDefault(); void actuar(id, Number(row.version), "implementar", { inicio, nota }); }}>
                <label className="text-xs font-medium text-brand-muted">Fecha real de inicio
                  <input required type="date" value={inicio} onChange={(event) => setInicio(event.target.value)} className="mt-1 block rounded-md border border-[#E6E8E6] px-2 py-1.5 text-sm" />
                </label>
                <label className="text-xs font-medium text-brand-muted">Qué se implementó
                  <textarea required minLength={3} value={nota} onChange={(event) => setNota(event.target.value)} className="mt-1 block w-full rounded-md border border-[#E6E8E6] px-2 py-1.5 text-sm" />
                </label>
                <button type="submit" className="w-fit rounded-full px-3 py-1.5 text-xs font-semibold text-white" style={{ backgroundColor: brand.green }}>Guardar implementación</button>
              </form>
            ) : null}
            {abierta === `ctx-${id}` ? (
              <form className="mt-3 grid gap-2" onSubmit={(event) => { event.preventDefault(); void actuar(id, Number(row.version), "contexto", { nota }); }}>
                <label className="text-xs font-medium text-brand-muted">Contexto para este caso
                  <textarea required minLength={3} value={nota} onChange={(event) => setNota(event.target.value)} className="mt-1 block w-full rounded-md border border-[#E6E8E6] px-2 py-1.5 text-sm" />
                </label>
                <button type="submit" className="w-fit rounded-full px-3 py-1.5 text-xs font-semibold text-white" style={{ backgroundColor: brand.green }}>Guardar contexto</button>
              </form>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function Seguimiento({ vigentes, archivo, pruebas }: { vigentes: Fila[]; archivo: Fila[]; pruebas: Fila[] }) {
  const activas = pruebas.filter((row) => !["finalizada", "cancelada"].includes(String(row.estado)));
  return (
    <div className="mt-4 space-y-4">
      <section className="rounded-lg border border-[#E6E8E6] bg-white p-4">
        <h2 className="text-sm font-semibold">Casos activos</h2>
        {vigentes.length === 0 ? <p className="mt-2 text-sm text-brand-muted">No hay casos vigentes.</p> : null}
        <ul className="mt-2 space-y-2">
          {vigentes.map((row) => (
            <li key={String(row.id)}>
              <Link href={`/admin/consumo/miles/${row.id}`} className="text-sm font-semibold">{String(row.titulo)}</Link>
              <p className="text-xs text-brand-muted">{String(row.proximo_paso ?? row.recomendacion ?? "Sin próximo paso publicado.")}</p>
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-lg border border-[#E6E8E6] bg-white p-4">
        <h2 className="text-sm font-semibold">Pruebas</h2>
        {activas.length === 0 ? <p className="mt-2 text-sm text-brand-muted">No hay pruebas con implementación registrada en curso.</p> : null}
        <ul className="mt-2 space-y-2 text-sm">
          {activas.map((row) => (
            <li key={String(row.id)}>
              {String(row.accion)} · {String(row.estado)}
              {row.inicio_real ? ` · inició ${formatoDiaComercial(String(row.inicio_real))}` : " · sin fecha real de inicio"}
              <p className="text-xs text-brand-muted">Sin una implementación registrada no se atribuye el resultado a la propuesta. Una comparación antes y después no demuestra causalidad.</p>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="text-sm font-semibold">Archivo</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {archivo.map((row) => (
            <li key={String(row.id)}>
              <Link href={`/admin/consumo/miles/${row.id}`}>{String(row.titulo)}</Link>
              <span className="text-brand-muted"> · {String(row.resolucion ?? row.estado)} {row.actualizado_en ? formatoInstante(String(row.actualizado_en)) : ""}</span>
            </li>
          ))}
          {archivo.length === 0 ? <li className="text-brand-muted">No hay casos resueltos en el archivo.</li> : null}
        </ul>
      </section>
    </div>
  );
}

function Rutina({ ejecucion, tareas }: { ejecucion: Fila | null; tareas: Fila[] }) {
  return (
    <div className="mt-4 rounded-lg border border-[#E6E8E6] bg-white p-4">
      <h2 className="text-sm font-semibold">Última corrida</h2>
      {ejecucion ? (
        <p className="mt-2 text-sm">
          {String(ejecucion.estado)} · inició {formatoInstante(String(ejecucion.iniciada_en))}
          {ejecucion.terminada_en ? ` · terminó ${formatoInstante(String(ejecucion.terminada_en))}` : ""}
          {ejecucion.error ? ` · ${String(ejecucion.error)}` : ""}
        </p>
      ) : (
        <p className="mt-2 text-sm">No hay corridas.</p>
      )}
      <p className="mt-2 text-xs text-brand-muted">Cerrar la corrida no completa la rutina. Cada área aparece solo si Miles publicó su tarea. El horario externo del agente no se configura desde esta página.</p>
      {tareas.length === 0 ? <p className="mt-3 text-sm">Esta corrida no tiene tareas. No se muestran áreas como hechas.</p> : null}
      <ul className="mt-3 space-y-2 text-sm">
        {tareas.map((tarea) => (
          <li key={String(tarea.id)} className="rounded-md border border-[#E6E8E6] px-3 py-2">
            <p className="font-semibold">{String(tarea.area)} · {ETIQUETA_TAREA[String(tarea.estado)] ?? String(tarea.estado)}</p>
            {tarea.datos_revisados ? <p>{String(tarea.datos_revisados)}</p> : null}
            {tarea.entregable ? <p>Entregable: {String(tarea.entregable)}</p> : null}
            {tarea.error ? <p>Bloqueo: {String(tarea.error)}</p> : null}
            {tarea.proximo_paso ? <p>Siguiente: {String(tarea.proximo_paso)}</p> : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Foto({ src, nombre }: { src: string | null; nombre: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="h-14 w-14 rounded-md object-cover" />
  ) : (
    <span className="flex h-14 w-14 items-center justify-center rounded-md bg-[#F3F4F6] text-[10px] text-brand-muted">{nombre.slice(0, 1)}</span>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs text-brand-muted">{etiqueta}</dt>
      <dd className="font-semibold">{valor}</dd>
    </div>
  );
}

function pct(valor: number | null): string {
  return valor == null ? "—" : formatPct(valor).replace("+", "");
}
