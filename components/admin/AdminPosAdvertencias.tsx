"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/lib/money";
import { metodoPagoLabel, shiftDifferenceLabel, type PosAdvertencia, type PosTurnoResumen } from "@/lib/pos";
import { brand } from "@/lib/theme";

function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("es-DO", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function detalleTexto(item: PosAdvertencia["detalle"][number]): string {
  if (item.motivo === "producto_no_encontrado") {
    return `${item.nombre}: el producto ya no está en el catálogo`;
  }
  const antes = item.stockAntes == null ? "?" : String(item.stockAntes);
  const despues = item.stockDespues == null ? "?" : String(item.stockDespues);
  const cantidad = item.cantidad == null ? "?" : String(item.cantidad);
  return `${item.nombre}: se vendieron ${cantidad} y había ${antes}. Quedó en ${despues}.`;
}

export function AdminPosAdvertencias() {
  const router = useRouter();
  const [rows, setRows] = useState<PosAdvertencia[]>([]);
  const [turnos, setTurnos] = useState<PosTurnoResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [turnosError, setTurnosError] = useState<string | null>(null);
  const [turnosLoading, setTurnosLoading] = useState(true);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/pos/advertencias", { credentials: "include", cache: "no-store" });
    if (response.status === 401) {
      router.replace("/admin/login");
      return;
    }
    const body = (await response.json().catch(() => null)) as { advertencias?: PosAdvertencia[]; error?: string } | null;
    if (!response.ok) {
      throw new Error(body?.error || "No pudimos cargar las advertencias");
    }
    setRows(body?.advertencias ?? []);
  }, [router]);

  const loadTurnos = useCallback(async () => {
    const response = await fetch("/api/admin/pos/turnos", { credentials: "include", cache: "no-store" });
    if (response.status === 401) {
      router.replace("/admin/login");
      return;
    }
    const body = (await response.json().catch(() => null)) as { turnos?: PosTurnoResumen[]; error?: string } | null;
    if (!response.ok) {
      throw new Error(body?.error || "No pudimos cargar los turnos");
    }
    setTurnos(body?.turnos ?? []);
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await load();
        if (!cancelled) setError(null);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Error al cargar");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setTurnosLoading(true);
      try {
        await loadTurnos();
        if (!cancelled) setTurnosError(null);
      } catch (loadError) {
        if (!cancelled) {
          setTurnosError(loadError instanceof Error ? loadError.message : "Error al cargar turnos");
        }
      } finally {
        if (!cancelled) setTurnosLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadTurnos]);

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-2xl font-bold">Caja POS</h1>
      <h2 className="mt-6 font-display text-xl font-bold">Turnos del personal</h2>
      <p className="mt-2 max-w-2xl text-sm text-brand-muted">
        Apertura y cierre de cada caja. El efectivo esperado es el fondo más las ventas en efectivo de ese turno.
      </p>
      {turnosError ? (
        <p className="mt-4 rounded-2xl px-3 py-2 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>
          {turnosError}
        </p>
      ) : null}
      {turnosLoading ? <p className="mt-4 text-sm text-brand-muted">Cargando turnos…</p> : null}
      {!turnosLoading && !turnosError && turnos.length === 0 ? (
        <p className="mt-4 rounded-3xl px-5 py-8 text-center text-sm font-semibold" style={{ backgroundColor: "#F8FAF7" }}>
          Todavía no hay turnos de caja.
        </p>
      ) : null}
      <ul className="mt-4 space-y-3">
        {turnos.map((turno) => {
          const diferencia = turno.diferencia == null ? null : shiftDifferenceLabel(turno.diferencia);
          return (
            <li key={turno.id} className="rounded-3xl border bg-white px-4 py-4" style={{ borderColor: "#E5E7EB" }}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">
                  {turno.abiertoPor} · {turno.estado === "cerrado" ? "Cerrado" : "Abierto"}
                </p>
                <p className="text-sm text-brand-muted">{formatWhen(turno.abiertoEn)}</p>
              </div>
              <p className="mt-2 text-sm">
                Fondo {formatPrice(turno.fondoInicial)} · Efectivo {formatPrice(turno.totalEfectivo)} · Tarjeta{" "}
                {formatPrice(turno.totalTarjeta)} · Transferencia {formatPrice(turno.totalTransferencia)} · {turno.ventasCount}{" "}
                ventas
              </p>
              {turno.estado === "cerrado" ? (
                <p className="mt-2 text-sm font-semibold">
                  Contado {turno.efectivoContado == null ? "—" : formatPrice(turno.efectivoContado)} · Esperado{" "}
                  {turno.efectivoEsperado == null ? "—" : formatPrice(turno.efectivoEsperado)}
                  {diferencia ? ` · ${diferencia.text}` : ""}
                  {turno.cerradoEn ? ` · ${formatWhen(turno.cerradoEn)}` : ""}
                </p>
              ) : null}
              {turno.notas ? <p className="mt-2 text-sm text-brand-muted">{turno.notas}</p> : null}
            </li>
          );
        })}
      </ul>
      <h2 className="mt-10 font-display text-xl font-bold">Stock en negativo</h2>
      <p className="mt-2 max-w-2xl text-sm text-brand-muted">
        Ventas que se sincronizaron igual aunque el stock del servidor no alcanzaba. La venta quedó registrada y la
        existencia puede haber quedado negativa.
      </p>
      {error ? (
        <p className="mt-4 rounded-2xl px-3 py-2 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>
          {error}
        </p>
      ) : null}
      {loading ? <p className="mt-8 text-sm text-brand-muted">Cargando…</p> : null}
      {!loading && !error && rows.length === 0 ? (
        <p className="mt-8 rounded-3xl px-5 py-12 text-center text-sm font-semibold" style={{ backgroundColor: "#F8FAF7" }}>
          No hay ventas de caja con advertencia de stock.
        </p>
      ) : null}
      <ul className="mt-6 space-y-3">
        {rows.map((row) => (
          <li key={row.id} className="rounded-3xl border bg-white px-4 py-4" style={{ borderColor: "#E5E7EB" }}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-semibold">{formatWhen(row.fecha)}</p>
              <p className="font-display text-2xl font-extrabold tabular-nums">{formatPrice(row.total)}</p>
            </div>
            <p className="mt-1 text-sm text-brand-muted">
              {metodoPagoLabel(row.metodoPago)}
              {row.cambio != null ? ` · cambio ${formatPrice(row.cambio)}` : ""}
            </p>
            <ul className="mt-3 space-y-1 text-sm">
              {row.detalle.map((item, index) => (
                <li key={`${row.id}-${index}`}>{detalleTexto(item)}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
