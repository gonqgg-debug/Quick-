"use client";

import { FormEvent, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { brand } from "@/lib/theme";

type StaffLoginProps = {
  onSuccess: () => Promise<void> | void;
};

export function StaffLogin({ onSuccess }: StaffLoginProps) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setLoginError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/staff/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setLoginError(body?.error || "Contraseña incorrecta");
        return;
      }
      setPassword("");
      await onSuccess();
    } catch {
      setLoginError("No pudimos iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white px-4 py-10" style={{ color: brand.ink }}>
      <div className="mx-auto w-full max-w-sm">
        <Logo className="h-14" />
        <h1 className="font-display mt-6 text-2xl font-bold">Panel del personal</h1>
        <p className="mt-2 text-sm text-brand-muted">Escribe la contraseña para continuar.</p>
        <p className="mt-1 text-sm text-brand-muted">
          <a href="/empleados" className="font-semibold underline-offset-2 hover:underline" style={{ color: brand.green }}>
            ¿Buscas Administración?
          </a>
        </p>
        <form onSubmit={handleLogin} className="mt-6 space-y-3">
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Contraseña"
            className="w-full rounded-xl border px-4 py-3 text-base outline-none"
            style={{ borderColor: "#D1D5DB", fontSize: 16 }}
          />
          {loginError ? <p className="text-sm text-brand-error">{loginError}</p> : null}
          <button
            type="submit"
            disabled={loading || password.length === 0}
            className="w-full rounded-xl py-3 text-base font-semibold text-white disabled:opacity-60"
            style={{ backgroundColor: brand.green, minHeight: 48 }}
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </main>
  );
}

export async function staffLogout() {
  await fetch("/api/staff/logout", { method: "POST", credentials: "include" });
}
