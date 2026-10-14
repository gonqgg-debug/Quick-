"use client";

import { useCallback, useEffect, useState } from "react";
import type { FacturaDetalle } from "@/lib/facturas-shared";

export type EnviarFactura = (path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) => Promise<void>;

export function useFactura(id: string) {
  const [factura, setFactura] = useState<FacturaDetalle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const recargar = useCallback(async () => {
    const response = await fetch(`/api/admin/facturas/${id}`, { credentials: "include" });
    const body = (await response.json().catch(() => ({}))) as { factura?: FacturaDetalle; error?: string };
    if (!response.ok || !body.factura) {
      throw new Error(body.error || "No pudimos abrir la factura");
    }
    setFactura(body.factura);
    setError(null);
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFactura(null);
    recargar()
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "No pudimos abrir la factura");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [recargar]);

  /** Sends a write under /api/admin/facturas/{id} (or to an absolute /api/ path) and reloads the ficha. Throws the server message on failure. */
  const enviar = useCallback<EnviarFactura>(
    async (path, method, body) => {
      const response = await fetch(path.startsWith("/api/") ? path : `/api/admin/facturas/${id}${path}`, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const parsed = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(parsed.error || "No pudimos guardar");
      }
      await recargar();
    },
    [id, recargar]
  );

  return { factura, error, loading, recargar, enviar };
}

export function mensajeDe(reason: unknown, fallback: string): string {
  return reason instanceof Error ? reason.message : fallback;
}
