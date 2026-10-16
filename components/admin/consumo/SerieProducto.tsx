"use client";

import { useState } from "react";
import { Bar, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatRd } from "@/lib/pos-domain";

export function SerieProducto({ serie }: { serie: Array<{ fecha: string; unidades: number; venta: number }> }) {
  const [listo, setListo] = useState(false);
  if (!listo) {
    return <div ref={() => setListo(true)} className="h-64 animate-pulse rounded-lg bg-[#F3F4F6]" />;
  }
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={serie.map((row) => ({ ...row, etiqueta: row.fecha.slice(5) }))}>
          <XAxis dataKey="etiqueta" tick={{ fontSize: 12, fill: "#6B7280" }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="venta" tick={{ fontSize: 12, fill: "#6B7280" }} axisLine={false} tickLine={false} width={48} />
          <YAxis yAxisId="uds" orientation="right" tick={{ fontSize: 12, fill: "#6B7280" }} axisLine={false} tickLine={false} width={32} />
          <Tooltip
            formatter={(value: number, name: string) => [name === "unidades" ? value : formatRd(value), name === "unidades" ? "Unidades" : "Venta"]}
            contentStyle={{ borderRadius: 16, borderColor: "#E5E7EB" }}
          />
          <Bar yAxisId="venta" dataKey="venta" fill="#7EB341" radius={[4, 4, 0, 0]} />
          <Line yAxisId="uds" dataKey="unidades" stroke="#111827" dot={false} strokeWidth={1.5} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
