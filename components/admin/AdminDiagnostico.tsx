"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  formatDiagnosticoAmount,
  formatPesoHeader,
  formulaForecastCierreMes,
  type DiagnosticoForecast,
} from "@/lib/admin-diagnostico-shared";
import { brand } from "@/lib/theme";

type DiagnosticoResponse = DiagnosticoForecast & { formula?: string; error?: string };

export function AdminDiagnostico() {
  const router = useRouter();
  const [data, setData] = useState<DiagnosticoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/admin/diagnostico", { credentials: "include" });
        if (response.status === 401) {
          router.replace("/admin/login");
          return;
        }
        const body = (await response.json().catch(() => null)) as DiagnosticoResponse | null;
        if (!response.ok || !body || !("dias" in body)) {
          throw new Error(body?.error || "No pudimos cargar el diagnóstico");
        }
        if (!cancelled) {
          setData(body);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "No pudimos cargar el diagnóstico");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Parámetros</p>
      <h1 className="font-display mt-1 text-2xl font-bold">Diagnóstico de cálculo</h1>
      <p className="mt-1 text-sm text-brand-muted">
        Solo lectura. Compara los promedios y el forecast de cierre contra el Excel.
      </p>

      {error ? (
        <p className="mt-4 rounded-2xl px-4 py-3 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="mt-6 h-64 animate-pulse rounded-[24px] bg-gray-100" />
      ) : data ? (
        <DiagnosticoBody data={data} />
      ) : null}

      <p className="mt-8">
        <Link href="/admin/parametros" className="text-sm font-semibold" style={{ color: brand.green }}>
          Volver a parámetros
        </Link>
      </p>
    </div>
  );
}

function DiagnosticoBody({ data }: { data: DiagnosticoResponse }) {
  const pesoHeader = formatPesoHeader(data.pesos.reciente, data.pesos.intermedio, data.pesos.antiguo);
  const formula = data.formula ?? formulaForecastCierreMes(data);

  return (
    <>
      <p className="mt-5 text-sm text-brand-muted">
        Mes activo: <span className="font-semibold text-brand-ink">{data.mesActivo.label}</span>
      </p>

      <div className="mt-4 overflow-x-auto rounded-[24px] border" style={{ borderColor: "#E5E7EB" }}>
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="text-xs font-bold uppercase tracking-wide text-brand-muted" style={{ backgroundColor: "#F8FAF7" }}>
              <th className="px-4 py-3">Día</th>
              <th className="whitespace-nowrap px-4 py-3 text-right">Avg M-1 (mes reciente)</th>
              <th className="whitespace-nowrap px-4 py-3 text-right">Avg M-2</th>
              <th className="whitespace-nowrap px-4 py-3 text-right">Avg M-3</th>
              <th className="whitespace-nowrap px-4 py-3 text-right">Ponderado ({pesoHeader})</th>
            </tr>
          </thead>
          <tbody>
            {data.dias.map((dia, index) => (
              <tr key={dia.iso} style={{ backgroundColor: index % 2 === 1 ? "#FAFBFA" : "#FFFFFF" }}>
                <td className="px-4 py-3 font-semibold">{dia.nombre}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatDiagnosticoAmount(dia.avgM1)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatDiagnosticoAmount(dia.avgM2)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{formatDiagnosticoAmount(dia.avgM3)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums">
                  {formatDiagnosticoAmount(dia.ponderado)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="mt-5 space-y-4 rounded-[24px] border bg-white p-5" style={{ borderColor: "#E5E7EB" }}>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-brand-muted">Suma total ponderado (sumE)</p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums">{formatDiagnosticoAmount(data.sumaPonderado)}</p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-brand-muted">Meses usados</p>
          <p className="mt-1 text-sm font-semibold">
            M-1: {data.meses.m1.label}, M-2: {data.meses.m2.label}, M-3: {data.meses.m3.label}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-brand-muted">Forecast de cierre de mes</p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums">{formatDiagnosticoAmount(data.forecastCierreMes)}</p>
          <p className="mt-2 text-xs tabular-nums text-brand-muted">{formula}</p>
        </div>
      </section>
    </>
  );
}
