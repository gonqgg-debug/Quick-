import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { ADMIN_ROLE } from "@/lib/admin-role";

export function isAdminUser(user: User | null | undefined): boolean {
  return Boolean(user && user.app_metadata?.role === ADMIN_ROLE);
}

export function adminGreetingName(user: User): string {
  const meta = user.user_metadata ?? {};
  const fromMeta = [meta.full_name, meta.name, meta.nombre, meta.display_name].find(
    (value) => typeof value === "string" && value.trim().length > 0
  );
  if (typeof fromMeta === "string") {
    return fromMeta.trim().split(/\s+/)[0];
  }

  const local = (user.email ?? "").split("@")[0]?.replace(/[._-]+/g, " ").trim();
  if (!local) {
    return "admin";
  }
  return local.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function createAdminServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Faltan las variables de Supabase");
  }

  const cookieStore = cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component; middleware refreshes the session.
        }
      },
    },
  });
}

export async function getAdminUser(): Promise<User | null> {
  const supabase = createAdminServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return isAdminUser(user) ? user : null;
}

export async function requireAdminApi(): Promise<User | NextResponse> {
  const user = await getAdminUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return user;
}
