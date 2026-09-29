"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createAdminBrowserClient } from "@/lib/admin-browser";
import { ADMIN_ROLE } from "@/lib/admin-role";

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
    <main className="flex min-h-screen items-center bg-muted/40 px-4 py-10 text-foreground">
      <Card className="mx-auto w-full max-w-sm shadow-sm">
        <CardContent className="p-6">
          <Logo className="h-14" />
          <h1 className="font-display mt-6 text-2xl font-bold">Administración</h1>
          <p className="mt-2 text-sm text-muted-foreground">Entra con tu cuenta. Esta área es aparte del panel de Delivery.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            <a href="/empleados" className="font-medium text-primary underline-offset-4 hover:underline">
              ¿Buscas Delivery?
            </a>
          </p>
          <form onSubmit={handleLogin} className="mt-6 space-y-3">
            <Input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email"
            />
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Contraseña"
            />
            {loginError ? <p className="text-sm text-destructive">{loginError}</p> : null}
            <Button
              type="submit"
              className="w-full"
              disabled={loading || email.trim().length === 0 || password.length === 0}
            >
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
