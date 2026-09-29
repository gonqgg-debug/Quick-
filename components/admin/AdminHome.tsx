"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdminDashboardData } from "@/lib/admin-dashboard-shared";

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
          const message = loadError instanceof Error ? loadError.message : "No pudimos cargar el dashboard";
          setDashboardError(message);
          toast.error(message);
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
      toast.error(generateError instanceof Error ? generateError.message : "No pudimos generar el link");
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
      toast.success("Link copiado");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No pudimos copiar el link");
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Hoy</p>
      <h1 className="mt-1 text-2xl font-semibold text-foreground">Hola, {greetingName}</h1>
      {dashboard ? <p className="mt-1 text-sm text-muted-foreground">{dashboard.mesActivo}</p> : null}

      {dashboardError ? (
        <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {dashboardError}
        </p>
      ) : null}

      {dashboardLoading ? (
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 10 }, (_, index) => (
            <Skeleton
              key={index}
              className={`h-24 rounded-lg bg-muted ${index >= 8 ? "col-span-2 md:col-span-3 lg:col-span-2" : ""}`}
            />
          ))}
        </div>
      ) : dashboard ? (
        <AdminDashboard data={dashboard} />
      ) : null}

      <Card className="mt-6 shadow-sm">
        <CardHeader className="space-y-1 p-5 pb-0">
          <CardTitle className="text-base font-semibold">Herramientas rápidas</CardTitle>
          <CardDescription>
            Genera un catálogo como si un cliente lo pidiera por WhatsApp, marcado como prueba.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 pt-4">
          <Button
            type="button"
            variant="default"
            onClick={() => void generateLink()}
            disabled={busy}
            className="h-10 min-w-[200px]"
          >
            {busy ? "Generando..." : "Generar link de prueba"}
          </Button>

          {session ? (
            <div className="mt-4 rounded-lg border border-border px-3 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Link generado</p>
              <a
                href={session.url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block break-all text-sm font-medium text-foreground"
              >
                {displayUrl(session.url)}
              </a>
              <Button type="button" variant="outline" onClick={() => void copyLink()} className="mt-3 h-9">
                {copied ? "Copiado" : "Copiar"}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
