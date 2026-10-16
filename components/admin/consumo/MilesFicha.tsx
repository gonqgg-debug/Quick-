"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MilesVisual, textoComparacion, textoMetrica } from "@/components/admin/consumo/MilesVisual";
import { Pildora } from "@/components/admin/consumo/ui";
import type { EvidenciaMiles } from "@/lib/miles-domain";
import { formatNumero } from "@/lib/pos-domain";
import {
  clasificarHallazgo,
  formatoDiaComercial,
  formatoInstante,
  graficoAlcanza,
  leerVisual,
  recomendacionActual,
  recomendacionAnterior,
  visualCoherente,
  type VisualMiles,
} from "@/lib/miles-presentacion";
import { brand } from "@/lib/theme";

type Fila = Record<string, unknown>;

const TIPO: Record<string, string> = {
  oportunidad: "Oportunidad",
  deterioro: "Deterioro",
  patron: "Patrón",
  anomalia: "Anomalía",
  calidad: "Calidad de datos",
};

const CLASE: Record<string, { texto: string; tono: "gris" | "naranja" | "verde" | "rojo" }> = {
  requiere_revision: { texto: "Requiere revisión", tono: "naranja" },
  resuelto: { texto: "Resuelto", tono: "verde" },
  vigente: { texto: "Vigente", tono: "verde" },
  descartado: { texto: "Descartado", tono: "gris" },
  archivado: { texto: "Archivado", tono: "gris" },
};

export function etiquetaTipo(tipo: string): string {
  return TIPO[tipo] ?? tipo;
}

export function etiquetaClase(row: Fila): { texto: string; tono: "gris" | "naranja" | "verde" | "rojo" } {
  return CLASE[clasificarHallazgo(row)] ?? CLASE.vigente;
}

export function hrefExplorar(pantalla: string, query: string): string {
  const base = pantalla === "productos" ? "/admin/consumo/productos" : pantalla === "horarios" ? "/admin/consumo/horarios" : pantalla === "canasta" ? "/admin/consumo/canasta" : "/admin/consumo";
  return query ? `${base}?${query}` : base;
}

export function enlacePrincipal(row: Fila): { pantalla: string; query: string } | null {
  const evidencia = row.evidencia;
  if (!evidencia || typeof evidencia !== "object") return null;
  const enlaces = (evidencia as { enlaces?: unknown }).enlaces;
  if (!Array.isArray(enlaces) || !enlaces[0] || typeof enlaces[0] !== "object") return null;
  const primero = enlaces[0] as { pantalla?: unknown; query?: unknown };
  if (typeof primero.pantalla !== "string") return null;
  return { pantalla: primero.pantalla, query: typeof primero.query === "string" ? primero.query : "" };
}

export function visualDe(row: Fila): { visual: VisualMiles | null; coherente: boolean; motivo: string | null } {
  const leido = leerVisual(row.visual);
  const metricas = row.metricas && typeof row.metricas === "object" ? (row.metricas as Record<string, unknown>) : {};
  const coherencia = visualCoherente(leido.visual, metricas);
  return { visual: leido.error ? null : leido.visual, coherente: coherencia.ok && !leido.error, motivo: leido.error ?? coherencia.motivo };
}

