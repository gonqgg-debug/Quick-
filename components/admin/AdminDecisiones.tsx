"use client";

import { useEffect, useState } from "react";
import { formatPrice } from "@/lib/money";
import type { Decision } from "@/lib/operacion-shared";
import { brand } from "@/lib/theme";

function fecha(value: string | null): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }
  return new Intl.DateTimeFormat("es-DO", {
    timeZone: "America/Santo_Domingo",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function AdminDecisiones() {
  const [decisiones, setDecisiones] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function load() {
    const response = await fetch("/api/admin/decisiones", { credentials: "include" });
    const body = (await response.json()) as { decisiones?: Decision[]; error?: string };
    if (!response.ok) {
      throw new Error(body.error || "No pudimos cargar las decisiones");
    }
    setDecisiones(body.decisiones ?? []);
    setError(null);
  }

  useEffect(() => {
    void load()
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "No pudimos cargar las decisiones"))
      .finally(() => setLoading(false));
  }, []);

  async function responder(id: string, respuesta: "si" | "no") {
    setSavingId(id);
    try {
      const response = await fetch(`/api/admin/decisiones/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ respuesta }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error || "No pudimos guardar la respuesta");
      }
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No pudimos guardar la respuesta");
    } finally {
      setSavingId(null);
    }
  }

  const pendientes = decisiones.filter((item) => item.estado === "pendiente");

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Finanzas</p>
      <h1 className="font-display mt-1 text-2xl font-bold">Decisiones</h1>
      <p className="mt-1 max-w-2xl text-sm text-brand-muted">
        Cada pregunta trae quién la hizo, la fecha y qué pasa si no se contesta. Están ordenadas por plata y por vencimiento.
      </p>
      {error ? (
        <p className="mt-4 rounded-2xl px-4 py-3 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>
          {error}
        </p>
      ) : null}
      {loading ? <div className="mt-6 h-40 animate-pulse rounded-2xl bg-[#F3F4F6]" /> : null}
      {!loading && pendientes.length === 0 ? (
        <p className="mt-6 rounded-2xl bg-white px-4 py-6 text-sm text-brand-muted" style={{ border: "1px solid #E7EBE4" }}>
          No hay decisiones pendientes.
        </p>
      ) : null}
      <div className="mt-5 space-y-3">
        {pendientes.map((item) => (
          <article key={item.id} className="rounded-2xl bg-white px-4 py-4" style={{ border: "1px solid #E7EBE4" }}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold">{item.pregunta}</p>
                <p className="mt-1 text-sm text-brand-muted">
                  {item.autor} · {fecha(item.creadaEn)}
                  {item.facturaReferencia ? ` · ${item.facturaReferencia}` : ""}
                </p>
              </div>
              <p className="font-display text-lg font-bold tabular-nums">{item.monto == null ? "—" : formatPrice(item.monto)}</p>
            </div>
            <p className="mt-3 text-sm" style={{ color: item.vencida ? "#9A3412" : brand.muted }}>
              Si no se contesta, {item.siNoContesta}.
              {item.venceEn ? ` Vence ${fecha(item.venceEn)}.` : ""}
              {item.vencida ? " Ya venció." : ""}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={savingId === item.id}
                onClick={() => void responder(item.id, "si")}
                className="rounded-full px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: brand.green }}
              >
                Sí
              </button>
              <button
                type="button"
                disabled={savingId === item.id}
                onClick={() => void responder(item.id, "no")}
                className="rounded-full border px-4 py-2 text-sm font-semibold disabled:opacity-60"
                style={{ borderColor: "#E5E7EB", color: brand.ink }}
              >
                No
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
