"use client";

import { useState } from "react";
import type { CeldaHorario } from "@/lib/pos-consumo";
import { formatNumero, formatRd } from "@/lib/pos-domain";

const DIAS = ["", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function tono(value: number, max: number): string {
  if (max <= 0 || value <= 0) {
    return "#F3F4F6";
  }
  const step = value / max;
  if (step > 0.8) return "#3F6B1C";
  if (step > 0.6) return "#5C8C2A";
  if (step > 0.4) return "#7EB341";
  if (step > 0.2) return "#B7D48E";
  return "#E5F0D4";
}

const ESTADO: Record<string, string> = {
  con_ventas: "",
  abierto_sin_ventas: "Abierta sin ventas",
  sin_datos: "Sin datos",
  cobertura_incompleta: "Cobertura incompleta",
};

export function MapaCalor({
  celdas,
  metrica,
  compacto = false,
  desde,
  hasta,
}: {
  celdas: CeldaHorario[];
  metrica: "venta" | "ordenes" | "unidades" | "promedio" | "ticket";
  compacto?: boolean;
  desde?: string;
  hasta?: string;
}) {
  const [elegida, setElegida] = useState<{ dow: number; hora: number } | null>(null);
  const mapa = new Map(celdas.map((celda) => [`${celda.dow}-${celda.hora}`, celda]));
  const valorDe = (celda: CeldaHorario) => {
    if (metrica === "promedio") return celda.promedio ?? 0;
    if (metrica === "ticket") return celda.ticket ?? 0;
    if (metrica === "ordenes") return celda.ordenes;
    if (metrica === "unidades") return celda.unidades;
    return celda.venta;
  };
  const max = Math.max(0, ...celdas.filter((celda) => celda.estado === "con_ventas").map(valorDe));
  const seleccion = elegida ? mapa.get(`${elegida.dow}-${elegida.hora}`) : null;
  const horas = compacto ? [8, 10, 12, 14, 16, 18, 20, 22] : Array.from({ length: 24 }, (_, hora) => hora);

  return (
    <div>
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-[48px_repeat(24,minmax(0,1fr))] gap-1" style={compacto ? { gridTemplateColumns: `48px repeat(${horas.length}, minmax(0, 1fr))` } : undefined}>
            <span />
            {horas.map((hora) => (
              <span key={hora} className="text-center text-[10px] text-brand-muted">
                {hora}
              </span>
            ))}
            {[1, 2, 3, 4, 5, 6, 7].map((dow) => (
              <div key={dow} className="contents">
                <span className="self-center text-xs font-semibold text-brand-muted">{DIAS[dow]}</span>
                {horas.map((hora) => {
                  const celda = mapa.get(`${dow}-${hora}`);
                  const valor = celda ? valorDe(celda) : 0;
                  const on = elegida?.dow === dow && elegida.hora === hora;
                  const fondo = !celda || celda.estado === "sin_datos" ? "#F9FAFB" : celda.estado === "cobertura_incompleta" ? "#FEF3C7" : celda.estado === "abierto_sin_ventas" ? "#F3F4F6" : tono(valor, max);
                  return (
                    <button
                      key={`${dow}-${hora}`}
                      type="button"
                      aria-label={`${DIAS[dow]} ${hora}:00`}
                      onClick={() => setElegida({ dow, hora })}
                      className="h-7 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green"
                      style={{ backgroundColor: fondo, outline: on ? "2px solid #111827" : undefined, boxShadow: !celda || celda.estado === "sin_datos" ? "inset 0 0 0 1px #E5E7EB" : undefined }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11px] text-brand-muted">
        <span>Menos</span>
        {["#F3F4F6", "#E5F0D4", "#B7D48E", "#7EB341", "#3F6B1C"].map((color) => (
          <span key={color} className="h-3 w-6 rounded-sm" style={{ backgroundColor: color }} />
        ))}
        <span>Más</span>
      </div>
      {seleccion ? (
        <div className="mt-3 text-sm text-brand-ink">
          <p>
            {DIAS[seleccion.dow]} {seleccion.hora}:00 · total {formatRd(seleccion.venta)} · promedio {formatRd(seleccion.promedio)} · ticket {formatRd(seleccion.ticket)} · {formatNumero(seleccion.ordenes)} tickets · {formatNumero(seleccion.unidades, 1)} unidades
          </p>
          <p className="mt-1 text-xs text-brand-muted">
            {ESTADO[seleccion.estado] || "Con ventas"} · {seleccion.ocurrencias} días con sesión cerrada en esta hora, incluidos los de cero ventas.
            {desde && hasta ? ` Periodo ${desde} a ${hasta}.` : ""} No hay un horario de cierre: una hora vacía no se marca como tienda cerrada.
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-brand-muted">Elige una celda para ver el total, el promedio y la cobertura.</p>
      )}
    </div>
  );
}
