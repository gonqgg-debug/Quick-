"use client";

import { Bar, BarChart, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { GraficaMiles } from "@/lib/miles-grafica";
import { formatNumero, formatPct, formatRd } from "@/lib/pos-domain";

const VERDE = "#7EB341";
const TINTA = "#1A1A1A";
const ROJO = "#B45309";

function textoValor(valor: number | null, unidad: GraficaMiles["unidad"]): string {
  if (valor == null || !Number.isFinite(valor)) return "Sin dato";
  if (unidad === "rd") return formatRd(valor);
  if (unidad === "pct") return formatPct(valor > 1 ? valor / 100 : valor).replace("+", "");
  return formatNumero(valor, 2);
}

export function MilesGrafica({ grafica }: { grafica: GraficaMiles }) {
  const datos = grafica.serie.map((punto) => ({ ...punto, valor: punto.valor }));
  return (
    <figure className="rounded-lg border border-[#E6E8E6] bg-white p-3">
      <figcaption className="mb-2">
        <p className="text-sm font-semibold text-[#111827]">{grafica.titulo}</p>
        <p className="text-xs text-brand-muted">
          {grafica.proyeccion ? "Proyección. " : "Observado. "}
          {grafica.periodo ? `${grafica.periodo.desde} a ${grafica.periodo.hasta}. ` : ""}
          {grafica.agregacion ?? ""}
          {grafica.cobertura ? ` ${grafica.cobertura}` : ""}
          {grafica.muestra != null ? ` Muestra: ${formatNumero(grafica.muestra)}.` : ""}
        </p>
      </figcaption>
      <div className="h-48">
        {grafica.tipo === "porcentaje" && grafica.numerador != null && grafica.denominador != null ? (
          <div className="flex h-full flex-col justify-center gap-2">
            <div className="h-3 overflow-hidden rounded-full bg-[#E5E7EB]">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, (grafica.numerador / grafica.denominador) * 100)}%`, backgroundColor: VERDE }} />
            </div>
            <p className="text-sm">
              {formatNumero(grafica.numerador)} de {formatNumero(grafica.denominador)}
            </p>
          </div>
        ) : null}
        {grafica.tipo === "dona" ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={datos} dataKey="valor" nameKey="etiqueta" innerRadius={36} outerRadius={64}>
                {datos.map((punto, index) => (
                  <Cell key={punto.etiqueta} fill={index === 0 ? VERDE : index === 1 ? "#1F82C5" : "#F79521"} />
                ))}
              </Pie>
              <Tooltip formatter={(valor) => textoValor(typeof valor === "number" ? valor : null, grafica.unidad)} />
            </PieChart>
          </ResponsiveContainer>
        ) : null}
        {grafica.tipo === "linea" ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={datos}>
              <XAxis dataKey="etiqueta" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(valor) => textoValor(typeof valor === "number" ? valor : null, grafica.unidad)} />
              <Line type="linear" dataKey="valor" stroke={VERDE} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : null}
        {grafica.tipo === "barras" || grafica.tipo === "barras_divergentes" || grafica.tipo === "cascada" || grafica.tipo === "histograma" || grafica.tipo === "apiladas" || grafica.tipo === "apiladas_100" ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={datos}>
              <XAxis dataKey="etiqueta" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={grafica.tipo === "barras" || grafica.tipo === "histograma" ? [0, "auto"] : undefined} />
              <Tooltip formatter={(valor) => textoValor(typeof valor === "number" ? valor : null, grafica.unidad)} />
              <Bar dataKey="valor">
                {datos.map((punto) => (
                  <Cell key={punto.etiqueta} fill={(punto.valor ?? 0) < 0 ? ROJO : VERDE} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : null}
        {grafica.tipo === "calor" ? (
          <div className="flex h-full flex-wrap content-start gap-1 overflow-auto">
            {datos.map((punto) => {
              const maximo = Math.max(...datos.map((item) => (item.valor != null && item.valor > 0 ? item.valor : 0)), 0);
              const intensidad = punto.valor == null || maximo === 0 ? 0 : Math.max(0.18, punto.valor / maximo);
              return (
                <span key={punto.etiqueta} className="rounded px-2 py-1 text-xs" style={{ backgroundColor: punto.valor == null ? "#F3F4F6" : VERDE, color: punto.valor == null ? TINTA : "#fff", opacity: punto.valor == null ? 1 : intensidad }} title={`${punto.etiqueta}: ${textoValor(punto.valor, grafica.unidad)}`}>
                  {punto.etiqueta}: {textoValor(punto.valor, grafica.unidad)}
                </span>
              );
            })}
          </div>
        ) : null}
      </div>
      {grafica.definicion ? <p className="mt-2 text-xs text-brand-muted">{grafica.definicion}</p> : null}
      <details className="mt-2 text-xs">
        <summary className="cursor-pointer font-semibold">Ver datos</summary>
        <table className="mt-2 w-full">
          <tbody>
            {grafica.serie.map((punto) => (
              <tr key={punto.etiqueta} className="border-t border-[#E6E8E6]">
                <td className="py-1">{punto.etiqueta}</td>
                <td className="py-1 text-right">{textoValor(punto.valor, grafica.unidad)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