export function MilesFicha({
  row,
  eventos,
  comentarios,
  investigaciones,
  onClose,
  tituloId,
}: {
  row: Fila;
  eventos: Fila[];
  comentarios: Fila[];
  investigaciones: Fila[];
  onClose?: () => void;
  tituloId?: string;
}) {
  const router = useRouter();
  const clase = etiquetaClase(row);
  const visual = visualDe(row);
  const actual = recomendacionActual(row);
  const anterior = recomendacionAnterior(row);
  const evidencia = (row.evidencia ?? {}) as EvidenciaMiles;
  const metricas = row.metricas && typeof row.metricas === "object" ? (row.metricas as Record<string, unknown>) : {};
  const [motivo, setMotivo] = useState("");
  const [pregunta, setPregunta] = useState("");
  const [comentario, setComentario] = useState("");
  const [confirmar, setConfirmar] = useState<"resolver" | "archivar" | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const vigente = String(row.estado) === "vigente" && row.resolucion !== "resuelta";

  async function enviar(body: Record<string, unknown>) {
    const respuesta = await fetch(`/api/admin/miles/hallazgos/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version: Number(row.version), ...body }),
    });
    const json = await respuesta.json().catch(() => ({}));
    setAviso(json.aviso ?? json.error ?? (respuesta.ok ? "Listo" : "No se pudo guardar"));
    if (!respuesta.ok) return;
    if (body.accion === "comentario") setComentario("");
    if (body.accion === "ampliacion") setPregunta("");
    if (body.accion === "descartar") setMotivo("");
    setConfirmar(null);
    router.refresh();
  }

  function actuar(accion: "resolver" | "archivar") {
    if (confirmar !== accion) {
      setConfirmar(accion);
      return;
    }
    void enviar({ accion });
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <Pildora tono="gris">{etiquetaTipo(String(row.tipo))}</Pildora>
          <Pildora tono={clase.tono}>{clase.texto}</Pildora>
          {row.prioridad === "alta" ? <Pildora tono="rojo">Prioridad alta</Pildora> : null}
        </div>
        <h2 id={tituloId} className="mt-3 text-xl font-semibold leading-snug text-[#111827]">{String(row.titulo)}</h2>
        <p className="mt-1 text-sm text-brand-muted">
          {formatoDiaComercial(row.periodo_desde)} a {formatoDiaComercial(row.periodo_hasta)}
          {row.comparacion_desde ? ` · comparado con ${formatoDiaComercial(row.comparacion_desde)} a ${formatoDiaComercial(row.comparacion_hasta)} (${String(row.comparacion_modo ?? "periodo")})` : ""}
        </p>
      </header>

      <section>
        <h3 className="text-sm font-semibold">Resumen</h3>
        <p className="mt-2 text-sm leading-6">{String(row.resumen || row.observacion)}</p>
        {row.interpretacion ? <p className="mt-2 text-sm leading-6 text-brand-muted">Interpretación: {String(row.interpretacion)}</p> : null}
        {visual.coherente && textoMetrica(visual.visual) ? (
          <p className="mt-3">
            {visual.visual?.metrica?.nombre ? <span className="block text-xs text-brand-muted">{visual.visual.metrica.nombre}</span> : null}
            <span className="text-2xl font-semibold tabular-nums">{textoMetrica(visual.visual)}</span>
          </p>
        ) : null}
        {visual.coherente && textoComparacion(visual.visual) ? <p className="text-xs text-brand-muted">{textoComparacion(visual.visual)}</p> : null}
      </section>

      <section>
        <h3 className="text-sm font-semibold">Evidencia</h3>
        {visual.motivo ? <p className="mt-2 text-sm" style={{ color: brand.error }}>{visual.motivo} Se muestra el texto publicado, no el gráfico.</p> : null}
        {visual.coherente && visual.visual && graficoAlcanza(visual.visual) ? (
          <div className="mt-3"><MilesVisual visual={visual.visual} /></div>
        ) : null}
        <Cifras metricas={metricas} />
        <p className="mt-3 text-sm leading-6">{String(row.observacion)}</p>
        <p className="mt-2 text-xs text-brand-muted">Estas cifras son el snapshot de la publicación. Una consulta actual con los mismos filtros puede diferir si hubo importaciones nuevas.</p>
      </section>

      <section>
        <h3 className="text-sm font-semibold">Recomendación</h3>
        {actual ? <p className="mt-2 text-sm leading-6">{actual}</p> : <p className="mt-2 text-sm text-brand-muted">No hay una recomendación vigente.</p>}
        {anterior ? (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs font-semibold text-brand-muted">Recomendación anterior</summary>
            <p className="mt-2 text-sm leading-6 text-brand-muted">{anterior}</p>
          </details>
        ) : null}
        <p className="mt-2 text-xs text-brand-muted">Prioridad {String(row.prioridad)}: {String(row.prioridad_justificacion)}</p>
      </section>

      {row.limitaciones ? (
        <section>
          <h3 className="text-sm font-semibold">Limitaciones</h3>
          <p className="mt-2 text-sm leading-6">{String(row.limitaciones)}</p>
        </section>
      ) : null}

      <section>
        <h3 className="text-sm font-semibold">Comentarios y ampliaciones</h3>
        {comentarios.length === 0 && investigaciones.length === 0 ? <p className="mt-2 text-sm text-brand-muted">Todavía no hay comentarios ni solicitudes.</p> : null}
        <ul className="mt-2 space-y-2">
          {comentarios.map((item) => (
            <li key={String(item.id)} className="text-sm">
              <span className="text-brand-muted">{formatoInstante(item.creado_en)} · {String(item.autor)}</span>
              <span className="mt-0.5 block">{String(item.cuerpo)}</span>
            </li>
          ))}
          {investigaciones.map((item) => (
            <li key={String(item.id)} className="text-sm">
              <span className="text-brand-muted">{formatoInstante(item.creada_en)} · {String(item.estado)}</span>
              <span className="mt-0.5 block">{String(item.pregunta)}</span>
              {item.respuesta ? <span className="mt-0.5 block text-brand-muted">{String(item.respuesta)}</span> : null}
              {item.estado === "pendiente" ? <span className="mt-0.5 block text-xs text-brand-muted">Pendiente. Miles todavía no la ha tomado.</span> : null}
            </li>
          ))}
        </ul>
        <label className="mt-3 block text-xs text-brand-muted">
          Comentario
          <textarea value={comentario} onChange={(event) => setComentario(event.target.value)} className="mt-1 w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm text-brand-ink" />
        </label>
        <button type="button" disabled={comentario.trim().length < 2} onClick={() => void enviar({ accion: "comentario", cuerpo: comentario })} className="mt-2 rounded-full bg-[#F3F4F6] px-3 py-1.5 text-sm font-semibold disabled:opacity-50">
          Publicar comentario
        </button>
        {vigente ? (
          <label className="mt-3 block text-xs text-brand-muted">
            Pedir ampliación
            <textarea value={pregunta} onChange={(event) => setPregunta(event.target.value)} className="mt-1 w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm text-brand-ink" />
          </label>
        ) : null}
      </section>

      <section>
        <h3 className="text-sm font-semibold">Historial</h3>
        <ul className="mt-2 space-y-1 text-sm">
          <li className="text-brand-muted">Publicado {formatoInstante(row.publicado_en)} · {String(row.autor ?? "miles")}</li>
          {eventos.map((evento) => (
            <li key={String(evento.id)}>{formatoInstante(evento.en)} · {String(evento.actor)} · {String(evento.accion)}</li>
          ))}
        </ul>
        {row.descarte_motivo ? <p className="mt-2 text-sm">Motivo del descarte: {String(row.descarte_motivo)}</p> : null}
        <p className="mt-2 text-xs text-brand-muted">
          Registro {String(row.estado)}. Resolución {row.resolucion ? String(row.resolucion) : "sin registrar"}. Recomendación {row.recomendacion_estado ? String(row.recomendacion_estado) : "sin registrar"}.
        </p>
        {clasificarHallazgo(row) === "requiere_revision" && row.resolucion == null ? (
          <p className="mt-1 text-xs text-brand-muted">La limitación habla de una resolución y la recomendación sigue escrita. Registrar resolución la deja como anterior.</p>
        ) : null}
      </section>

      <details>
        <summary className="cursor-pointer text-sm font-semibold">Fuentes y corte</summary>
        <p className="mt-2 text-xs leading-5 text-brand-muted">
          Consultas: {evidencia.consultas?.join(", ") || "no indicadas"}. Corte: {row.corte ? formatoDiaComercial(row.corte) : "no indicado"}.
          {visual.visual?.fuente ? ` Fuente de la visualización: ${visual.visual.fuente}.` : ""}
        </p>
      </details>

      <div className="flex flex-wrap gap-2">
        {(evidencia.enlaces ?? []).map((enlace) => (
          <Link key={`${enlace.pantalla}${enlace.query}`} href={hrefExplorar(enlace.pantalla, enlace.query)} className="rounded-full px-3 py-1.5 text-sm font-semibold text-white" style={{ backgroundColor: brand.green }}>
            {(evidencia.enlaces ?? []).length > 1 ? `Explorar ${enlace.pantalla}` : "Explorar datos"}
          </Link>
        ))}
        {visual.visual?.explorar && !(evidencia.enlaces ?? []).some((enlace) => enlace.pantalla === visual.visual?.explorar?.pantalla && enlace.query === visual.visual.explorar.query) ? (
          <Link href={hrefExplorar(visual.visual.explorar.pantalla, visual.visual.explorar.query)} className="rounded-full bg-[#F3F4F6] px-3 py-1.5 text-sm font-semibold">
            Explorar datos
          </Link>
        ) : null}
        {vigente ? <Link href={`/admin/consumo/miles?vista=pruebas&origen=${row.id}`} className="rounded-full bg-[#F3F4F6] px-3 py-1.5 text-sm font-semibold">Crear prueba</Link> : null}
        {onClose ? null : <Link href="/admin/consumo/miles" className="rounded-full bg-[#F3F4F6] px-3 py-1.5 text-sm font-semibold">Volver</Link>}
      </div>

      {vigente ? (
        <section className="space-y-3 border-t border-[#E5E7EB] pt-4">
          {clasificarHallazgo(row) === "requiere_revision" ? (
            <button type="button" onClick={() => actuar("resolver")} className="rounded-full px-3 py-1.5 text-sm font-semibold text-white" style={{ backgroundColor: brand.green }}>
              {confirmar === "resolver" ? "Confirmar resolución" : "Registrar resolución"}
            </button>
          ) : null}
          {pregunta ? (
            <button type="button" onClick={() => enviar({ accion: "ampliacion", pregunta })} className="rounded-full bg-[#F3F4F6] px-3 py-1.5 text-sm font-semibold">Dejar la solicitud</button>
          ) : null}
          <label className="block text-xs text-brand-muted">
            Motivo para descartar
            <input value={motivo} onChange={(event) => setMotivo(event.target.value)} className="mt-1 w-full rounded-md border border-[#E5E7EB] px-3 py-2 text-sm text-brand-ink" />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={motivo.trim().length < 3} onClick={() => void enviar({ accion: "descartar", motivo })} className="rounded-full px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50" style={{ backgroundColor: brand.error }}>Descartar</button>
            <button type="button" onClick={() => actuar("archivar")} className="rounded-full bg-[#F3F4F6] px-3 py-1.5 text-sm font-semibold">{confirmar === "archivar" ? "Confirmar archivo" : "Archivar"}</button>
          </div>
          <p className="text-xs text-brand-muted">Registrar resolución guarda la recomendación como anterior. No cambia el estado buscando palabras en el texto.</p>
        </section>
      ) : null}
      {aviso ? <p className="text-sm text-brand-muted">{aviso}</p> : null}
    </div>
  );
}

function Cifras({ metricas }: { metricas: Record<string, unknown> }) {
  const entradas = Object.entries(metricas).filter(([, value]) => value != null && value !== "").slice(0, 8);
  if (entradas.length === 0) return null;
  return (
    <dl className="mt-3 grid grid-cols-2 gap-2">
      {entradas.map(([key, value]) => (
        <div key={key}>
          <dt className="text-[11px] text-brand-muted">{key}</dt>
          <dd className="text-sm font-semibold tabular-nums">{typeof value === "number" ? formatNumero(value, Number.isInteger(value) ? 0 : 2) : String(value)}</dd>
        </div>
      ))}
    </dl>
  );
}
