"use client";

import { useEffect, useState } from "react";
import {
  DIAS_CORTOS,
  DIAS_LARGOS,
  cambioVisible,
  etiquetaFranja,
  etiquetaHoraCorta,
  maxAbsoluto,
  numeroCambio,
  textoCambio,
  textoEstado,
  textoMetrica,
  textoValor,
  valorMostrado,
  type CalculoId,
  type CambioModo,
  type CambioValor,
  type CeldaMapa,
  type EstadoVisual,
  type MapaHorario,
  type MetricaId,
  type VistaId,
} from "@/lib/consumo-horarios-ui";

const HORAS = Array.from({ length: 24 }, (_, hora) => hora);

function tonoActividad(valor: number | null, max: number, estado: EstadoVisual): string | null {
  if (estado === "sin_datos") return null;
  if (estado === "parcial" || estado === "desconocida") return "#FEF3C7";
  if (estado === "cero" || valor == null || valor <= 0 || max <= 0) return "#E5E7EB";
  const step = valor / max;
  if (step > 0.8) return "#3F6B1C";
  if (step > 0.6) return "#5C8C2A";
  if (step > 0.4) return "#7EB341";
  if (step > 0.2) return "#B7D48E";
  return "#E5F0D4";
}

function tonoCambio(valor: number | null, max: number, estado: CambioValor["estado"] | null): string {
  if (!estado || estado === "sin_comparacion") return "#F9FAFB";
  if (estado === "sin_base") return "#FEF3C7";
  if (estado === "ambos_cero" || valor == null || valor === 0 || max <= 0) return "#E5E7EB";
  const step = Math.min(1, Math.abs(valor) / max);
  if (valor > 0) return step > 0.66 ? "#3F6B1C" : step > 0.33 ? "#7EB341" : "#E5F0D4";
  return step > 0.66 ? "#991B1B" : step > 0.33 ? "#FCA5A5" : "#FEE2E2";
}

function tinta(fondo: string | null): string {
  return fondo === "#3F6B1C" || fondo === "#5C8C2A" || fondo === "#991B1B" ? "#FFFFFF" : "#111827";
}

function signo(cambio: CambioValor | null, modo: CambioModo): string {
  if (!cambio || cambio.estado === "sin_comparacion") return "";
  if (modo === "porcentaje" && (cambio.estado === "sin_base" || cambio.porcentaje == null)) return "s/b";
  const valor = numeroCambio(cambio, modo);
  if (valor == null) return "";
  if (valor > 0) return "+";
  if (valor < 0) return "−";
  return "0";
}

