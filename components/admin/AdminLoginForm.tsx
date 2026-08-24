"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { createAdminBrowserClient } from "@/lib/admin-browser";
import { ADMIN_ROLE } from "@/lib/admin-role";
import { brand } from "@/lib/theme";

export function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setLoginError(null);
    setLoading(true);
    try {
      const supabase = createAdminBrowserClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error || !data.user) {
        setLoginError("Email o contraseña incorrectos");
        return;
      }
      if (data.user.app_metadata?.role !== ADMIN_ROLE) {
        await supabase.auth.signOut();
        setLoginError("Esta cuenta no tiene acceso de administración");
        return;
      }
      const next = searchParams.get("next");
      const safeNext =
        next && (next === "/admin" || next.startsWith("/admin/")) && !next.startsWith("//")
          ? next
          : "/admin";
      router.replace(safeNext);
      router.refresh();
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
        <h1 className="font-display mt-6 text-2xl font-bold">Administración</h1>
        <p className="mt-2 text-sm text-brand-muted">Entra con tu cuenta. Esta área es aparte del panel de Delivery.</p>
        <p className="mt-1 text-sm text-brand-muted">
          <a href="/empleados" className="font-semibold underline-offset-2 hover:underline" style={{ color: brand.green }}>
            ¿Buscas Delivery?
          </a>
        </p>
        <form onSubmit={handleLogin} className="mt-6 space-y-3">
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            className="w-full rounded-xl border px-4 py-3 text-base outline-none"
            style={{ borderColor: "#D1D5DB", fontSize: 16 }}
          />
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
            disabled={loading || email.trim().length === 0 || password.length === 0}
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
