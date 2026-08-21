"use client";

import { FormEvent, useEffect, useState } from "react";
import { brand } from "@/lib/theme";

type ProductRequestSheetProps = {
  sessionId: string;
  initialProduct: string;
  onClose: () => void;
};

export function ProductRequestSheet({ sessionId, initialProduct, onClose }: ProductRequestSheetProps) {
  const [producto, setProducto] = useState(initialProduct);
  const [nota, setNota] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (producto.trim().length < 2 || submitting) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/catalog/product-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          productoSolicitado: producto.trim(),
          nota: nota.trim() || null,
        }),
      });
      const body = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !body.success) {
        throw new Error(body.error || "No pudimos enviar la solicitud.");
      }
      setDone(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No pudimos enviar la solicitud.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button type="button" aria-label="Cerrar" className="absolute inset-0 bg-black/65 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-lg rounded-t-[28px] bg-white px-4 pb-8 pt-3 shadow-[0_-24px_80px_rgba(0,0,0,0.35)]"
        style={{ borderTop: `6px solid ${brand.green}` }}
      >
        <div className="mx-auto h-1.5 w-12 rounded-full" style={{ backgroundColor: `${brand.muted}40` }} />
        {done ? (
          <div className="px-1 pb-4 pt-5">
            <p className="font-display text-2xl font-bold text-brand-ink">¡Gracias!</p>
            <p className="mt-2 text-sm leading-relaxed text-brand-muted">Vamos a revisar tu solicitud.</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 w-full rounded-full py-3.5 text-base font-bold text-white"
              style={{ backgroundColor: brand.green, minHeight: 48 }}
            >
              Listo
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-1 pb-4 pt-5">
            <p className="font-display text-2xl font-bold text-brand-ink">Solicitar un producto</p>
            <p className="mt-1 text-sm leading-relaxed text-brand-muted">
              Cuéntanos qué buscas. Lo revisamos y te avisamos si lo podemos conseguir.
            </p>
            <label className="mt-5 block">
              <span className="text-sm font-bold text-brand-ink">Producto</span>
              <input
                value={producto}
                onChange={(event) => setProducto(event.target.value)}
                placeholder="Ej. Leche de almendras"
                autoComplete="off"
                className="mt-2 w-full rounded-2xl border bg-white px-4 py-3 text-base outline-none"
                style={{ borderColor: `${brand.muted}40`, minHeight: 48 }}
              />
            </label>
            <label className="mt-4 block">
              <span className="text-sm font-bold text-brand-ink">Nota (opcional)</span>
              <textarea
                value={nota}
                onChange={(event) => setNota(event.target.value)}
                placeholder="Marca, tamaño o cualquier detalle"
                rows={3}
                className="mt-2 w-full resize-none rounded-2xl border bg-white px-4 py-3 text-base outline-none"
                style={{ borderColor: `${brand.muted}40` }}
              />
            </label>
            {error ? (
              <p className="mt-3 rounded-2xl px-4 py-3 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={submitting || producto.trim().length < 2}
              className="mt-5 w-full rounded-full py-3.5 text-base font-bold text-white disabled:opacity-50"
              style={{ backgroundColor: brand.green, minHeight: 48 }}
            >
              {submitting ? "Enviando..." : "Enviar solicitud"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