export function HorariosMapa({
  mapa,
  metrica,
  calculo,
  vista,
  cambio,
  categoria,
  seleccion,
  onSeleccion,
}: {
  mapa: MapaHorario;
  metrica: MetricaId;
  calculo: CalculoId;
  vista: VistaId;
  cambio: CambioModo;
  categoria: boolean;
  seleccion: { dow: number; hora: number } | null;
  onSeleccion: (celda: { dow: number; hora: number } | null) => void;
}) {
  const [foco, setFoco] = useState<{ dow: number; hora: number }>(seleccion ?? { dow: 1, hora: 8 });
  const seleccionDow = seleccion?.dow;
  const seleccionHora = seleccion?.hora;
  useEffect(() => {
    if (seleccionDow != null && seleccionHora != null) setFoco({ dow: seleccionDow, hora: seleccionHora });
  }, [seleccionDow, seleccionHora]);
  const [ayuda, setAyuda] = useState<{ dow: number; hora: number; x: number; y: number } | null>(null);
  const valores = mapa.celdas.map((celda) => (vista === "actividad" ? valorMostrado(celda, metrica, calculo) : numeroCambio(cambioVisible(celda, metrica, calculo), cambio)));
  const max = vista === "actividad" ? Math.max(0, ...valores.map((valor) => (valor != null && valor > 0 ? valor : 0))) : maxAbsoluto(valores);
  const unidad = textoMetrica(metrica, categoria);
  const columnas = "56px repeat(24, minmax(36px, 1fr)) minmax(76px, 92px)";

  function mover(dow: number, hora: number, tecla: string) {
    if (tecla === "ArrowRight") return { dow, hora: Math.min(23, hora + 1) };
    if (tecla === "ArrowLeft") return { dow, hora: Math.max(0, hora - 1) };
    if (tecla === "ArrowDown") return { dow: Math.min(7, dow + 1), hora };
    if (tecla === "ArrowUp") return { dow: Math.max(1, dow - 1), hora };
    if (tecla === "Home") return { dow, hora: 0 };
    if (tecla === "End") return { dow, hora: 23 };
    return null;
  }

  function describir(celda: CeldaMapa): string {
    const valor = valorMostrado(celda, metrica, calculo);
    const comparacion = cambioVisible(celda, metrica, calculo);
    const piezas = [
      `${DIAS_LARGOS[celda.dow]} ${etiquetaFranja(celda.hora)}`,
      textoEstado(celda.estado),
      `${unidad}: ${textoValor(valor, metrica)}`,
      `${celda.fechasCompletas.length} de ${celda.elegibles} fechas con sesión cerrada`,
    ];
    if (vista === "cambio" || comparacion) piezas.push(textoCambio(comparacion, metrica, cambio));
    return piezas.join(". ");
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <div className="min-w-[1040px]" role="grid" aria-label="Ventas por día y hora">
          <div className="grid gap-1" style={{ gridTemplateColumns: columnas }} role="row">
            <span />
            {HORAS.map((hora) => (
              <span key={hora} role="columnheader" className="pb-1 text-center text-[10px] leading-tight text-brand-muted" title={etiquetaHoraCorta(hora)}>
                {etiquetaHoraCorta(hora).replace(" a. m.", " a").replace(" p. m.", " p")}
              </span>
            ))}
            <span role="columnheader" className="pb-1 text-center text-[10px] font-semibold text-brand-muted" title="Resumen del día. No suma promedios de celdas.">
              Día
            </span>
          </div>
          {[1, 2, 3, 4, 5, 6, 7].map((dow) => {
            const dia = mapa.dias.find((item) => item.dow === dow);
            const valorDia = dia ? (vista === "cambio" ? textoCambio(cambioVisible(dia, metrica, calculo), metrica, cambio) : textoValor(valorMostrado(dia, metrica, calculo), metrica)) : "—";
            return (
              <div key={dow} className="mt-1 grid gap-1" style={{ gridTemplateColumns: columnas }} role="row">
                <span role="rowheader" className="sticky left-0 z-10 self-center bg-white pr-1 text-xs font-semibold text-brand-muted">
                  {DIAS_CORTOS[dow]}
                </span>
                {HORAS.map((hora) => {
                  const celda = mapa.celdas.find((item) => item.dow === dow && item.hora === hora);
                  if (!celda) return null;
                  const activa = seleccion?.dow === dow && seleccion.hora === hora;
                  const enfocada = foco.dow === dow && foco.hora === hora;
                  const cambioCelda = cambioVisible(celda, metrica, calculo);
                  const valor = vista === "actividad" ? valorMostrado(celda, metrica, calculo) : numeroCambio(cambioCelda, cambio);
                  const fondo = vista === "actividad" ? tonoActividad(valor, max, celda.estado) : tonoCambio(valor, max, cambioCelda?.estado ?? "sin_comparacion");
                  const marca = vista === "cambio" ? signo(cambioCelda, cambio) : "";
                  return (
                    <button
                      key={hora}
                      type="button"
                      role="gridcell"
                      tabIndex={enfocada ? 0 : -1}
                      aria-selected={activa}
                      aria-label={describir(celda)}
                      onFocus={(event) => {
                        setFoco({ dow, hora });
                        const rect = event.currentTarget.getBoundingClientRect();
                        setAyuda({ dow, hora, x: rect.left + rect.width / 2, y: rect.top });
                      }}
                      onBlur={() => setAyuda((actual) => (actual?.dow === dow && actual.hora === hora ? null : actual))}
                      onMouseEnter={(event) => {
                        if (!window.matchMedia("(hover: hover)").matches) return;
                        const rect = event.currentTarget.getBoundingClientRect();
                        setAyuda({ dow, hora, x: rect.left + rect.width / 2, y: rect.top });
                      }}
                      onMouseLeave={() => setAyuda((actual) => (actual?.dow === dow && actual.hora === hora ? null : actual))}
                      onClick={() => onSeleccion(activa ? null : { dow, hora })}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          onSeleccion(null);
                          return;
                        }
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onSeleccion(activa ? null : { dow, hora });
                          return;
                        }
                        const siguiente = mover(dow, hora, event.key);
                        if (!siguiente) return;
                        event.preventDefault();
                        setFoco(siguiente);
                        document.getElementById(`franja-${siguiente.dow}-${siguiente.hora}`)?.focus();
                      }}
                      id={`franja-${dow}-${hora}`}
                      className="relative h-9 min-w-9 rounded-sm text-[10px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green"
                      style={{
                        backgroundColor: fondo ?? undefined,
                        backgroundImage: celda.estado === "sin_datos" && vista === "actividad" ? "repeating-linear-gradient(135deg, #F9FAFB, #F9FAFB 3px, #D1D5DB 3px, #D1D5DB 4px)" : undefined,
                        color: tinta(fondo),
                        boxShadow: activa ? "inset 0 0 0 2px #111827" : "inset 0 0 0 1px rgba(17,24,39,0.08)",
                      }}
                    >
                      {marca}
                      {activa ? <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-[#111827]" aria-hidden="true" /> : null}
                    </button>
                  );
                })}
                <span role="gridcell" className="self-center truncate text-right text-[11px] font-semibold tabular-nums text-brand-ink" title={valorDia}>
                  {valorDia}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <Leyenda vista={vista} metrica={metrica} calculo={calculo} cambio={cambio} max={max} unidad={unidad} />
      {ayuda ? <Tooltip ayuda={ayuda} mapa={mapa} metrica={metrica} calculo={calculo} cambio={cambio} /> : null}
    </div>
  );
}

function Leyenda({
  vista,
  metrica,
  calculo,
  cambio,
  max,
  unidad,
}: {
  vista: VistaId;
  metrica: MetricaId;
  calculo: CalculoId;
  cambio: CambioModo;
  max: number;
  unidad: string;
}) {
  const extremo = vista === "cambio" && cambio === "porcentaje" ? textoCambio({ estado: "ok", absoluto: null, porcentaje: max, base: "total", observacionesActual: 0, observacionesAnterior: 0 }, metrica, "porcentaje").replace(/^\+/, "") : textoValor(max, metrica);
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[11px] text-brand-muted">
      {vista === "actividad" ? (
        <>
          <span>
            {calculo === "promedio" ? "Promedio" : "Total"} · {unidad} · 0 a {extremo}
          </span>
          {["#E5E7EB", "#E5F0D4", "#B7D48E", "#7EB341", "#3F6B1C"].map((color) => (
            <span key={color} className="h-3 w-6 rounded-sm" style={{ backgroundColor: color }} />
          ))}
        </>
      ) : (
        <>
          <span>
            Cambio de {unidad.toLowerCase()} · −{extremo} a +{extremo}
          </span>
          {["#991B1B", "#FCA5A5", "#E5E7EB", "#B7D48E", "#3F6B1C"].map((color) => (
            <span key={color} className="h-3 w-6 rounded-sm" style={{ backgroundColor: color }} />
          ))}
          <span className="inline-flex items-center gap-1">
            <span className="h-3 w-6 rounded-sm" style={{ backgroundColor: "#FEF3C7" }} /> Sin base porcentual
          </span>
        </>
      )}
      <span className="inline-flex items-center gap-1">
        <span className="h-3 w-6 rounded-sm border border-[#E5E7EB]" style={{ backgroundImage: "repeating-linear-gradient(135deg, #F9FAFB, #F9FAFB 3px, #D1D5DB 3px, #D1D5DB 4px)" }} /> Sin datos
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-3 w-6 rounded-sm" style={{ backgroundColor: "#E5E7EB" }} /> Cero
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-3 w-6 rounded-sm" style={{ backgroundColor: "#FEF3C7" }} /> Parcial o desconocida
      </span>
    </div>
  );
}

function Tooltip({
  ayuda,
  mapa,
  metrica,
  calculo,
  cambio,
}: {
  ayuda: { dow: number; hora: number; x: number; y: number };
  mapa: MapaHorario;
  metrica: MetricaId;
  calculo: CalculoId;
  cambio: CambioModo;
}) {
  const celda = mapa.celdas.find((item) => item.dow === ayuda.dow && item.hora === ayuda.hora);
  if (!celda) return null;
  const comparacion = cambioVisible(celda, metrica, calculo);
  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-30 w-56 -translate-x-1/2 -translate-y-full rounded-md border border-[#E6E8E6] bg-white px-2.5 py-2 text-xs text-brand-ink shadow-sm"
      style={{ left: ayuda.x, top: ayuda.y - 8 }}
    >
      <p className="font-semibold">
        {DIAS_LARGOS[celda.dow]} · {etiquetaFranja(celda.hora)}
      </p>
      <p className="mt-1">{textoEstado(celda.estado)}</p>
      <p className="mt-1 tabular-nums">{textoValor(valorMostrado(celda, metrica, calculo), metrica)}</p>
      <p className="mt-1 text-brand-muted">
        {celda.fechasCompletas.length} de {celda.elegibles} con sesión cerrada
        {comparacion ? ` · ${textoCambio(comparacion, metrica, cambio)}` : ""}
      </p>
    </div>
  );
}
