"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bar, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatRd } from "@/lib/pos-domain";
import { brand } from "@/lib/theme";

export function VentaDiaChart({
  dias,
  anterior,
}: {
  dias: Array<{ fecha: string; venta: number; ordenes: number }>;
  anterior: Array<{ fecha: string; venta: number }>;
}) {
  const router = useRouter();
  const [listo, setListo] = useState(false);
  const data = dias.map((dia, index) => ({
    fecha: dia.fecha,
    etiqueta: dia.fecha.slice(5),
    venta: dia.venta,
    ordenes: dia.ordenes,
    anterior: anterior[index]?.venta ?? null,
  }));

  if (!listo) {
    return <div ref={() => setListo(true)} className="h-72 animate-pulse rounded-lg bg-[#F3F4F6]" />;
  }

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          onClick={(state) => {
            const fecha = state?.activePayload?.[0]?.payload?.fecha as string | undefined;
            if (fecha) {
              router.push(`/admin/consumo?preset=custom&desde=${fecha}&hasta=${fecha}`);
            }
          }}
        >
          <XAxis dataKey="etiqueta" tick={{ fontSize: 12, fill: "#6B7280" }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 12, fill: "#6B7280" }}
            axisLine={false}
            tickLine={false}
            width={56}
            tickFormatter={(value: number) => `${Math.round(value / 1000)}k`}
          />
          <Tooltip
            formatter={(value: number, name: string) => [formatRd(value), name === "anterior" ? "Periodo anterior" : "Venta"]}
            labelFormatter={(_label, payload) => String(payload?.[0]?.payload?.fecha ?? "")}
            contentStyle={{ borderRadius: 16, borderColor: "#E5E7EB" }}
          />
          <Bar dataKey="venta" fill={brand.green} radius={[4, 4, 0, 0]} />
          <Line dataKey="anterior" stroke="#111827" strokeDasharray="4 4" dot={false} strokeWidth={1.5} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

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

export function MapaCalor({
  celdas,
  metrica,
  compacto = false,
}: {
  celdas: Array<{ dow: number; hora: number; venta: number; ordenes: number; unidades: number }>;
  metrica: "venta" | "ordenes" | "unidades";
  compacto?: boolean;
}) {
  const [elegida, setElegida] = useState<{ dow: number; hora: number } | null>(null);
  const mapa = new Map(celdas.map((celda) => [`${celda.dow}-${celda.hora}`, celda]));
  const max = Math.max(0, ...celdas.map((celda) => celda[metrica]));
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
                  const valor = celda?.[metrica] ?? 0;
                  const on = elegida?.dow === dow && elegida.hora === hora;
                  return (
                    <button
                      key={`${dow}-${hora}`}
                      type="button"
                      aria-label={`${DIAS[dow]} ${hora}:00`}
                      onClick={() => setElegida({ dow, hora })}
                      className="h-7 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-green"
                      style={{ backgroundColor: tono(valor, max), outline: on ? "2px solid #111827" : undefined }}
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
        <p className="mt-3 text-sm text-brand-ink">
          {DIAS[seleccion.dow]} {seleccion.hora}:00 · {formatRd(seleccion.venta)} · {seleccion.ordenes} órdenes · {seleccion.unidades} unidades
        </p>
      ) : (
        <p className="mt-3 text-sm text-brand-muted">Elige una celda para ver el detalle.</p>
      )}
    </div>
  );
}
