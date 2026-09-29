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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
        <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {loading ? (
        <Skeleton className="mt-6 h-64 w-full" />
      ) : data ? (
        <DiagnosticoBody data={data} />
      ) : null}

      <p className="mt-8">
        <Button variant="link" className="h-auto p-0" asChild>
          <Link href="/admin/parametros">Volver a parámetros</Link>
        </Button>
      </p>
    </div>
  );
}

function DiagnosticoBody({ data }: { data: DiagnosticoResponse }) {
  const pesoHeader = formatPesoHeader(data.pesos.reciente, data.pesos.intermedio, data.pesos.antiguo);
  const formula = data.formula ?? formulaForecastCierreMes(data);

  return (
    <>
      <p className="mt-5 text-sm text-muted-foreground">
        Mes activo: <span className="font-medium text-foreground">{data.mesActivo.label}</span>
      </p>

      <Card className="mt-4 overflow-hidden shadow-sm">
        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Día</TableHead>
              <TableHead className="text-right">Avg M-1 (mes reciente)</TableHead>
              <TableHead className="text-right">Avg M-2</TableHead>
              <TableHead className="text-right">Avg M-3</TableHead>
              <TableHead className="text-right">Ponderado ({pesoHeader})</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.dias.map((dia) => (
              <TableRow key={dia.iso}>
                <TableCell className="font-medium">{dia.nombre}</TableCell>
                <TableCell className="text-right tabular-nums">{formatDiagnosticoAmount(dia.avgM1)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatDiagnosticoAmount(dia.avgM2)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatDiagnosticoAmount(dia.avgM3)}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatDiagnosticoAmount(dia.ponderado)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card className="mt-5 shadow-sm">
        <CardContent className="space-y-4 p-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Suma total ponderado (sumE)</p>
            <p className="mt-1 font-display text-2xl font-bold tabular-nums">{formatDiagnosticoAmount(data.sumaPonderado)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Meses usados</p>
            <p className="mt-1 text-sm font-medium">
              M-1: {data.meses.m1.label}, M-2: {data.meses.m2.label}, M-3: {data.meses.m3.label}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Forecast de cierre de mes</p>
            <p className="mt-1 font-display text-2xl font-bold tabular-nums">{formatDiagnosticoAmount(data.forecastCierreMes)}</p>
            <p className="mt-2 text-xs tabular-nums text-muted-foreground">{formula}</p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
