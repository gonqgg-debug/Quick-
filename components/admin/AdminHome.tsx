"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import type { AdminDashboardData } from "@/lib/admin-dashboard-shared";
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
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [session, setSession] = useState<TestSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setDashboardLoading(true);
      try {
        const response = await fetch("/api/admin/dashboard", { credentials: "include" });
        if (response.status === 401) {
          router.replace("/admin/login");
          return;
        }
        const body = (await response.json().catch(() => null)) as AdminDashboardData | { error?: string } | null;
        if (!response.ok) {
          throw new Error((body && "error" in body && body.error) || "No pudimos cargar el dashboard");
        }
        if (!body || !("mesActivo" in body)) {
          throw new Error("No pudimos cargar el dashboard");
        }
        if (!cancelled) {
          setDashboard(body);
          setDashboardError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setDashboardError(loadError instanceof Error ? loadError.message : "No pudimos cargar el dashboard");
        }
      } finally {
        if (!cancelled) {
          setDashboardLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

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
      const body = (await response.json().catch(() => null)) as TestSession | { error?: string } | null;
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
      <p className="text-xs font-bold uppercase tracking-wide text-brand-muted">Hoy</p>
      <h1 className="font-display mt-1 text-2xl font-bold">Hola, {greetingName}</h1>
      {dashboard ? (
        <p className="mt-1 text-sm font-semibold text-brand-muted">{dashboard.mesActivo}</p>
      ) : null}

      {dashboardError ? (
        <p className="mt-4 rounded-2xl px-4 py-3 text-sm" style={{ backgroundColor: "#FEE2E2", color: brand.error }}>
          {dashboardError}
        </p>
      ) : null}

      {dashboardLoading ? (
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-[24px] bg-gray-100" />
          ))}
        </div>
      ) : dashboard ? (
        <AdminDashboard data={dashboard} />
      ) : null}

      <section className="mt-6 rounded-[24px] border bg-white p-5" style={{ borderColor: "#E5E7EB" }}>
        <h2 className="font-display text-lg font-bold">Herramientas rápidas</h2>
        <p className="mt-1 text-sm text-brand-muted">
          Genera un catálogo como si un cliente lo pidiera por WhatsApp, marcado como prueba.
        </p>
        <button
          type="button"
          onClick={() => void generateLink()}
          disabled={busy}
          className="mt-4 rounded-full px-4 text-sm font-bold text-white disabled:opacity-60 sm:w-auto"
          style={{ backgroundColor: brand.green, minHeight: 44, minWidth: 220 }}
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
    </div>
  );
}
