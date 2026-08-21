"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { brand } from "@/lib/theme";

type AdminHomeProps = {
  greetingName: string;
};

type TestSession = {
  sessionId: string;
  url: string;
};

function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, "");
}

export function AdminHome({ greetingName }: AdminHomeProps) {
  const router = useRouter();
  const [session, setSession] = useState<TestSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generateLink() {
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const response = await fetch("/api/admin/sesiones-prueba", {
        method: "POST",
        credentials: "include",
      });
      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const body = (await response.json().catch(() => null)) as
        | TestSession
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error((body && "error" in body && body.error) || "No pudimos generar el link");
      }
      if (!body || !("url" in body) || !body.url) {
        throw new Error("No pudimos generar el link");
      }
      setSession({ sessionId: body.sessionId, url: body.url });
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "No pudimos generar el link");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!session) {
      return;
    }
    try {
      await navigator.clipboard.writeText(session.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("No pudimos copiar el link");
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Inicio</p>
      <h1 className="font-display mt-1 text-2xl font-bold">Hola, {greetingName}</h1>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <section
          className="rounded-[24px] border bg-white p-5 lg:col-span-1"
          style={{ borderColor: "#E5E7EB" }}
        >
          <h2 className="font-display text-lg font-bold">Herramientas rápidas</h2>
          <p className="mt-1 text-sm text-brand-muted">
            Genera un catálogo como si un cliente lo pidiera por WhatsApp, marcado como prueba.
          </p>
          <button
            type="button"
            onClick={() => void generateLink()}
            disabled={busy}
            className="mt-4 w-full rounded-full px-4 text-sm font-bold text-white disabled:opacity-60"
            style={{ backgroundColor: brand.green, minHeight: 44 }}
          >
            {busy ? "Generando..." : "Generar link de prueba"}
          </button>

          {error ? (
            <p className="mt-3 rounded-2xl px-3 py-2 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>
              {error}
            </p>
          ) : null}

          {session ? (
            <div className="mt-4 rounded-2xl px-3 py-3" style={{ backgroundColor: "#F8FAF7" }}>
              <p className="text-[11px] font-bold uppercase tracking-wide text-brand-muted">Link generado</p>
              <a
                href={session.url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block break-all text-sm font-semibold"
                style={{ color: brand.green }}
              >
                {displayUrl(session.url)}
              </a>
              <button
                type="button"
                onClick={() => void copyLink()}
                className="mt-3 rounded-full px-4 text-sm font-bold"
                style={{ minHeight: 40, backgroundColor: "#FFFFFF", color: brand.ink, border: "1px solid #E5E7EB" }}
              >
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>
          ) : null}
        </section>

        <div className="grid gap-4 lg:col-span-2 sm:grid-cols-2">
          <section
            aria-hidden
            className="min-h-[180px] rounded-[24px] border border-dashed"
            style={{ borderColor: "#E5E7EB", backgroundColor: "#FAFBFA" }}
          />
          <section
            aria-hidden
            className="min-h-[180px] rounded-[24px] border border-dashed"
            style={{ borderColor: "#E5E7EB", backgroundColor: "#FAFBFA" }}
          />
        </div>
      </div>
    </div>
  );
}
