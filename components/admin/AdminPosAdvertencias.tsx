"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatPrice } from "@/lib/money";
import { metodoPagoLabel, type PosAdvertencia } from "@/lib/pos";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-2xl font-bold">Caja POS</h1>
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
